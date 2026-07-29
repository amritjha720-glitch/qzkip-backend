const Queue = require('../models/Queue');
const Vendor = require('../models/Vendor');
const Customer = require('../models/Customer');
const moment = require('moment-timezone'); 
const logger = require('../config/logger'); 
const mongoose = require('mongoose');

// 🟢 HELPER: Gets 00:00:00 of today strictly in India Time (IST)
const getStartOfToday = () => {
  return moment.tz("Asia/Kolkata").startOf('day').toDate();
};

// ==========================================
// 🚀 CRON EXPORT: Stuck tokens auto-cleanup
// ==========================================
exports.autoCleanStuckTokens = async () => {
  try {
    const now = new Date();
    const startOfToday = getStartOfToday();

    await Queue.updateMany(
      { status: 'skipped', graceEndTime: { $lte: now } },
      { $set: { status: 'expired' } }
    );

    await Queue.updateMany(
      { 
        status: { $in: ['waiting', 'processing', 'skipped'] }, 
        createdAt: { $lt: startOfToday } 
      },
      { $set: { status: 'expired' } }
    );
    logger.info('🧹 [CRON] Stuck tokens auto-cleaned successfully.');
  } catch (error) {
    logger.error(`[AUTO CLEANUP ERROR]: ${error.message}`);
  }
};

// ==========================================
// 1. Generate Token (Customer) 
// ==========================================
exports.generateToken = async (req, res, next) => {
  try {
    const { qr_id, customer_name, googleUID } = req.body;
    const startOfToday = getStartOfToday();

    if (!googleUID) return res.status(400).json({ success: false, message: 'Google Login is required!' });

    const vendor = await Vendor.findOne({ qr_id }).lean();
    if (!vendor) return res.status(404).json({ success: false, message: 'Shop not found' });

    if (vendor.is_open === false) {
      return res.status(403).json({ success: false, message: 'This shop is currently closed! New tokens are not being accepted.' });
    }

    const activeTokenCheck = await Queue.findOne({
      vendor_id: vendor._id,
      status: { $in: ['waiting', 'processing', 'skipped'] },
      createdAt: { $gte: startOfToday },
      googleUID: googleUID 
    }).lean();

    if (activeTokenCheck) {
      return res.status(400).json({ success: false, message: `You already have an active token (#${activeTokenCheck.token_number}) at this shop!` });
    }

    const dailyBookingsCount = await Queue.countDocuments({
      vendor_id: vendor._id,
      googleUID: googleUID,
      createdAt: { $gte: startOfToday }
    });
    
    if (dailyBookingsCount >= 3) {
        return res.status(403).json({ success: false, message: 'Your booking limit (max 3) for this shop today has been exhausted!' });
    }

    await Customer.findOneAndUpdate(
      { googleUID }, 
      { $setOnInsert: { name: customer_name, is_verified: true } },
      { upsert: true, new: true }
    );

    const now = new Date();
    
    let updatedVendor = await Vendor.findOneAndUpdate(
      { _id: vendor._id, 'stats.last_reset': { $gte: startOfToday } },
      { $inc: { 'stats.daily_token_count': 1 }, $set: { 'stats.last_reset': now } },
      { new: true }
    );

    if (!updatedVendor) {
      updatedVendor = await Vendor.findOneAndUpdate(
        { _id: vendor._id, 'stats.last_reset': { $lt: startOfToday } },
        { $set: { 'stats.daily_token_count': 1, 'stats.last_reset': now } },
        { new: true }
      );
      
      if (!updatedVendor) {
        updatedVendor = await Vendor.findOneAndUpdate(
          { _id: vendor._id },
          { $inc: { 'stats.daily_token_count': 1 } },
          { new: true }
        );
      }
    }

    const nextTokenNumber = updatedVendor.stats.daily_token_count;

    const newQueueItem = new Queue({
      vendor_id: vendor._id,
      googleUID: googleUID, 
      customer_name: customer_name || 'Walk-in',
      token_number: nextTokenNumber,
      status: 'waiting',
      hiddenFromCustomer: false 
    });
    await newQueueItem.save();

    const io = req.app.get('socketio');
    if (io) {
      io.emit(`vendor_${vendor._id}`, { 
        action: 'refresh', 
        message: 'A new token has arrived!',
        token_data: newQueueItem 
      });
    }

    res.status(201).json({ success: true, token_number: nextTokenNumber, message: 'Token successfully generated!' });
  } catch (error) { 
    next(error); 
  }
};

// ==========================================
// 2. Toggle Shop Status (Vendor) 
// ==========================================
exports.toggleStatus = async (req, res, next) => { 
  try {
    const vendor_id = req.vendor.vendorId;
    const { status, forceCancel } = req.body; 
    
    await Vendor.findByIdAndUpdate(vendor_id, { is_open: status });
    
    if (status === false && forceCancel) {
      const startOfToday = getStartOfToday();
      
      await Queue.updateMany(
        {
          vendor_id,
          status: { $in: ['waiting', 'processing', 'skipped'] },
          createdAt: { $gte: startOfToday }
        },
        { $set: { status: 'cancelled_by_vendor', updatedAt: new Date(), graceEndTime: null } }
      );
    }

    const io = req.app.get('socketio');
    if (io) {
      io.emit(`vendor_${vendor_id}`, { 
        action: 'shop_status_changed', 
        is_open: status,
        message: status ? 'Shop is now open' : 'Shop is now closed' 
      }); 
    }

    res.json({ success: true, message: "Status updated!" });
  } catch (error) {
    next(error); 
  }
};

// ==========================================
// 3. Get Live Queue (Vendor Dashboard)
// ==========================================
exports.getLiveQueue = async (req, res, next) => {
  try {
    const vendor_id = req.vendor.vendorId; 
    const startOfToday = getStartOfToday();

    const [vendorInfo, activeQueue, totalToday, avgTimeResult] = await Promise.all([
      Vendor.findById(vendor_id).select('shop_name qr_id is_open').lean(),
      Queue.find({
        vendor_id,
        status: { $in: ['waiting', 'processing', 'skipped'] }, 
        createdAt: { $gte: startOfToday }
      }).sort({ is_priority: -1, token_number: 1 }).lean(), 
      Queue.countDocuments({ vendor_id, createdAt: { $gte: startOfToday } }),
      Queue.aggregate([
        { $match: { vendor_id: new mongoose.Types.ObjectId(vendor_id), status: 'completed', processedAt: { $exists: true }, createdAt: { $gte: startOfToday } } },
        { $project: { serviceTimeMs: { $subtract: ["$updatedAt", "$processedAt"] } } },
        { $group: { _id: null, avgWaitMs: { $avg: "$serviceTimeMs" } } }
      ])
    ]);

    let avgServiceTime = 15;
    if (avgTimeResult.length > 0 && avgTimeResult[0].avgWaitMs != null) {
      avgServiceTime = Math.round(avgTimeResult[0].avgWaitMs / 60000) || 15;
    }

    res.json({ 
      success: true, 
      count: activeQueue.length, 
      data: activeQueue, 
      stats: { totalToday, avgWait: avgServiceTime }, 
      vendorDetails: vendorInfo 
    });
  } catch (error) { 
    next(error); 
  }
};

// ==========================================
// 4. Update Token Status (Vendor)
// ==========================================
exports.updateStatus = async (req, res, next) => {
  try {
    const { token_id, new_status, isPriority } = req.body;
    let updateFields = { status: new_status };

    if (new_status === 'processing') {
        updateFields.processedAt = new Date();
        updateFields.graceEndTime = null; 
    }

    if (new_status === 'waiting' && isPriority) {
        updateFields.createdAt = new Date(); 
        updateFields.graceEndTime = null; 
    }

    if (new_status === 'skipped') {
        updateFields.graceEndTime = new Date(Date.now() + 15 * 60 * 1000); 
    }

    const updatedToken = await Queue.findByIdAndUpdate(
        token_id, updateFields, { new: true }
    );

    if (!updatedToken) return res.status(404).json({ success: false, message: 'Token not found' });
    
    const io = req.app.get('socketio');
    if (io) {
        io.emit('queueUpdate'); 
        io.emit(`vendor_${updatedToken.vendor_id}`, { action: 'refresh', status: new_status });
    }

    res.json({ success: true, data: updatedToken });
  } catch (error) { 
    next(error); 
  }
};

// ==========================================
// 5. Get Public Status (Customer Tracking)
// ==========================================
exports.getPublicStatus = async (req, res, next) => {
  try {
    const { qr_id } = req.params;
    const vendor = await Vendor.findOne({ qr_id }).lean();
    if (!vendor) return res.status(404).json({ success: false, message: 'Shop not found' });

    const startOfToday = getStartOfToday();

    const [activeQueue, avgTimeResult] = await Promise.all([
      Queue.find({
        vendor_id: vendor._id,
        status: { $in: ['waiting', 'processing'] },
        createdAt: { $gte: startOfToday }
      })
      .sort({ is_priority: -1, token_number: 1 })
      .select('token_number status customer_name is_priority') 
      .lean(),
      Queue.aggregate([
        { $match: { vendor_id: vendor._id, status: 'completed', processedAt: { $exists: true }, createdAt: { $gte: startOfToday } } },
        { $project: { serviceTimeMs: { $subtract: ["$updatedAt", "$processedAt"] } } },
        { $group: { _id: null, avgWaitMs: { $avg: "$serviceTimeMs" } } }
      ])
    ]);

    let avgServiceTime = 15; 
    if (avgTimeResult.length > 0 && avgTimeResult[0].avgWaitMs != null) {
      avgServiceTime = Math.round(avgTimeResult[0].avgWaitMs / 60000) || 15;
    }

    res.json({ 
      success: true, 
      shop_name: vendor.shop_name,
      shop_type: vendor.shop_type,
      currently_serving: activeQueue.find(q => q.status === 'processing')?.token_number || null,
      full_queue: activeQueue, 
      avgWaitTime: avgServiceTime 
    });
  } catch (error) { 
    next(error); 
  }
};

// ==========================================
// 📍 6. Get All Shops (Customer Homepage with Geo-Location)
// ==========================================
exports.getAllShops = async (req, res, next) => {
  try {
    const startOfToday = getStartOfToday();
    
    // Default radius badhakar 10km (10000m) kar diya gaya hai
    const { lat, lng, radius = 10000 } = req.query; 

    // 🟢 FIXED: NaN Crash Protection
    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    let vendorPipeline = [];

    // 🟢 MAGIC: GeoNear Aggregation (Zomato Style)
    // Sirf tabhi chalega jab lat/lng exact numbers honge
    if (!isNaN(parsedLat) && !isNaN(parsedLng)) {
      vendorPipeline.push({
        $geoNear: {
          near: { type: "Point", coordinates: [parsedLng, parsedLat] }, 
          distanceField: "distance_in_meters", 
          maxDistance: parseInt(radius) || 10000, 
          query: { is_verified: true },
          spherical: true
        }
      });
    } else {
      // 🔴 FALLBACK: Agar GPS deny hua, normal fetch karo
      vendorPipeline.push({ $match: { is_verified: true } });
    }

    // 🟢 FIXED: `location: 1` add kiya taaki frontend pe Google Maps khul sake!
    vendorPipeline.push({
      $project: { 
        shop_name: 1, 
        qr_id: 1, 
        is_open: 1, 
        shop_type: 1, 
        distance_in_meters: 1, 
        location: 1 
      }
    });

    const shops = await Vendor.aggregate(vendorPipeline);

    if (shops.length === 0) return res.json({ success: true, shops: [] });

    const shopIds = shops.map(shop => shop._id);

    const [activeCountsResult, avgTimesResult] = await Promise.all([
      Queue.aggregate([
        { $match: { vendor_id: { $in: shopIds }, status: { $in: ['waiting', 'processing'] }, createdAt: { $gte: startOfToday } } },
        { $group: { _id: "$vendor_id", activeCount: { $sum: 1 } } }
      ]),
      Queue.aggregate([
        { $match: { vendor_id: { $in: shopIds }, status: 'completed', processedAt: { $exists: true }, createdAt: { $gte: startOfToday } } },
        { $project: { vendor_id: 1, serviceTimeMs: { $subtract: ["$updatedAt", "$processedAt"] } } },
        { $group: { _id: "$vendor_id", avgWaitMs: { $avg: "$serviceTimeMs" } } }
      ])
    ]);

    const activeCountMap = {};
    activeCountsResult.forEach(item => { activeCountMap[item._id.toString()] = item.activeCount; });

    const avgTimeMap = {};
    avgTimesResult.forEach(item => { 
      avgTimeMap[item._id.toString()] = Math.round((item.avgWaitMs || 0) / 60000); 
    });

    const shopsWithCount = shops.map(shop => {
      const shopIdStr = shop._id.toString();
      
      let distanceText = null;
      if (shop.distance_in_meters != null) {
         distanceText = (shop.distance_in_meters / 1000).toFixed(1) + " km"; 
      }

      return {
        ...shop,
        activeCount: activeCountMap[shopIdStr] || 0,
        avgTime: avgTimeMap[shopIdStr] || 5,
        distance: distanceText 
      };
    });

    res.json({ success: true, shops: shopsWithCount });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 7. Get Customer History
// ==========================================
exports.getCustomerHistory = async (req, res, next) => {
  try {
    const { phone: googleUID } = req.params; 

    const myHistory = await Queue.find({ googleUID: googleUID, hiddenFromCustomer: { $ne: true } })
      .sort({ createdAt: -1 })
      .lean(); 

    if (myHistory.length === 0) return res.json({ success: true, history: [] });

    const uniqueVendorIds = [...new Set(myHistory.map(item => item.vendor_id.toString()))];
    const vendors = await Vendor.find({ _id: { $in: uniqueVendorIds } })
      .select('shop_name qr_id is_open')
      .lean();

    const vendorMap = {};
    vendors.forEach(v => { vendorMap[v._id.toString()] = v; });

    const historyWithCount = myHistory.map(queueItem => {
      const shop = vendorMap[queueItem.vendor_id.toString()];
      return { 
        _id: queueItem._id, 
        qr_id: shop?.qr_id || 'unknown', 
        shop_name: shop?.shop_name || 'Deleted Shop',
        is_open: shop?.is_open || false, 
        token_number: queueItem.token_number,
        status: queueItem.status, 
        createdAt: queueItem.createdAt,
        graceEndTime: queueItem.graceEndTime
      };
    });

    res.json({ success: true, history: historyWithCount });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 8. Hide History Entry (Customer)
// ==========================================
exports.hideHistory = async (req, res, next) => {
  try {
    const { tokenId } = req.params;
    const { googleUID } = req.body; 

    if (!googleUID) return res.status(400).json({ success: false, message: 'Unauthorized action' });
    
    const updatedItem = await Queue.findOneAndUpdate(
      { _id: tokenId, googleUID: googleUID }, 
      { $set: { hiddenFromCustomer: true } },
      { new: true } 
    );

    if (!updatedItem) return res.status(404).json({ success: false, message: 'Record not found or you are not authorized' });

    res.status(200).json({ success: true, message: 'Hidden successfully' });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 9. Cancel Token (Customer)
// ==========================================
exports.cancelToken = async (req, res, next) => {
  try {
    const { qr_id, token_number, customer_phone: googleUID } = req.body;
    
    const vendor = await Vendor.findOne({ qr_id }).lean();
    if (!vendor) return res.status(404).json({ success: false, message: 'Shop not found' });

    const startOfToday = getStartOfToday();

    const cancelledToken = await Queue.findOneAndUpdate(
      {
        vendor_id: vendor._id,
        token_number: Number(token_number),
        googleUID: googleUID, 
        status: { $in: ['waiting', 'skipped'] },
        createdAt: { $gte: startOfToday }
      },
      { 
        $set: { status: 'cancelled_by_customer', graceEndTime: null, updatedAt: new Date() } 
      },
      { new: true } 
    );

    if (!cancelledToken) return res.status(400).json({ success: false, message: 'Token not found or already processed' });

    const io = req.app.get('socketio');
    if (io) {
      io.emit(`vendor_${vendor._id}`, { 
        action: 'refresh',
        message: `Token #${token_number} was cancelled by the customer.`
      });
    }

    res.json({ success: true, message: 'Token cancelled successfully' });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// 10. Generate WALK-IN Token (Vendor Panel)
// ==========================================
exports.addWalkInToken = async (req, res, next) => {
  try {
    const vendor_id = req.vendor.vendorId; 
    const { customer_name } = req.body; 
    const startOfToday = getStartOfToday();

    const vendor = await Vendor.findById(vendor_id).lean();
    if (!vendor) return res.status(404).json({ success: false, message: 'Shop not found' });
    if (vendor.is_open === false) return res.status(403).json({ success: false, message: 'Shop closed!' });

    const now = new Date();

    let updatedVendor = await Vendor.findOneAndUpdate(
      { _id: vendor._id, 'stats.last_reset': { $gte: startOfToday } },
      { $inc: { 'stats.daily_token_count': 1 }, $set: { 'stats.last_reset': now } },
      { new: true }
    );

    if (!updatedVendor) {
      updatedVendor = await Vendor.findOneAndUpdate(
        { _id: vendor._id, 'stats.last_reset': { $lt: startOfToday } },
        { $set: { 'stats.daily_token_count': 1, 'stats.last_reset': now } },
        { new: true }
      );
      if (!updatedVendor) {
        updatedVendor = await Vendor.findOneAndUpdate(
          { _id: vendor._id },
          { $inc: { 'stats.daily_token_count': 1 } },
          { new: true }
        );
      }
    }

    const nextTokenNumber = updatedVendor.stats.daily_token_count;

    const newQueueItem = new Queue({
      vendor_id: vendor._id,
      customer_name: customer_name || 'Walk-in Customer',
      token_number: nextTokenNumber,
      status: 'waiting',
      hiddenFromCustomer: false 
    });
    await newQueueItem.save();

    const io = req.app.get('socketio');
    if (io) {
      io.emit(`vendor_${vendor._id}`, { action: 'refresh' });
      io.emit('queueUpdate'); 
    }

    res.status(201).json({ success: true, token_number: nextTokenNumber, message: 'Walk-in token generated!' });
  } catch (error) {
    next(error);
  }
};
const Queue = require('../models/Queue');
const Vendor = require('../models/Vendor');
const Customer = require('../models/Customer');

// Helper function to get 00:00:00 of today
const getStartOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// UPGRADED SMART HELPER: Cleans up 15-minute old skipped tokens AND yesterday's stuck tokens
const autoCleanStuckTokens = async () => {
  try {
    const now = new Date();
    const startOfToday = getStartOfToday();

    // 1. Expire skipped tokens that are older than 15 minutes
    await Queue.updateMany(
      { status: 'skipped', graceEndTime: { $lte: now } },
      { $set: { status: 'expired' } }
    );

    // 2. Clean up yesterday's (old) remaining waiting/processing/skipped tokens
    await Queue.updateMany(
      { 
        status: { $in: ['waiting', 'processing', 'skipped'] }, 
        createdAt: { $lt: startOfToday } 
      },
      { $set: { status: 'expired' } }
    );
  } catch (error) {
    console.error("Auto Cleanup Error:", error);
  }
};

// ==========================================
// 1. Generate Token (Customer)
// ==========================================
exports.generateToken = async (req, res) => {
  try {
    // 1. Removed customer_phone from req.body
    const { qr_id, customer_name, googleUID } = req.body;
    const startOfToday = getStartOfToday();

    // Force googleUID check (Email ID is mandatory now)
    if (!googleUID) return res.status(400).json({ success: false, message: 'Google Login is required!' });

    const vendor = await Vendor.findOne({ qr_id });
    if (!vendor) return res.status(404).json({ success: false, message: 'Shop not found' });

    if (vendor.is_open === false) {
      return res.status(403).json({ success: false, message: 'This shop is currently closed! New tokens are not being accepted.' });
    }

    // SECURITY LAYER 1: Check active tokens strictly by googleUID
    let activeTokenQuery = {
      vendor_id: vendor._id,
      status: { $in: ['waiting', 'processing', 'skipped'] },
      createdAt: { $gte: startOfToday },
      googleUID: googleUID // Only using googleUID now
    };

    const activeTokenCheck = await Queue.findOne(activeTokenQuery);

    if (activeTokenCheck) {
      return res.status(400).json({ success: false, message: `You already have an active token (#${activeTokenCheck.token_number}) at this shop!` });
    }

    // SECURITY LAYER 2 (SPAM PROTECTION): Max 3 bookings per Email ID
    const dailyBookingsCount = await Queue.countDocuments({
      vendor_id: vendor._id,
      googleUID: googleUID,
      createdAt: { $gte: startOfToday }
    });
    if (dailyBookingsCount >= 3) {
        return res.status(403).json({ success: false, message: 'Your booking limit (max 3) for this shop today has been exhausted!' });
    }

    // CUSTOMER DATABASE UPDATE: Simplified (No phone fallback needed)
    let existingCustomer = await Customer.findOne({ googleUID });

    if (!existingCustomer) {
      existingCustomer = new Customer({ 
        googleUID: googleUID, 
        name: customer_name,
        is_verified: true 
      });
      await existingCustomer.save();
    }

    // TOKEN COUNTER LOGIC
    const now = new Date();
    const todayString = now.toDateString(); 
    const lastResetString = vendor.stats.last_reset ? new Date(vendor.stats.last_reset).toDateString() : "";

    let currentCount = vendor.stats.daily_token_count || 0;
    if (todayString !== lastResetString) currentCount = 0; 

    const nextTokenNumber = currentCount + 1;

    // SAVE NEW TOKEN TO DATABASE
    const newQueueItem = new Queue({
      vendor_id: vendor._id,
      googleUID: googleUID, 
      customer_name: customer_name || 'Walk-in',
      token_number: nextTokenNumber,
      status: 'waiting',
      hiddenFromCustomer: false 
      // customer_phone line permanently removed
    });
    await newQueueItem.save();

    await Vendor.findByIdAndUpdate(vendor._id, { 
      'stats.daily_token_count': nextTokenNumber,
      'stats.last_reset': now 
    });

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
    console.error("Generate Token Error:", error);
    res.status(500).json({ success: false, message: 'Server error' }); 
  }
};

// ==========================================
// 2. Toggle Shop Status (Vendor)
// ==========================================
exports.toggleStatus = async (req, res) => {
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
      io.emit('shop_status_changed', { message: 'Shop status updated' }); 
    }

    res.json({ success: true, message: "Status updated!" });
  } catch (err) {
    res.status(500).json({ success: false });
  }
};

// ==========================================
// 3. Get Live Queue (Vendor Dashboard)
// ==========================================
exports.getLiveQueue = async (req, res) => {
  try {
    await autoCleanStuckTokens(); 

    const vendor_id = req.vendor.vendorId; 
    const vendorInfo = await Vendor.findById(vendor_id);
    const startOfToday = getStartOfToday();

    const activeQueue = await Queue.find({
      vendor_id,
      status: { $in: ['waiting', 'processing', 'skipped'] }, 
      createdAt: { $gte: startOfToday }
    }).sort({ token_number: 1 });

    const totalToday = await Queue.countDocuments({ 
      vendor_id, createdAt: { $gte: startOfToday } 
    });

    const completedToday = await Queue.find({
      vendor_id: vendor_id, 
      status: 'completed',
      processedAt: { $exists: true },
      createdAt: { $gte: startOfToday }
    });

    let avgServiceTime = 15; 
    if (completedToday.length > 0) {
      const totalServiceTimeMs = completedToday.reduce((acc, t) => {
        return acc + (new Date(t.updatedAt) - new Date(t.processedAt));
      }, 0);
      avgServiceTime = Math.round((totalServiceTimeMs / completedToday.length) / 60000) || 15;
    }

    res.json({ 
      success: true, 
      count: activeQueue.length, 
      data: activeQueue, 
      stats: { totalToday, avgWait: avgServiceTime }, 
      vendorDetails: vendorInfo ? { 
        _id: vendorInfo._id, shop_name: vendorInfo.shop_name, qr_id: vendorInfo.qr_id, is_open: vendorInfo.is_open 
      } : null
    });
  } catch (error) { 
    console.error("Live fetch error:", error);
    res.status(500).json({ success: false, message: 'Server error' }); 
  }
};

// ==========================================
// 4. Update Token Status (Vendor)
// ==========================================
exports.updateStatus = async (req, res) => {
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
        token_id, updateFields, { returnDocument: 'after' }
    );

    if (!updatedToken) return res.status(404).json({ success: false, message: 'Token not found' });
    
    const io = req.app.get('socketio');
    if (io) {
        io.emit('queueUpdate'); 
        io.emit(`vendor_${updatedToken.vendor_id}`, { action: 'refresh', status: new_status });
    }

    res.json({ success: true, data: updatedToken });
  } catch (error) { 
      res.status(500).json({ success: false, message: 'Server error' }); 
  }
};

// ==========================================
// 5. Get Public Status (Customer Tracking)
// ==========================================
exports.getPublicStatus = async (req, res) => {
  try {
    await autoCleanStuckTokens(); 

    const { qr_id } = req.params;
    const vendor = await Vendor.findOne({ qr_id });
    if (!vendor) return res.status(404).json({ success: false, message: 'Shop not found' });

    const startOfToday = getStartOfToday();
    const activeQueue = await Queue.find({
      vendor_id: vendor._id,
      status: { $in: ['waiting', 'processing'] },
      createdAt: { $gte: startOfToday }
    }).sort({ token_number: 1 });

    const completedToday = await Queue.find({
      vendor_id: vendor._id,
      status: 'completed',
      processedAt: { $exists: true },
      createdAt: { $gte: startOfToday }
    });

    let avgServiceTime = 15; 
    if (completedToday.length > 0) {
      const totalServiceTimeMs = completedToday.reduce((acc, t) => {
        return acc + (new Date(t.updatedAt) - new Date(t.processedAt));
      }, 0);
      avgServiceTime = Math.round((totalServiceTimeMs / completedToday.length) / 60000) || 15;
    }

    res.json({ 
      success: true, shop_name: vendor.shop_name,
      currently_serving: activeQueue.find(q => q.status === 'processing')?.token_number || null,
      full_queue: activeQueue, avgWaitTime: avgServiceTime 
    });
  } catch (err) { 
      console.error("Public fetch error:", err);
      res.status(500).json({ success: false, message: 'Server error' }); 
  }
};

// ==========================================
// 6. Get All Shops (Customer Homepage)
// ==========================================
exports.getAllShops = async (req, res) => {
  try {
    await autoCleanStuckTokens(); 

    // Selecting shop type as well for filtering purposes
    const shops = await Vendor.find({ is_verified: true }).select('shop_name qr_id is_open shop_type');
    const startOfToday = getStartOfToday();
    
    const shopsWithCount = await Promise.all(shops.map(async (shop) => {
      // 1. In-Line Customers Count
      const activeCount = await Queue.countDocuments({
        vendor_id: shop._id,
        status: { $in: ['waiting', 'processing'] },
        createdAt: { $gte: startOfToday }
      });

      // 2. DYNAMIC AVG TIME CALCULATION
      // Fetching the last 5 completed tokens of today for this shop
      const completedTokens = await Queue.find({
        vendor_id: shop._id,
        status: 'completed',
        createdAt: { $gte: startOfToday }
      }).sort({ updatedAt: -1 }).limit(5);

      let avgTime = 5; // Default wait time (5 min) if no customer has been served yet

      if (completedTokens.length > 0) {
        let totalServiceTime = 0;
        
        completedTokens.forEach(token => {
          // Time taken from token creation (createdAt) to completion (updatedAt) in milliseconds
          const timeDiffInMs = new Date(token.updatedAt) - new Date(token.createdAt);
          totalServiceTime += Math.round(timeDiffInMs / 60000); // Convert to minutes
        });
        
        // Calculate average (Using Math.max(1, ...) to ensure time is never 0)
        avgTime = Math.max(1, Math.round(totalServiceTime / completedTokens.length)); 
      }

      // Return both activeCount and avgTime in the shop data
      return { ...shop._doc, activeCount, avgTime };
    }));

    res.json({ success: true, shops: shopsWithCount });
  } catch (error) {
    console.error("Error in getAllShops:", error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==========================================
// 7. Get Customer History
// ==========================================
exports.getCustomerHistory = async (req, res) => {
  try {
    await autoCleanStuckTokens(); 

    // The 'phone' parameter can now also receive a Google UID
    const { phone } = req.params; 

    // FIX: Using MongoDB $or operator to check both fields
    const myHistory = await Queue.find({
      $or: [
        { customer_phone: phone },
        { googleUID: phone } // The 'phone' variable now contains the UID
      ],
      hiddenFromCustomer: { $ne: true } 
    }).sort({ createdAt: -1 });

    const historyWithCount = await Promise.all(myHistory.map(async (queueItem) => {
      const shop = await Vendor.findById(queueItem.vendor_id).select('shop_name qr_id is_open');
      
      return { 
        _id: queueItem._id, 
        qr_id: shop ? shop.qr_id : 'unknown', 
        shop_name: shop ? shop.shop_name : 'Deleted Shop',
        is_open: shop ? shop.is_open : false, 
        token_number: queueItem.token_number,
        status: queueItem.status, 
        createdAt: queueItem.createdAt,
        graceEndTime: queueItem.graceEndTime
      };
    }));

    res.json({ success: true, history: historyWithCount });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};  

// ==========================================
// 8. Hide History Entry (Customer)
// ==========================================
exports.hideHistory = async (req, res) => {
  try {
    const { tokenId } = req.params;
    
    const queueItem = await Queue.findById(tokenId);
    if (!queueItem) {
      return res.status(404).json({ success: false, message: 'Record not found' });
    }

    queueItem.hiddenFromCustomer = true;
    await queueItem.save();

    res.status(200).json({ success: true, message: 'Hidden successfully' });
  } catch (error) {
    console.error("Hide History Error:", error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==========================================
// 9. Cancel Token (Customer)
// ==========================================
exports.cancelToken = async (req, res) => {
  try {
    // Here customer_phone might also receive a UID from the frontend
    const { qr_id, token_number, customer_phone } = req.body;
    
    const vendor = await Vendor.findOne({ qr_id });
    if (!vendor) return res.status(404).json({ success: false, message: 'Shop not found' });

    const startOfToday = getStartOfToday();

    // UPDATED QUERY: Use $or to check both Phone OR UID
    const deletedToken = await Queue.findOneAndDelete({
      vendor_id: vendor._id,
      token_number: Number(token_number),
      $or: [
        { customer_phone: customer_phone }, // Old phone number check
        { googleUID: customer_phone }       // New UID check (UID is coming in this field from the frontend)
      ],
      status: { $in: ['waiting', 'skipped'] },
      createdAt: { $gte: startOfToday }
    });

    if (!deletedToken) {
      return res.status(400).json({ success: false, message: 'Token not found or has already been processed' });
    }

    const io = req.app.get('socketio');
    if (io) io.emit(`vendor_${vendor._id}`, { action: 'refresh' });

    res.json({ success: true, message: 'Token cancelled successfully' });
  } catch (err) {
    console.error("Cancel Error:", err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// ==========================================
// 10. Generate WALK-IN Token (Vendor Panel)
// ==========================================
exports.addWalkInToken = async (req, res) => {
  try {
    const vendor_id = req.vendor.vendorId; // Extracting from Auth middleware
    const { customer_name, customer_phone } = req.body;
    const startOfToday = getStartOfToday();

    const vendor = await Vendor.findById(vendor_id);
    if (!vendor) return res.status(404).json({ success: false, message: 'Shop not found' });

    if (vendor.is_open === false) {
      return res.status(403).json({ success: false, message: 'The shop is currently closed, please open the shop first!' });
    }

    // TOKEN COUNTER LOGIC
    const now = new Date();
    const todayString = now.toDateString(); 
    const lastResetString = vendor.stats.last_reset ? new Date(vendor.stats.last_reset).toDateString() : "";

    let currentCount = vendor.stats.daily_token_count || 0;
    if (todayString !== lastResetString) currentCount = 0; 

    const nextTokenNumber = currentCount + 1;

    // SAVE NEW WALK-IN TOKEN TO DATABASE
    const newQueueItem = new Queue({
      vendor_id: vendor._id,
      customer_name: customer_name || 'Walk-in Customer',
      customer_phone: customer_phone || '0000000000',
      token_number: nextTokenNumber,
      status: 'waiting',
      hiddenFromCustomer: false 
    });
    await newQueueItem.save();

    // Update shop's token count
    await Vendor.findByIdAndUpdate(vendor._id, { 
      'stats.daily_token_count': nextTokenNumber,
      'stats.last_reset': now 
    });

    // Send notification to the live screen
    const io = req.app.get('socketio');
    if (io) {
      io.emit(`vendor_${vendor._id}`, { action: 'refresh' });
      io.emit('queueUpdate'); // To refresh timings for other people
    }

    res.status(201).json({ success: true, token_number: nextTokenNumber, message: 'Walk-in token generated!' });
  } catch (error) {
    console.error("Walk-in Token Error:", error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
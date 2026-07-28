const Vendor = require('../models/Vendor');
const Queue = require('../models/Queue');
const mongoose = require('mongoose'); 
const logger = require('../config/logger'); // 🟢 FIXED: Path is now correct according to your folder structure
const moment = require('moment-timezone'); // 🟢 IST Timezone helper

// HELPER: Gets 00:00:00 of today strictly in India Time (IST)
const getStartOfToday = () => {
  return moment.tz("Asia/Kolkata").startOf('day').toDate();
};

// ==========================================
// 1. Register Vendor (🟢 FIXED: Schema Validation Mismatch)
// Note: Normally authController is handling registration, but if you use this directly, it's now safe.
// ==========================================
exports.register = async (req, res, next) => {
  try {
    // 🟢 ADDED: googleUID, email, and shop_type to prevent Mongoose Validation Crash
    const { googleUID, email, shop_name, phone, qr_id, shop_type } = req.body;
    
    const vendorExists = await Vendor.findOne({ $or: [{ phone }, { email }, { googleUID }] }).lean();
    if (vendorExists) {
      return res.status(400).json({ success: false, message: 'Vendor with this Phone, Email, or GoogleUID already exists!' });
    }
    
    const vendor = new Vendor({ 
      googleUID, 
      email, 
      shop_name, 
      phone, 
      qr_id, 
      shop_type // Required as per your Vendor.js schema
    });
    
    await vendor.save();
    
    res.status(201).json({ success: true, message: 'Vendor registered successfully!' });
  } catch (error) {
    logger.error(`[REGISTER ERROR]: ${error.message}`);
    next(error);
  }
};

// ==========================================
// 2. Toggle Status (Solid Logic)
// ==========================================
exports.toggleStatus = async (req, res, next) => {
  try {
    const vendor_id = req.vendor?.vendorId || req.vendorId; // Hybrid safety

    // Excellent use of Aggregation Pipeline in update to toggle boolean!
    const vendor = await Vendor.findByIdAndUpdate(
      vendor_id, 
      [ { $set: { is_open: { $not: "$is_open" } } } ], 
      { new: true }
    );
    
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found!' });
    }
    
    res.json({ 
      success: true, 
      is_open: vendor.is_open, 
      message: `Shop is now ${vendor.is_open ? 'OPEN' : 'CLOSED'}.` 
    });
  } catch (error) {
    logger.error(`[TOGGLE STATUS ERROR]: ${error.message}`);
    next(error);
  }
};

// ==========================================
// 3. Get Analytics (🟢 FIXED: Ghost fields & Timezone)
// ==========================================
exports.getAnalytics = async (req, res, next) => {
  try {
    const vendor_id = req.vendor?.vendorId || req.vendorId;
    const startOfToday = getStartOfToday(); 

    const vendorObjectId = new mongoose.Types.ObjectId(vendor_id);

    const stats = await Queue.aggregate([
      {
        $match: {
          vendor_id: vendorObjectId, 
          createdAt: { $gte: startOfToday }
        }
      },
      {
        $group: {
          _id: null,
          total_footfall: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          
          // ⚠️ WARNING: 'is_paid' and 'total_amount' do NOT exist in Queue.js model yet.
          // I have left the logic intact just in case you plan to add them to Queue.js later.
          // Otherwise, it will safely return 0 without crashing.
          totalEarnings: { $sum: { $cond: [{ $eq: ["$is_paid", true] }, "$total_amount", 0] } }
        }
      }
    ]);

    const data = stats.length > 0 ? stats[0] : { total_footfall: 0, completed: 0, totalEarnings: 0 };

    res.json({
      success: true,
      data: {
        // 🟢 FIXED: Using moment.js to strictly format date in IST, avoiding server UTC bugs
        date: moment.tz("Asia/Kolkata").format('DD/MM/YYYY'), 
        total_footfall: data.total_footfall,
        completed: data.completed,
        revenue: `₹${data.totalEarnings || 0}` // Will be ₹0 until Queue model is updated with payment fields
      }
    });
  } catch (error) {
    logger.error(`[ANALYTICS ERROR]: ${error.message}`);
    next(error);
  }
};
const Vendor = require('../models/Vendor');
const Queue = require('../models/Queue'); // We will create this model later

// PRO TIP: We have already created a robust OTP-based 'signup' in 'authController.js'. 
// Therefore, this 'register' function might not be needed anymore. However, it has been kept error-free for now.
exports.register = async (req, res, next) => {
  try {
    const { shop_name, phone, qr_id } = req.body;
    let vendor = await Vendor.findOne({ phone });
    if (vendor) return res.status(400).json({ success: false, message: 'Number already exists!' });
    
    vendor = new Vendor({ shop_name, phone, qr_id });
    await vendor.save();
    res.status(201).json({ success: true, message: 'Vendor registered successfully!' });
  } catch (error) {
    next(error); // Global Error Handler
  }
};

exports.toggleStatus = async (req, res, next) => {
  try {
    // FIX: Used req.vendorId instead of req.vendor.vendorId
    const vendor = await Vendor.findById(req.vendorId);
    
    if (!vendor) {
      return res.status(404).json({ success: false, message: 'Vendor not found!' });
    }

    // Toggle the status (True to False, False to True)
    vendor.is_open = !vendor.is_open;
    await vendor.save();
    
    res.json({ 
      success: true, 
      is_open: vendor.is_open, 
      message: `Shop is now ${vendor.is_open ? 'OPEN' : 'CLOSED'}.` 
    });
  } catch (error) {
    next(error);
  }
};

exports.getAnalytics = async (req, res, next) => {
  try {
    // FIX: Applied req.vendorId
    const vendorId = req.vendorId;
    const startOfToday = new Date();
    
    // Resetting time in JS dates (setting to Midnight) - Perfect for daily analytics
    startOfToday.setHours(0, 0, 0, 0); 

    const todayOrders = await Queue.find({
      vendor_id: vendorId,
      createdAt: { $gte: startOfToday }
    });

    let totalOrders = todayOrders.length;
    let completedOrders = 0;
    let totalEarnings = 0;

    todayOrders.forEach(order => {
      if (order.status === 'completed') completedOrders++;
      // This logic will work perfectly once payments are integrated
      if (order.is_paid === true) totalEarnings += order.total_amount;
    });

    res.json({
      success: true,
      data: {
        date: new Date().toLocaleDateString('en-IN'), // Indian format (DD/MM/YYYY)
        total_footfall: totalOrders,
        completed: completedOrders,
        revenue: `₹${totalEarnings}`
      }
    });
  } catch (error) {
    next(error);
  }
};
const jwt = require('jsonwebtoken');
const Vendor = require('../models/Vendor');
const logger = require('../config/logger'); // 🟢 CRITICAL FIX: Logger import kiya taaki server crash na ho

// 1. Admin Login API
exports.adminLogin = (req, res, next) => {
  try {
    const { username, password } = req.body;

    // 🟢 SECURITY FIX 1: Blank payload block kiya (undefined === undefined se bachne ke liye)
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required!' });
    }

    // 🟢 SECURITY FIX 2: Check kiya ki ENV mein admin credentials set hain ya nahi
    if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
      logger.error('🔥 [FATAL] Admin credentials missing in environment variables!');
      return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }

    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
      
      if (!process.env.JWT_SECRET) {
        logger.error('🔥 [FATAL] JWT_SECRET missing in environment variables!');
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
      }

      // 🟢 SECURITY FIX 3: Removed 'Qzkip' hardcoded fallback
      const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1d' });
      
      logger.info('✅ [ADMIN] Admin logged in successfully.');
      return res.status(200).json({ success: true, message: 'Welcome, Admin!', token });
    }
    
    logger.warn(`🛑 [ADMIN] Failed login attempt with username: ${username}`);
    return res.status(401).json({ success: false, message: 'Invalid Username or Password!' });
  } catch (error) {
    next(error); // 🟢 FIXED: Bheja gaya global error handler ko
  }
};

// 2. Fetch pending AND rejected vendors
exports.getPendingVendors = async (req, res, next) => {
  try {
    // 🟢 FIXED: Added .lean() for faster database read
    const pendingVendors = await Vendor.find({ status: { $in: ['pending', 'rejected'] } })
      .select('-googleUID')
      .lean();
      
    res.status(200).json({ success: true, count: pendingVendors.length, data: pendingVendors });
  } catch (error) {
    next(error); 
  }
};

// 3. API to approve a vendor
exports.approveVendor = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const vendor = await Vendor.findByIdAndUpdate(vendorId, { is_verified: true, status: 'approved' }, { new: true });

    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });
    
    logger.info(`✅ [ADMIN] Vendor Approved: ${vendor.shop_name}`);
    res.status(200).json({ success: true, message: `${vendor.shop_name} has been successfully approved!` });
  } catch (error) {
    next(error);
  }
};

// 4. API to REJECT a vendor (Soft Reject - Allows Re-apply)
exports.rejectVendor = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const vendor = await Vendor.findByIdAndUpdate(vendorId, { is_verified: false, status: 'rejected' }, { new: true });
    
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    logger.warn(`🛑 [ADMIN] Vendor Rejected: ${vendor.shop_name}`);
    res.status(200).json({ success: true, message: `${vendor.shop_name} has been rejected. They can re-apply.` });
  } catch (error) {
    next(error);
  }
};

// 5. API to DELETE a spammer (Hard Delete - Brahmastra 🗑️)
exports.deleteVendor = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const vendor = await Vendor.findByIdAndDelete(vendorId);
    
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    logger.warn(`🗑️ [ADMIN] Spammer Vendor Deleted: ID ${vendorId}`);
    res.status(200).json({ success: true, message: 'Spammer permanently deleted from database.' });
  } catch (error) {
    next(error);
  }
};
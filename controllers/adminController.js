const jwt = require('jsonwebtoken');
const Vendor = require('../models/Vendor');
const logger = require('../config/logger'); 

// ==========================================
// 1. ADMIN LOGIN API
// ==========================================
exports.adminLogin = (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required!' });
    }

    if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD) {
      logger.error('🔥 [FATAL] Admin credentials missing in environment variables!');
      return res.status(500).json({ success: false, message: 'Internal Server Error' });
    }

    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
      if (!process.env.JWT_SECRET) {
        logger.error('🔥 [FATAL] JWT_SECRET missing in environment variables!');
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
      }

      const token = jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1d' });
      
      logger.info('✅ [ADMIN] Admin logged in successfully.');
      return res.status(200).json({ success: true, message: 'Welcome, Admin!', token });
    }
    
    logger.warn(`🛑 [ADMIN] Failed login attempt with username: ${username}`);
    return res.status(401).json({ success: false, message: 'Invalid Username or Password!' });
  } catch (error) {
    next(error); 
  }
};

// ==========================================
// 2. FETCH PENDING & REJECTED VENDORS
// ==========================================
exports.getPendingVendors = async (req, res, next) => {
  try {
    const pendingVendors = await Vendor.find({ status: { $in: ['pending', 'rejected'] } })
      .select('-googleUID')
      .lean();
      
    res.status(200).json({ success: true, count: pendingVendors.length, data: pendingVendors });
  } catch (error) {
    next(error); 
  }
};

// ==========================================
// 🟢 3. NEW: FETCH ACTIVE/APPROVED VENDORS (GOD MODE)
// ==========================================
exports.getActiveVendors = async (req, res, next) => {
  try {
    const activeVendors = await Vendor.find({ status: 'approved' })
      .select('-googleUID')
      .sort({ createdAt: -1 }) // Naye approved vendors upar dikhenge
      .lean();
      
    res.status(200).json({ success: true, count: activeVendors.length, data: activeVendors });
  } catch (error) {
    next(error); 
  }
};

// ==========================================
// 4. APPROVE A VENDOR
// ==========================================
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

// ==========================================
// 5. REJECT A VENDOR (Soft Reject)
// ==========================================
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

// ==========================================
// 🟢 6. UPDATED: DELETE VENDOR (Hard Delete - Brahmastra 🗑️)
// ==========================================
exports.deleteVendor = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const vendor = await Vendor.findByIdAndDelete(vendorId);
    
    if (!vendor) return res.status(404).json({ success: false, message: 'Vendor not found' });

    // 💡 PRO TIP: Agar future mein "Queue" ya "Tokens" ka model banega, 
    // toh humein unhe bhi yahan delete karna padega taaki junk data jama na ho.
    // Example: await Token.deleteMany({ vendorId: vendorId });

    logger.warn(`🗑️ [ADMIN] Spammer/Vendor Deleted: ${vendor.shop_name} (ID: ${vendorId})`);
    res.status(200).json({ success: true, message: `${vendor.shop_name} permanently deleted from database.` });
  } catch (error) {
    next(error);
  }
};
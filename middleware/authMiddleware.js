const jwt = require('jsonwebtoken');
const Vendor = require('../models/Vendor'); 
const logger = require('../config/logger'); // 🟢 ADDED: Winston logger for production

const protect = async (req, res, next) => { 
  // 1. EXTRACT TOKEN (Hybrid Approach)
  let token = req.cookies?.vendorToken; 

  if (!token) {
    const authHeader = req.header('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access Denied. Session missing, please login first.' 
    });
  }

  // 2. 🟢 STRICT SECRET CHECK (Removed 'Qzkip' fallback)
  if (!process.env.JWT_SECRET) {
    logger.error('🔥 [FATAL ERROR] JWT_SECRET is missing in environment variables!');
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }

  try {
    // 3. Verify the token
    const verified = jwt.verify(token, process.env.JWT_SECRET); 
    
    // 4. 🟢 MAGICAL FIX: Performance Optimized Database Query
    // .select() se sirf zaroori data aayega aur .lean() se query 3x fast ho jayegi
    const vendor = await Vendor.findById(verified.vendorId || verified.id)
      .select('_id status')
      .lean();
    
    if (!vendor) {
      res.clearCookie('vendorToken', { httpOnly: true, secure: true, sameSite: 'None' });
      return res.status(401).json({ 
        success: false, 
        message: 'Shop not found in the database. Please create a new account or login again.' 
      });
    }

    // 5. 🟢 CRITICAL SECURITY FIX: Rejected/Banned Vendor Check
    if (vendor.status === 'rejected') {
      res.clearCookie('vendorToken', { httpOnly: true, secure: true, sameSite: 'None' });
      logger.warn(`🛑 [SECURITY] Blocked access for REJECTED vendor ID: ${vendor._id}`);
      return res.status(403).json({ 
        success: false, 
        message: 'Your account has been suspended or rejected by the admin. Access denied.' 
      });
    }

    // 6. Pass the ID to the controller in the correct format
    req.vendor = { vendorId: vendor._id }; 
    
    next(); 
  } catch (error) {
    // 7. 🟢 BETTER ERROR LOGGING
    if (error.name === 'TokenExpiredError') {
      logger.info('⏳ [AUTH] Session expired for a vendor.');
    } else {
      logger.error(`❌ [AUTH VERIFICATION ERROR]: ${error.message}`);
    }

    res.clearCookie('vendorToken', { httpOnly: true, secure: true, sameSite: 'None' });
    res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired session. Please login again.' 
    });
  }
};

module.exports = { protect };
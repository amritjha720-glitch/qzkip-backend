const jwt = require('jsonwebtoken');
const logger = require('../config/logger'); // 🟢 ADDED: Security tracking ke liye logger

const adminAuth = (req, res, next) => {
  const authHeader = req.header('Authorization');

  // 1. Token Missing Check
  if (!authHeader) {
    logger.warn('🔒 [ADMIN ALERT] Access blocked: No token provided in header.');
    return res.status(401).json({ success: false, message: 'No token, access denied' });
  }

  // 2. Strict Environment Variable Check (🟢 FIXED: Failsafe mechanism)
  if (!process.env.JWT_SECRET) {
    logger.error('🔥 [FATAL] JWT_SECRET is missing in environment variables!');
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }

  try {
    const actualToken = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
    
    // 3. Removed Hardcoded Fallback (🟢 FIXED: 100% Secure validation)
    const decoded = jwt.verify(actualToken, process.env.JWT_SECRET);
    
    // 4. Role Validation
    if (decoded.role !== 'admin') {
      logger.warn(`🛑 [ADMIN ALERT] Unauthorized access attempt by role: ${decoded.role}`);
      return res.status(403).json({ success: false, message: 'Admin privileges required! Access denied.' });
    }

    // 5. Attach payload for downstream controllers (🟢 FIXED: Pass data to next)
    req.admin = decoded;

    next(); 
  } catch (err) {
    // 6. Granular Error Handling (🟢 FIXED: Expired vs Invalid)
    if (err.name === 'TokenExpiredError') {
      logger.info('⏳ [ADMIN ALERT] Admin token expired.');
      return res.status(401).json({ success: false, message: 'Token has expired. Please login again.' });
    }
    
    logger.error(`❌ [ADMIN ALERT] Invalid token used: ${err.message}`);
    return res.status(401).json({ success: false, message: 'Token is invalid' });
  }
};

module.exports = adminAuth;
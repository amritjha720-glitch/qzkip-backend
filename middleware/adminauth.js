const jwt = require('jsonwebtoken');

const adminAuth = (req, res, next) => {
  const token = req.header('Authorization');

  if (!token) {
    return res.status(401).json({ success: false, message: 'No token, access denied' });
  }

  try {
    const actualToken = token.startsWith('Bearer ') ? token.split(' ')[1] : token;
    const decoded = jwt.verify(actualToken, process.env.JWT_SECRET || 'SmartQueue_Secret');
    
    // Core validation: Check if the token belongs to an admin role
    if (decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin privileges required! Access denied.' });
    }

    next(); // Proceed to the next middleware
  } catch (err) {
    res.status(401).json({ success: false, message: 'Token is invalid' });
  }
};

module.exports = adminAuth;

// Dummy change
const jwt = require('jsonwebtoken');
const Vendor = require('../models/Vendor'); // NEW: Imported the model for database verification

const protect = async (req, res, next) => { // NEW: Added async to enable the use of await
  // 1. Extract the token
  const token = req.header('Authorization');

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access Denied. Token is missing, please login first.' 
    });
  }

  try {
    const actualToken = token.startsWith('Bearer ') ? token.split(' ')[1] : token;
    
    // 2. Verify the token
    const verified = jwt.verify(actualToken, process.env.JWT_SECRET || 'SmartQueue_Secret');
    
    // 3. THE ULTIMATE FIX: Verify against the database
    // Checking if the ID within the token corresponds to an actual shop in the database
    const vendor = await Vendor.findById(verified.vendorId || verified.id);
    
    if (!vendor) {
      return res.status(401).json({ 
        success: false, 
        message: 'Shop not found in the database. Please create a new account or login again.' 
      });
    }

    // 4. Pass the ID to the controller in the correct format (To prevent crashes at Line 126)
    req.vendor = { vendorId: vendor._id }; 
    
    next(); 
  } catch (error) {
    console.error('Token Verification Error:', error.message);
    res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired token. Please login again.' 
    });
  }
};

module.exports = { protect };
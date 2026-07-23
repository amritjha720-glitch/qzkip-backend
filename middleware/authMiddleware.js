const jwt = require('jsonwebtoken');
const Vendor = require('../models/Vendor'); 

const protect = async (req, res, next) => { 
  // 1. 🟢 EXTRACT TOKEN (Hybrid Approach: First check Cookie, then Header)
  let token = req.cookies?.vendorToken; // Try getting token from HttpOnly Cookie

  if (!token) {
    // Backup: If cookie isn't there, check the Authorization header
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

  try {
    // 2. Verify the token
    const verified = jwt.verify(token, process.env.JWT_SECRET || 'Qzkip'); // Match default secret with authController
    
    // 3. Verify against the database
    // Checking if the ID within the token corresponds to an actual shop in the database
    const vendor = await Vendor.findById(verified.vendorId || verified.id);
    
    if (!vendor) {
      // 🟢 FIX: Agar vendor nahi mila toh kachra cookie saaf kar do
      res.clearCookie('vendorToken', { httpOnly: true, secure: true, sameSite: 'None' });
      return res.status(401).json({ 
        success: false, 
        message: 'Shop not found in the database. Please create a new account or login again.' 
      });
    }

    // 4. Pass the ID to the controller in the correct format
    req.vendor = { vendorId: vendor._id }; 
    
    next(); 
  } catch (error) {
    console.error('Token Verification Error:', error.message);
    // 🟢 FIX: Token expire hone par apne aap cookie delete ho jayegi
    res.clearCookie('vendorToken', { httpOnly: true, secure: true, sameSite: 'None' });
    res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired session. Please login again.' 
    });
  }
};

module.exports = { protect };
const jwt = require('jsonwebtoken');
const Customer = require('../models/Customer');

// ==========================================
// 1. Send OTP (With Layer 2 Security)
// ==========================================
exports.sendOtp = async (req, res, next) => {
  try {
    const { phone, mode } = req.body;
    if (!phone) return res.status(400).json({ success: false, message: 'Phone number is required' });
    
    let customer = await Customer.findOne({ phone });
    
    if (mode === 'login' && !customer) {
      return res.status(404).json({ success: false, message: 'Account not found. Please Sign Up first.' });
    }
    if (mode === 'signup' && customer && customer.is_verified) {
      return res.status(400).json({ success: false, message: 'Account already exists. Please Log In.' });
    }

    // LAYER 2: Database Check (1 Minute Cooldown)
    if (customer && customer.last_otp_sent_at) {
      const timeDiff = Date.now() - customer.last_otp_sent_at.getTime();
      if (timeDiff < 60000) { // If less than 60,000 milliseconds (60s) have passed
        const timeLeft = Math.ceil((60000 - timeDiff) / 1000);
        return res.status(429).json({ 
          success: false, 
          message: `Please wait ${timeLeft} seconds!` 
        });
      }
    }

    // Generated a 6-digit OTP
    const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10-minute expiry
    
    if (!customer) {
      // Saved new customer to the database (currently unverified)
      customer = new Customer({ 
        phone, 
        otp: generatedOtp, 
        otp_expiry: otpExpiry,
        last_otp_sent_at: Date.now() // NEW: Recorded the timestamp
      });
    } else {
      // Updated OTP and timestamp for the existing customer
      customer.otp = generatedOtp;
      customer.otp_expiry = otpExpiry;
      customer.last_otp_sent_at = Date.now(); // NEW: Recorded the timestamp
    }
    await customer.save();
    
    console.log(`[CUSTOMER OTP] Phone: ${phone} | OTP: ${generatedOtp} | Mode: ${mode}`);
    res.json({ success: true, message: 'OTP sent successfully' });
    
  } catch (error) {
    next(error); // Global Error Handler
  }
};

// ==========================================
// 2. Verify OTP
// ==========================================
exports.verifyOtp = async (req, res, next) => {
  try {
    const { phone, otp, name, mode } = req.body;
    
    // Fetch customer from DB and explicitly request +otp
    const customer = await Customer.findOne({ phone }).select('+otp +otp_expiry');
    
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found!' });
    }

    if (customer.otp !== otp) {
      return res.status(400).json({ success: false, message: 'Incorrect OTP entered!' });
    }

    if (customer.otp_expiry < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP has expired, please request a new one.' });
    }

    // OTP Verified! Now clear the data and mark as verified
    customer.otp = undefined;
    customer.otp_expiry = undefined;
    // Note: No need to delete last_otp_sent_at, it will keep the previous record
    customer.is_verified = true;
    if (mode === 'signup' && name) customer.name = name; // Update name during signup
    await customer.save();

    // Including 'customerId' in the token to keep the backend uniform
    const token = jwt.sign(
      { customerId: customer._id, phone: customer.phone }, 
      process.env.JWT_SECRET || 'Qzkip_Secret', 
      { expiresIn: '30d' } 
    );
    
    return res.json({ 
      success: true, 
      message: 'Login successful', 
      token,
      customer: {
        id: customer._id,
        name: customer.name,
        phone: customer.phone
      }
    });

  } catch (error) {
    next(error);
  }
};
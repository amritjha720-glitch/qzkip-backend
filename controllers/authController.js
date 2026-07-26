const jwt = require('jsonwebtoken');
const crypto = require('crypto'); // 🟢 NAYA: Crypto package add kiya fast QR generation ke liye
const Vendor = require('../models/Vendor');

// ==========================================
// Helper Function: FAST Unique QR ID Generator (No Loop, No DB Call)
// ==========================================
const generateUniqueQRID = (shop_name) => {
  const cleanName = shop_name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 8);
  // 4 bytes = 8 random characters (e.g., 'a1b2c3d4'). Extremely rare chance of duplicate.
  const randomString = crypto.randomBytes(4).toString('hex');
  return `${cleanName}-${randomString}`;
};


// ==========================================
// 1. Google Auth (STRICT STATE CHECKER)
// ==========================================
exports.googleVendorAuth = async (req, res, next) => {
  try {
    const { googleUID, email } = req.body;

    let vendor = await Vendor.findOne({ $or: [{ email }, { googleUID }] });

    // SCENARIO 1: Vendor exist hi nahi karta
    if (!vendor) {
      console.log(`🟢 [AUTH] Naya User aagaya: ${email} -> Form dikhao`);
      return res.status(200).json({ success: true, action: 'SHOW_FORM' });
    }

    console.log(`🔍 [AUTH CHECK] Email: ${vendor.email} | DB Status: '${vendor.status}'`);

    // SCENARIO 2: Strict Rejected Check
    if (vendor.status === 'rejected') {
      console.log(`🔴 [AUTH] User Rejected hai -> Laal Page dikhao`);
      return res.status(200).json({ success: true, action: 'SHOW_REJECTED' });
    }

    // SCENARIO 3: Strict Approved Check
    if (vendor.status === 'approved' || vendor.is_verified === true) {
      console.log(`✅ [AUTH] User Approved hai -> Dashboard kholo`);

      // Token Generate kiya
      const token = jwt.sign({ vendorId: vendor._id }, process.env.JWT_SECRET || 'Qzkip', { expiresIn: '365d' });

      // 🔥 THE MAGIC FIX: Send Token directly into an HttpOnly Secure Cookie
      res.cookie('vendorToken', token, {
        httpOnly: true,    // Browser JavaScript (XSS) isko read nahi kar sakti
        secure: true,      // Hamesha 'true' rahega kyunki Vercel aur Render dono HTTPS hain
        sameSite: 'None',  // Cross-Origin request allow karne ke liye (Frontend Vercel -> Backend Render)
        maxAge: 365 * 24 * 60 * 60 * 1000 // 1 Saal tak login rahega
      });

      return res.status(200).json({
        success: true,
        action: 'LOGIN_SUCCESS',
        token, // Backward compatibility ke liye JSON mein bhi rakha hai
        vendor: { id: vendor._id, shop_name: vendor.shop_name, qr_id: vendor.qr_id, email: vendor.email }
      });
    }

    // SCENARIO 4: Agar Approved nahi, Rejected nahi, toh 100% Pending hai
    console.log(`🟡 [AUTH] User Pending hai -> Pila (Yellow) Page dikhao`);
    return res.status(200).json({ success: true, action: 'SHOW_PENDING' });

  } catch (error) {
    console.error("Backend Auth Error: ", error);
    next(error);
  }
};


// ==========================================
// 2. Complete Profile (KYC Submit & Re-apply)
// ==========================================
exports.completeVendorProfile = async (req, res, next) => {
  try {
    const { googleUID, email, name, shop_name, phone, document_type, document_number, shop_type } = req.body;

    let existingVendor = await Vendor.findOne({ email });

    if (existingVendor) {
      if (existingVendor.status === 'rejected') {

        const phoneCheck = await Vendor.findOne({ phone, email: { $ne: email } });
        if (phoneCheck) {
          return res.status(400).json({ success: false, message: 'This Phone Number is already in use by another shop.' });
        }

        await Vendor.findOneAndUpdate(
          { email: email },
          {
            $set: {
              shop_name: shop_name,
              phone: phone,
              shop_type: shop_type,
              kyc_details: { document_type, document_number },
              status: 'pending',
              is_verified: false
            }
          },
          { new: true }
        );

        console.log(`🟡 [FORM DB SUCCESS] User (${email}) Force Update HUA -> Ab strictly PENDING hai`);
        return res.status(200).json({ success: true, action: 'SHOW_PENDING', message: 'Profile re-submitted for verification.' });
      } else {
        return res.status(400).json({ success: false, message: 'This account is already registered.' });
      }
    }

    const phoneExists = await Vendor.findOne({ phone });
    if (phoneExists) {
      return res.status(400).json({ success: false, message: 'This Phone Number is already registered.' });
    }

    // 🟢 UPDATED: Ab function instantly ID generate karega bina await ke
    const unique_qr_id = generateUniqueQRID(shop_name);

    const vendor = new Vendor({
      googleUID, email, name, shop_name, phone,
      qr_id: unique_qr_id, shop_type,
      kyc_details: { document_type, document_number },
      is_verified: false,
      status: 'pending'
    });

    await vendor.save();
    console.log(`🟡 [FORM] Ekdum Naya User (${email}) Save Hua -> Status Pending hai`);
    res.status(201).json({ success: true, action: 'SHOW_PENDING', message: 'Profile submitted for verification.' });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Duplicate data error. Please check your details or try submitting again.' });
    }
    next(error);
  }
};


// ==========================================
// 3. Logout API (🔥 NAYA FUNCTION)
// ==========================================
// Frontend jab /logout par hit karega, toh hum yahan se cookie saaf kar denge
exports.logoutVendor = (req, res) => {
  res.clearCookie('vendorToken', {
    httpOnly: true,
    secure: true,
    sameSite: 'None'
  });
  console.log('🔴 [AUTH] Vendor Logged Out, Cookie Cleared');
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};
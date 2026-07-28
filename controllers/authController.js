const jwt = require('jsonwebtoken');
const crypto = require('crypto'); 
const Vendor = require('../models/Vendor');
const logger = require('../config/logger'); // 🟢 CRITICAL FIX: Winston logger import kiya

// ==========================================
// Helper Function: FAST Unique QR ID Generator
// ==========================================
const generateUniqueQRID = (shop_name) => {
  const cleanName = shop_name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 8);
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

    if (!vendor) {
      logger.info(`🟢 [AUTH] Naya User aagaya: ${email} -> Form dikhao`);
      return res.status(200).json({ success: true, action: 'SHOW_FORM' });
    }

    logger.info(`🔍 [AUTH CHECK] Email: ${vendor.email} | DB Status: '${vendor.status}'`);

    if (vendor.status === 'rejected') {
      logger.warn(`🔴 [AUTH] User Rejected hai -> Laal Page dikhao (${email})`);
      return res.status(200).json({ success: true, action: 'SHOW_REJECTED' });
    }

    if (vendor.status === 'approved' || vendor.is_verified === true) {
      
      // 🟢 SECURITY FIX: Hardcoded 'Qzkip' hata diya aur strict env check lagaya
      if (!process.env.JWT_SECRET) {
        logger.error('🔥 [FATAL] JWT_SECRET missing in environment variables!');
        return res.status(500).json({ success: false, message: 'Internal Server Error' });
      }

      const token = jwt.sign({ vendorId: vendor._id }, process.env.JWT_SECRET, { expiresIn: '365d' });

      res.cookie('vendorToken', token, {
        httpOnly: true,    
        secure: true,      
        sameSite: 'None',  
        maxAge: 365 * 24 * 60 * 60 * 1000 
      });

      logger.info(`✅ [AUTH] User Login Success -> Dashboard Kholo (${email})`);
      return res.status(200).json({
        success: true,
        action: 'LOGIN_SUCCESS',
        token, 
        vendor: { id: vendor._id, shop_name: vendor.shop_name, qr_id: vendor.qr_id, email: vendor.email }
      });
    }

    logger.info(`🟡 [AUTH] User Pending hai -> Pila Page dikhao (${email})`);
    return res.status(200).json({ success: true, action: 'SHOW_PENDING' });

  } catch (error) {
    logger.error(`❌ [AUTH ERROR]: ${error.message}`);
    next(error); // 🟢 FIXED: Error ko global middleware tak bheja
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

        logger.info(`🟡 [FORM DB SUCCESS] User (${email}) Force Update HUA -> Ab strictly PENDING hai`);
        return res.status(200).json({ success: true, action: 'SHOW_PENDING', message: 'Profile re-submitted for verification.' });
      } else {
        return res.status(400).json({ success: false, message: 'This account is already registered.' });
      }
    }

    const phoneExists = await Vendor.findOne({ phone });
    if (phoneExists) {
      return res.status(400).json({ success: false, message: 'This Phone Number is already registered.' });
    }

    const unique_qr_id = generateUniqueQRID(shop_name);

    const vendor = new Vendor({
      googleUID, email, name, shop_name, phone,
      qr_id: unique_qr_id, shop_type,
      kyc_details: { document_type, document_number },
      is_verified: false,
      status: 'pending'
    });

    await vendor.save();
    logger.info(`🟡 [FORM] Ekdum Naya User (${email}) Save Hua -> Status Pending hai`);
    res.status(201).json({ success: true, action: 'SHOW_PENDING', message: 'Profile submitted for verification.' });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Duplicate data error. Please check your details or try submitting again.' });
    }
    next(error);
  }
};


// ==========================================
// 3. Logout API 
// ==========================================
exports.logoutVendor = (req, res, next) => {
  try {
    res.clearCookie('vendorToken', {
      httpOnly: true,
      secure: true,
      sameSite: 'None'
    });
    logger.info('🔴 [AUTH] Vendor Logged Out, Cookie Cleared');
    res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error); // 🟢 FIXED: Gracefully handle errors if clearCookie fails for any unexpected reason
  }
};
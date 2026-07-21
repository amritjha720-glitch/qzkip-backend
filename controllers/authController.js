const jwt = require('jsonwebtoken');
const Vendor = require('../models/Vendor');

// Helper Function: Unique QR ID Generator
const generateUniqueQRID = async (shop_name) => {
  const cleanName = shop_name.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 8);
  let isUnique = false;
  let finalID = "";

  while (!isUnique) {
    const randomDigits = Math.floor(1000 + Math.random() * 9000); 
    finalID = `${cleanName}-${randomDigits}`;
    const existingVendor = await Vendor.findOne({ qr_id: finalID });
    if (!existingVendor) {
      isUnique = true; 
    }
  }
  return finalID;
};


// ==========================================
// 1. Google Auth (Check Vendor Status)
// ==========================================
exports.googleVendorAuth = async (req, res, next) => {
  try {
    const { googleUID, email } = req.body;

    // Find the vendor in the database
    let vendor = await Vendor.findOne({ googleUID });

    // SCENARIO 1: New Vendor (Show KYC Form)
    if (!vendor) {
      return res.status(200).json({ success: true, action: 'SHOW_FORM' });
    }

    // SCENARIO 2: Rejected Vendor (Show Red Screen)
    if (vendor.status === 'rejected') {
      return res.status(200).json({ success: true, action: 'SHOW_REJECTED' });
    }

    // SCENARIO 3: Verified Vendor (Direct to Dashboard)
    // 🟢 FIXED: Agar purana is_verified true ho, YA naya status 'approved' ho, dono case mein pass karo
    if (vendor.status === 'approved' || vendor.is_verified === true) {
      const token = jwt.sign({ vendorId: vendor._id }, process.env.JWT_SECRET || 'Qzkip', { expiresIn: '365d' });

      return res.status(200).json({ 
        success: true, 
        action: 'LOGIN_SUCCESS',
        token,
        vendor: { id: vendor._id, shop_name: vendor.shop_name, qr_id: vendor.qr_id, email: vendor.email } 
      });
    }

    // SCENARIO 4: Baaki sab Pending hain
    return res.status(200).json({ success: true, action: 'SHOW_PENDING' });

  } catch (error) {
    next(error);
  }
};

// ==========================================
// 2. Complete Profile (KYC Submit)
// ==========================================
exports.completeVendorProfile = async (req, res, next) => {
  try {
    const { googleUID, email, name, shop_name, phone, document_type, document_number, shop_type } = req.body;

    let existingVendor = await Vendor.findOne({ $or: [{ phone }, { email }] });
    if (existingVendor) {
      return res.status(400).json({ success: false, message: 'This Email or Phone Number is already registered.' });
    }

    const unique_qr_id = await generateUniqueQRID(shop_name);
    
    // Create a new vendor
    const vendor = new Vendor({
      googleUID,
      email,
      name,
      shop_name, 
      phone, 
      qr_id: unique_qr_id, 
      shop_type,
      kyc_details: { document_type, document_number },
      is_verified: false,
      status: 'rejected' // 🟢 NAYA: Database ko batana ki naya vendor pending hai
    });

    await vendor.save();
    
res.status(201).json({ success: true, action: 'SHOW_REJECTED', message: 'Application rejected.' });
  } catch (error) {
    if (error.code === 11000) {
       return res.status(400).json({ success: false, message: 'This account already exists.' });
    }
    next(error); 
  }
};
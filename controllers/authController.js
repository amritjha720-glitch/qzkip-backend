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
// 1. Google Auth (STRICT STATE CHECKER)
// ==========================================
exports.googleVendorAuth = async (req, res, next) => {
  try {
    const { googleUID, email } = req.body;

    // 🟢 SUPER FIX: Ab Google UID ya Email dono mein se kisi se bhi strict check hoga
    let vendor = await Vendor.findOne({ $or: [{ email }, { googleUID }] });

    // SCENARIO 1: Vendor exist hi nahi karta
    if (!vendor) {
      console.log(`🟢 [AUTH] Naya User aagaya: ${email} -> Form dikhao`);
      return res.status(200).json({ success: true, action: 'SHOW_FORM' });
    }

    // 🕵️‍♂️ TERMINAL TRACKER (Yeh aapko sach batayega ki DB mein kya save hai)
    console.log(`🔍 [AUTH CHECK] Email: ${vendor.email} | DB Status: '${vendor.status}'`);

    // SCENARIO 2: Strict Rejected Check
    if (vendor.status === 'rejected') {
      console.log(`🔴 [AUTH] User Rejected hai -> Laal Page dikhao`);
      return res.status(200).json({ success: true, action: 'SHOW_REJECTED' });
    }

    // SCENARIO 3: Strict Approved Check
    if (vendor.status === 'approved' || vendor.is_verified === true) {
      console.log(`✅ [AUTH] User Approved hai -> Dashboard kholo`);
      const token = jwt.sign({ vendorId: vendor._id }, process.env.JWT_SECRET || 'Qzkip', { expiresIn: '365d' });

      return res.status(200).json({ 
        success: true, 
        action: 'LOGIN_SUCCESS',
        token,
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
      // Re-apply logic (Agar admin ne pehle reject kiya tha)
      if (existingVendor.status === 'rejected') {
        
        const phoneCheck = await Vendor.findOne({ phone, email: { $ne: email } });
        if (phoneCheck) {
          return res.status(400).json({ success: false, message: 'This Phone Number is already in use by another shop.' });
        }

        // 🔥 THE BULLDOZER FIX: Yahan `.save()` hata kar Direct Force Update laga diya hai
        await Vendor.findOneAndUpdate(
          { email: email },
          {
            $set: {
              shop_name: shop_name,
              phone: phone,
              shop_type: shop_type,
              kyc_details: { document_type, document_number },
              status: 'pending', // 🟢 STRICTLY PENDING UPDATE
              is_verified: false
            }
          },
          { new: true } // Yeh ensure karega ki DB mein truly update ho
        );

        console.log(`🟡 [FORM DB SUCCESS] User (${email}) Force Update HUA -> Ab strictly PENDING hai`);
        return res.status(200).json({ success: true, action: 'SHOW_PENDING', message: 'Profile re-submitted for verification.' });
      } else {
        return res.status(400).json({ success: false, message: 'This account is already registered.' });
      }
    }

    // Naya Vendor Save logic
    const phoneExists = await Vendor.findOne({ phone });
    if (phoneExists) {
      return res.status(400).json({ success: false, message: 'This Phone Number is already registered.' });
    }

    const unique_qr_id = await generateUniqueQRID(shop_name);
    
    const vendor = new Vendor({
      googleUID, email, name, shop_name, phone, 
      qr_id: unique_qr_id, shop_type,
      kyc_details: { document_type, document_number },
      is_verified: false,
      status: 'pending' // 🟢 STRICT NEW DEFAULT PENDING
    });

    await vendor.save();
    console.log(`🟡 [FORM] Ekdum Naya User (${email}) Save Hua -> Status Pending hai`);
    res.status(201).json({ success: true, action: 'SHOW_PENDING', message: 'Profile submitted for verification.' });

  } catch (error) {
    if (error.code === 11000) {
       return res.status(400).json({ success: false, message: 'Duplicate data error. Please check your details.' });
    }
    next(error); 
  }
};
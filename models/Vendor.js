const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  googleUID: { type: String, required: true, unique: true, index: true }, 
  
  // 🟢 FIXED: Email ko strictly sanitize kar diya
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  
  name: { type: String, trim: true },
  shop_name: { type: String, required: [true, 'Shop name is required'], trim: true },
  phone: { type: String, required: [true, 'Phone number is required'], unique: true },
  qr_id: { type: String, required: [true, 'QR ID is required'], unique: true, lowercase: true, trim: true },
  shop_type: { type: String, enum: ['clinic', 'barber', 'cyber cafe'], required: [true, 'Selecting a shop type is required'] },
  
  kyc_details: {
    document_type: { type: String, enum: ['PAN', 'GSTIN', 'Shop License', 'Other'], default: 'PAN' },
    
    // 🟢 FIXED: Data clean rakhne ke liye trim aur auto-uppercase
    document_number: { type: String, trim: true, uppercase: true }
  },
  
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true // 🟢 FIXED: Admin panel ke 'Pending Vendors' route ko 10x fast karne ke liye
  },
  
  // Isko abhi rehne dete hain taaki purana koi code break na ho
  is_verified: { 
    type: Boolean, 
    default: false,
    index: true // 🟢 FIXED: Customer App ke 'getAllShops' (Homepage) ko lag-free banane ke liye
  },
  
  is_open: { type: Boolean, default: true }, 
  
  stats: {
    daily_token_count: { type: Number, default: 0 },
    last_reset: { type: Date, default: Date.now } 
  }
}, { timestamps: true });

// 🟢 REMOVED: vendorSchema.index({ qr_id: 1, phone: 1 }); 
// Iski zaroorat nahi hai kyunki unique:true apna index khud bana leta hai.

module.exports = mongoose.model('Vendor', vendorSchema);
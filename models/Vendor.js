const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  googleUID: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  name: { type: String },
  shop_name: { type: String, required: [true, 'Shop name is required'], trim: true },
  phone: { type: String, required: [true, 'Phone number is required'], unique: true, index: true },
  qr_id: { type: String, required: [true, 'QR ID is required'], unique: true, lowercase: true, trim: true },
  shop_type: { type: String, enum: ['clinic', 'barber', 'cyber cafe'], required: [true, 'Selecting a shop type is required'] },
  
  kyc_details: {
    document_type: { type: String, enum: ['PAN', 'GSTIN', 'Shop License', 'Other'], default: 'PAN' },
    document_number: { type: String }
  },
  
  // 🟢 NAYA: 3-State Status Field (Pending, Approved, Rejected)
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  
  // Isko abhi rehne dete hain taaki purana koi code break na ho
  is_verified: { type: Boolean, default: false },
  is_open: { type: Boolean, default: true }, 
  
  stats: {
    daily_token_count: { type: Number, default: 0 },
    last_reset: { type: Date, default: Date.now } 
  }
}, { timestamps: true });

vendorSchema.index({ qr_id: 1, phone: 1 });

module.exports = mongoose.model('Vendor', vendorSchema);
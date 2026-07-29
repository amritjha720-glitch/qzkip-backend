const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  googleUID: { type: String, required: true, unique: true, index: true }, 
  
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  
  name: { type: String, trim: true },
  shop_name: { type: String, required: [true, 'Shop name is required'], trim: true },
  
  // 📍 🟢 NEW: Manual Shop Address added for Admin Verification (Security limit of 500 chars)
  shop_address: { type: String, required: [true, 'Shop address is required'], trim: true, maxlength: 500 },

  phone: { type: String, required: [true, 'Phone number is required'], unique: true },
  qr_id: { type: String, required: [true, 'QR ID is required'], unique: true, lowercase: true, trim: true },
  shop_type: { type: String, enum: ['clinic', 'barber', 'cyber cafe'], required: [true, 'Selecting a shop type is required'] },
  
  kyc_details: {
    document_type: { type: String, enum: ['PAN', 'GSTIN', 'Shop License', 'Other'], default: 'PAN' },
    document_number: { type: String, trim: true, uppercase: true }
  },
  
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true 
  },
  
  is_verified: { 
    type: Boolean, 
    default: false,
    index: true 
  },
  
  is_open: { type: Boolean, default: true }, 
  
  stats: {
    daily_token_count: { type: Number, default: 0 },
    last_reset: { type: Date, default: Date.now } 
  },

  location: {
    type: { 
      type: String, 
      enum: ['Point'] 
    },
    coordinates: { 
      type: [Number] 
    }
  }

}, { timestamps: true });

vendorSchema.index({ location: '2dsphere' });

module.exports = mongoose.models.Vendor || mongoose.model('Vendor', vendorSchema);
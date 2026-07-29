const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema({
  googleUID: { type: String, required: true, unique: true, index: true }, 
  
  // Email ko strictly sanitize kar diya
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  
  name: { type: String, trim: true },
  shop_name: { type: String, required: [true, 'Shop name is required'], trim: true },
  phone: { type: String, required: [true, 'Phone number is required'], unique: true },
  qr_id: { type: String, required: [true, 'QR ID is required'], unique: true, lowercase: true, trim: true },
  shop_type: { type: String, enum: ['clinic', 'barber', 'cyber cafe'], required: [true, 'Selecting a shop type is required'] },
  
  kyc_details: {
    document_type: { type: String, enum: ['PAN', 'GSTIN', 'Shop License', 'Other'], default: 'PAN' },
    // Data clean rakhne ke liye trim aur auto-uppercase
    document_number: { type: String, trim: true, uppercase: true }
  },
  
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
    index: true // Admin panel ke 'Pending Vendors' route ko fast karne ke liye
  },
  
  is_verified: { 
    type: Boolean, 
    default: false,
    index: true // Customer App ke 'getAllShops' ko lag-free banane ke liye
  },
  
  is_open: { type: Boolean, default: true }, 
  
  stats: {
    daily_token_count: { type: Number, default: 0 },
    last_reset: { type: Date, default: Date.now } 
  },

  // 📍 🟢 Naya GeoJSON Location Object (Zomato/Swiggy Style Location)
  location: {
    type: { 
      type: String, 
      enum: ['Point'] // 🟢 FIXED: 'default: Point' hata diya taaki empty location pe DB crash na ho
    },
    coordinates: { 
      type: [Number] // Hamesha format hoga: [Longitude, Latitude]
    }
  }

}, { timestamps: true });

// 📍 🟢 CRITICAL PRODUCTION FIX: MongoDB ko map mode mein daalne ke liye 2dsphere index
vendorSchema.index({ location: '2dsphere' });

// 🟢 CRASH FIX: Nodemon reload pe 'OverwriteModelError' se bachne ke liye models caching
module.exports = mongoose.models.Vendor || mongoose.model('Vendor', vendorSchema);
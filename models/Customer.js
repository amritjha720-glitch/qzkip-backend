const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: { type: String },
  phone: { 
    type: String, 
    unique: true, 
    sparse: true // Essential for walk-in customers (without phone numbers)
  },
  
  // NEW: Unique Google Auth ID (to prevent spam)
  googleUID: { 
    type: String, 
    unique: true, 
    sparse: true 
  },
  
  is_verified: { type: Boolean, default: false },
  
  // To identify walk-in guests
  device_id: { type: String }, 
  
  // For the 'Recently Visited' list on the home page
  visited_shops: [{
    vendor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    last_visited: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: { type: String },
  
  // Sirf Google UID rakhenge
  googleUID: { 
    type: String, 
    unique: true, 
    required: true 
  },
  
  is_verified: { type: Boolean, default: true },
  device_id: { type: String }, 
  
  visited_shops: [{
    vendor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor' },
    last_visited: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
const mongoose = require('mongoose');

const menuSchema = new mongoose.Schema({
  vendor_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Vendor', 
    required: true,
    unique: true // Each shop will have exactly one main menu
  },
  items: [{
    name: { type: String, required: true },
    price: { type: Number, required: true },
    is_available: { type: Boolean, default: true }
  }]
}, { timestamps: true });

module.exports = mongoose.model('Menu', menuSchema);
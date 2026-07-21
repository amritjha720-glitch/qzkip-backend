const mongoose = require('mongoose');

const queueSchema = new mongoose.Schema({
  vendor_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Vendor', 
    required: true 
  },
  // 🚀 NAYA FIELD: Google User ID trace karne ke liye
  googleUID: { 
    type: String 
  },
  customer_name: { 
    type: String 
  },
  hiddenFromCustomer: {
    type: Boolean,
    default: false
  },
  customer_phone: { 
    type: String, 
    required: false 
  },
  token_number: { 
    type: Number, 
    required: true 
  },
  status: { 
    type: String, 
    enum: ['waiting', 'processing', 'completed', 'cancelled', 'hold', 'skipped', 'cancelled_by_vendor', 'expired'], 
    default: 'waiting' 
  },
  processedAt: { type: Date },
  graceEndTime: { type: Date } 
}, { timestamps: true });

module.exports = mongoose.model('Queue', queueSchema);
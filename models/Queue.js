const mongoose = require('mongoose');

const queueSchema = new mongoose.Schema({
  vendor_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Vendor', 
    required: true 
  },
  
  googleUID: { 
    type: String,
    trim: true,
    index: true // 🟢 FIXED: Fast lookup for `getCustomerHistory`
  },
  
  customer_name: { 
    type: String,
    trim: true,
    maxlength: [100, 'Name is too long']
  },
  
  hiddenFromCustomer: {
    type: Boolean,
    default: false
  },
  
  is_priority: {
    type: Boolean,
    default: false
  },
  
  token_number: { 
    type: Number, 
    required: true,
    min: [1, 'Token number cannot be less than 1'] // 🟢 FIXED: Negative token block
  },
  
  status: { 
    type: String, 
    enum: ['waiting', 'processing', 'completed', 'cancelled', 'hold', 'skipped', 'cancelled_by_vendor', 'expired'], 
    default: 'waiting' 
  },
  
  processedAt: { type: Date },
  
  graceEndTime: { type: Date },

  // 🟢 NAYA: FUTURE-PROOFING FOR PAYMENTS (Analytics ko support karne ke liye)
  is_paid: { 
    type: Boolean, 
    default: false 
  },
  total_amount: { 
    type: Number, 
    default: 0 
  }
}, { timestamps: true });

// ==========================================
// 🚀 MAGICAL FIX: COMPOUND INDEXES (For Extreme Performance)
// ==========================================

// 1. Dashboard, Live Queue aur Analytics Query ke liye sabse zaroori Index
// Yeh MongoDB ko specifically banaye hue raaste se data dhoondhne ko kahega
queueSchema.index({ vendor_id: 1, status: 1, createdAt: -1 });

// 2. Customer ki history nikalne ke liye Index (queueControllerNew.js -> getCustomerHistory)
queueSchema.index({ googleUID: 1, hiddenFromCustomer: 1, createdAt: -1 });

module.exports = mongoose.model('Queue', queueSchema);
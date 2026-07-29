const mongoose = require('mongoose');

const customerSchema = new mongoose.Schema({
  name: { 
    type: String,
    trim: true // 🟢 FIXED: "John " ko "John" bana dega
  },
  
  // Sirf Google UID rakhenge (Firebase/Google Auth ke liye)
  googleUID: { 
    type: String, 
    unique: true, 
    required: true,
    trim: true,
    index: true // 🟢 FIXED: Fast login & lookup ke liye explicit index
  },
  
  is_verified: { 
    type: Boolean, 
    default: true 
  },
  
  // Push notifications (FCM tokens) ya analytics ke liye
  device_id: { 
    type: String,
    trim: true
  }
  
  // 🟢 REMOVED: `visited_shops`
  // Reason: Hum 'getCustomerHistory' mein already 'Queue' model ka use kar rahe hain
  // history nikalne ke liye. Is array ko maintain karna redundant tha aur DB size badhata.

}, { timestamps: true });

module.exports = mongoose.model('Customer', customerSchema);
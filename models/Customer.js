const mongoose = require('mongoose');

// 1. 🟢 MAGICAL FIX: Item ka alag Sub-Schema banaya
// Isse har item ko ek secure _id milegi aur controller ka `menu.items.id()` fast chalega
const menuItemSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Item name is required'],
    trim: true, // " Samosa " ko "Samosa" banayega
    maxlength: [100, 'Item name cannot exceed 100 characters']
  },
  price: { 
    type: Number, 
    required: [true, 'Item price is required'],
    min: [0, 'Price cannot be negative'] // 2. 🟢 CRITICAL SECURITY FIX: Negative price block kiya
  },
  is_available: { 
    type: Boolean, 
    default: true 
  }
});

const menuSchema = new mongoose.Schema({
  vendor_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Vendor', 
    required: true,
    unique: true, 
    index: true // Fast lookup ke liye explicitly index
  },
  items: {
    type: [menuItemSchema], // Array of subdocuments
    validate: [arrayLimit, 'A menu cannot exceed 200 items'] // 3. 🟢 PROTECTION: Document size exceed hone se bachayega
  }
}, { timestamps: true });

// Custom Validation Function
function arrayLimit(val) {
  return val.length <= 200; // Ek dukaan ke menu mein max 200 items (Adjust kar sakte ho)
}

module.exports = mongoose.model('Menu', menuSchema);
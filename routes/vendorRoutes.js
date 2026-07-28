const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit'); // 🟢 ADDED: Spam protection

const { protect } = require('../middleware/authMiddleware'); 
const vendorController = require('../controllers/vendorController');
const { validateVendorProfile } = require('../validations/authValidation'); // 🟢 ADDED: Strict Zod validation

// ==========================================
// 🛡️ STRICT RATE LIMITER
// ==========================================
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 5, // Max 5 registration attempts per IP
  message: { success: false, message: 'Too many registration attempts. Please try again later.' }
});

// ==========================================
// 🔓 UNPROTECTED ROUTES
// ==========================================
// ⚠️ PRO-TIP: You already handle registration securely in authController.completeVendorProfile. 
// Consider deleting this route entirely in the future to keep your API surface small and secure.
router.post('/register', registerLimiter, validateVendorProfile, vendorController.register);


// ==========================================
// 🔒 PROTECTED VENDOR ROUTES
// ==========================================
// 🟢 CLEAN CODE: Applied globally to all routes below
router.use(protect);

router.patch('/toggle-status', vendorController.toggleStatus);
router.get('/analytics', vendorController.getAnalytics);

module.exports = router;
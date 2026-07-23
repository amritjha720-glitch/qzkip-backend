const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

// API Limiter (To prevent spam)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Maximum 20 requests per IP
  message: { success: false, message: 'Too many requests. Please try again later.' }
});

const { validateGoogleAuth, validateVendorProfile } = require('../validations/authValidation');
const authController = require('../controllers/authController');

// ==========================================
// NEW VENDOR GOOGLE AUTH ROUTES
// ==========================================

// 1. Google Login Button Click
router.post('/google', apiLimiter, validateGoogleAuth, authController.googleVendorAuth);

// 2. KYC Form Submit
router.post('/complete-profile', apiLimiter, validateVendorProfile, authController.completeVendorProfile);

// 3. 🟢 NAYA ROUTE: Logout & Clear Cookie
router.post('/logout', authController.logoutVendor);

module.exports = router;
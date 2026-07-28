const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');

const { validateGoogleAuth, validateVendorProfile } = require('../validations/authValidation');
const authController = require('../controllers/authController');

// ==========================================
// 🛡️ GRANULAR RATE LIMITERS (Production Standard)
// ==========================================

// 1. Login Limiter: Auth span rokne ke liye
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Max 15 login attempts per IP
  message: { success: false, message: 'Too many login attempts. Please try again later.' }
});

// 2. Profile (KYC) Limiter: KYC database spam block karne ke liye
const profileLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 Hour (Kyunki profile baar-baar submit nahi ki jati)
  max: 5, // Sirf 5 attempts per hour
  message: { success: false, message: 'Too many profile submission attempts. Try again in an hour.' }
});

// 3. Logout Limiter: Basic API abuse protection
const logoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many logout requests.' }
});

// ==========================================
// 🚀 VENDOR AUTH ROUTES
// ==========================================

// 1. Google Login
router.post('/google', loginLimiter, validateGoogleAuth, authController.googleVendorAuth);

// 2. KYC Form Submit
router.post('/complete-profile', profileLimiter, validateVendorProfile, authController.completeVendorProfile);

// 3. Logout & Clear Cookie
router.post('/logout', logoutLimiter, authController.logoutVendor);

module.exports = router;
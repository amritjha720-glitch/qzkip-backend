const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit'); // 🟢 ADDED: Strict rate limiting ke liye

const adminController = require('../controllers/adminController');
const adminAuth = require('../middleware/adminAuthNew');

// ==========================================
// 🛡️ STRICT ADMIN RATE LIMITER
// ==========================================
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 🟢 STRICT: Sirf 5 galat attempts allow karega, phir block kar dega
  message: { success: false, message: 'Too many login attempts. Please try again after 15 minutes.' }
});

// ==========================================
// 🔓 UNPROTECTED ROUTES
// ==========================================
router.post('/login', adminLoginLimiter, adminController.adminLogin);

// ==========================================const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit'); // 🟢 ADDED: Strict rate limiting ke liye

const adminController = require('../controllers/adminController');
const adminAuth = require('../middleware/adminAuthNew');

// ==========================================
// 🛡️ STRICT ADMIN RATE LIMITER
// ==========================================
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 🟢 STRICT: Sirf 5 galat attempts allow karega, phir block kar dega
  message: { success: false, message: 'Too many login attempts. Please try again after 15 minutes.' }
});

// ==========================================
// 🔓 UNPROTECTED ROUTES
// ==========================================
router.post('/login', adminLoginLimiter, adminController.adminLogin);

// ==========================================
// 🔒 PROTECTED ADMIN ROUTES (MIDDLEWARE APPLIED GLOBALLY)
// ==========================================
// 🟢 CLEAN CODE: Ab iske niche wale har route par 'adminAuth' khud apply ho jayega!
router.use(adminAuth); 

router.get('/pending-vendors', adminController.getPendingVendors);

// 🟢 NEW: God Mode Dashboard ke liye Active/Live Vendors ka route
router.get('/active-vendors', adminController.getActiveVendors);

router.patch('/approve/:vendorId', adminController.approveVendor);
router.patch('/reject/:vendorId', adminController.rejectVendor); 

// 🟢 FIXED REST API STANDARD: pure '/:vendorId' use kiya hai
// (Make sure to update React frontend delete axios call to match this URL!)
router.delete('/:vendorId', adminController.deleteVendor);

module.exports = router;
// 🔒 PROTECTED ADMIN ROUTES (MIDDLEWARE APPLIED GLOBALLY)
// ==========================================
// 🟢 CLEAN CODE: Ab iske niche wale har route par 'adminAuth' khud apply ho jayega!
router.use(adminAuth); 

router.get('/pending-vendors', adminController.getPendingVendors);
router.patch('/approve/:vendorId', adminController.approveVendor);
router.patch('/reject/:vendorId', adminController.rejectVendor); 

// 🟢 FIXED REST API STANDARD: '/delete/:vendorId' ki jagah sirf '/:vendorId'
router.delete('/:vendorId', adminController.deleteVendor);

module.exports = router;
const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const adminAuth = require('../middleware/adminAuthNew');

// The login endpoint is unprotected
router.post('/login', adminController.adminLogin);

// Protect all remaining routes with the adminAuth middleware
router.get('/pending-vendors', adminAuth, adminController.getPendingVendors);
router.patch('/approve/:vendorId', adminAuth, adminController.approveVendor);

// 🟢 CHANGED: Reject ab PATCH request hai kyunki hum data update kar rahe hain delete nahi
router.patch('/reject/:vendorId', adminAuth, adminController.rejectVendor); 

// 🟢 NEW: Asli Delete route
router.delete('/delete/:vendorId', adminAuth, adminController.deleteVendor);

module.exports = router;

// Forced update for Render
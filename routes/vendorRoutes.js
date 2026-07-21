const express = require('express');
const router = express.Router();

// 🚨 FIX 1: Yahan {} brackets lagaye hain taaki sirf 'protect' function bahar aaye
const { protect } = require('../middleware/authMiddleware'); 
const vendorController = require('../controllers/vendorController');

router.post('/register', vendorController.register);

// 🚨 FIX 2: 'authMiddleware' ki jagah seedha 'protect' function pass kiya hai
router.patch('/toggle-status', protect, vendorController.toggleStatus);
router.get('/analytics', protect, vendorController.getAnalytics);

module.exports = router;
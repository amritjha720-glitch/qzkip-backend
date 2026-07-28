const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit'); // 🟢 ADDED: Security import

const { protect } = require('../middleware/authMiddleware'); 
const queueController = require('../controllers/queueControllerNew');

// ==========================================
// 🛡️ STRICT PUBLIC RATE LIMITERS
// ==========================================

// 1. Token Generation Limiter (Crucial for preventing fake bookings)
const tokenGenerateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 10, // Max 10 tokens per IP in 15 mins
  message: { success: false, message: 'Too many token requests from your network. Please wait a few minutes.' }
});

// 2. Customer Actions Limiter (Cancel/Hide)
const customerActionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 20, // Max 20 actions per 15 mins
  message: { success: false, message: 'Too many action requests. Try again later.' }
});


// ==========================================
// 🔓 PUBLIC APIS (Customer App)
// ==========================================

// 🟢 FIXED: Applied strict limiter to the most vulnerable endpoint
router.post('/generate-token', tokenGenerateLimiter, queueController.generateToken);

// 🟢 FIXED: Applied action limiters to state-changing endpoints
router.patch('/hide-history/:tokenId', customerActionLimiter, queueController.hideHistory);
router.post('/cancel-token', customerActionLimiter, queueController.cancelToken);

// GET routes rely safely on the Global IP Limiter from server.js
router.get('/public-status/:qr_id', queueController.getPublicStatus);
router.get('/all-shops', queueController.getAllShops);
router.get('/customer-history/:phone', queueController.getCustomerHistory);


// ==========================================
// 🔒 PROTECTED VENDOR APIS (Dashboard)
// ==========================================
// These are safe because they require a valid JWT token via 'protect'

router.post('/toggle-status', protect, queueController.toggleStatus);
router.get('/live', protect, queueController.getLiveQueue);
router.patch('/update-status', protect, queueController.updateStatus);
router.post('/walk-in', protect, queueController.addWalkInToken);

module.exports = router;
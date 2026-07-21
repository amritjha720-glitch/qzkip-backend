const express = require('express');
const router = express.Router();
const customerController = require('../controllers/customerController');

router.post('/send-otp', customerController.sendOtp);
router.post('/verify-otp', customerController.verifyOtp);

module.exports = router;
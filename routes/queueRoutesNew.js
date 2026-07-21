const express = require('express');
const router = express.Router();

const { protect } = require('../middleware/authMiddleware'); 
const queueController = require('../controllers/queueControllerNew');

// PUBLIC APIS
router.post('/generate-token', queueController.generateToken);
router.get('/public-status/:qr_id', queueController.getPublicStatus);
router.get('/all-shops', queueController.getAllShops);
router.get('/customer-history/:phone', queueController.getCustomerHistory);
router.patch('/hide-history/:tokenId', queueController.hideHistory);
router.post('/cancel-token', queueController.cancelToken);

// PROTECTED VENDOR APIS    
router.post('/toggle-status', protect, queueController.toggleStatus);
router.get('/live', protect, queueController.getLiveQueue);
router.patch('/update-status', protect, queueController.updateStatus);
router.post('/walk-in', protect, queueController.addWalkInToken);


module.exports = router;
const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const menuController = require('../controllers/menuController');

router.post('/update', protect, menuController.updateMenu);
router.get('/:qr_id', menuController.getMenu);
router.patch('/toggle-item', protect, menuController.toggleItem);

module.exports = router;
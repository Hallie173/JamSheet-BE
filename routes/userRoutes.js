const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/profile', authMiddleware, userController.getProfile);
router.put('/profile', authMiddleware, userController.updateProfile);
router.post('/upload-avatar', authMiddleware, userController.uploadAvatar);
router.post("/upload-cover", authMiddleware, userController.uploadCover);

module.exports = router;
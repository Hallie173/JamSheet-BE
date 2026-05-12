const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');

router.get('/profile', authMiddleware, userController.getProfile);
router.put('/profile', authMiddleware, userController.updateProfile);
router.post('/upload-avatar', authMiddleware, upload.single('avatar'), userController.uploadAvatar);
router.post("/upload-cover", authMiddleware, upload.single("cover"), userController.uploadCover);

module.exports = router;
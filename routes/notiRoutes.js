const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notificationController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/", authMiddleware, notificationController.getNotifications);

router.put("/read-all", authMiddleware, notificationController.markAllAsRead);

router.put("/:id/read", authMiddleware, notificationController.markAsRead);

module.exports = router;
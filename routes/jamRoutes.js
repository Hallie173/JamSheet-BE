const express = require("express");
const router = express.Router();
const jamController = require("../controllers/jamController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/check-duplicate", authMiddleware, jamController.checkDuplicateJam);

router.get("/:id", authMiddleware, jamController.getJamRoomById);

router.post("/", authMiddleware, jamController.createJamRoom);

router.put("/:id/mix-config", authMiddleware, jamController.saveMixConfig);

module.exports = router;
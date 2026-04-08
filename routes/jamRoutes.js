const express = require("express");
const router = express.Router();
const jamController = require("../controllers/jamController");
const authMiddleware = require("../middleware/authMiddleware");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

router.get("/check-duplicate", authMiddleware, jamController.checkDuplicateJam);

router.get("/my-tracks", authMiddleware, jamController.getMyTracks);

router.get("/lobby", authMiddleware, jamController.getLobbyJams);

router.get("/tracks/:trackId", authMiddleware, jamController.getTrackById);

router.put("/tracks/:trackId", authMiddleware, upload.single("audio"), jamController.updateAudioTrack);

router.get("/:id", authMiddleware, jamController.getJamRoomById);

router.post("/", authMiddleware, jamController.createJamRoom);

router.put("/:id/mix-config", authMiddleware, jamController.saveMixConfig);

router.post("/:id/tracks", authMiddleware, upload.single("audio"), jamController.uploadAudioTrack);

module.exports = router;
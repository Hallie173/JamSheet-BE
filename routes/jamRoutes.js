const express = require("express");
const router = express.Router();
const jamController = require("../controllers/jamController");
const authMiddleware = require("../middleware/authMiddleware");
const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

router.get("/check-duplicate", authMiddleware, jamController.checkDuplicateJam);

router.get("/my-tracks", authMiddleware, jamController.getMyTracks);

router.get("/lobby", authMiddleware, jamController.getLobbyJams);

router.get("/top-tracks", jamController.getTopTracks);

router.get("/find-by-sheet/:sheetId", authMiddleware, jamController.findJamBySheetId);

router.get("/tracks/:trackId", authMiddleware, jamController.getTrackById);

router.put("/tracks/:trackId", authMiddleware, upload.single("audio"), jamController.updateAudioTrack);

router.get("/:id", authMiddleware, jamController.getJamRoomById);

router.post("/", authMiddleware, jamController.createJamRoom);

router.put("/:id/mix-config", authMiddleware, jamController.saveMixConfig);

router.post("/:id/tracks", authMiddleware, upload.single("audio"), jamController.uploadAudioTrack);

router.put('/tracks/:trackId/like', authMiddleware, jamController.toggleLikeTrack);

module.exports = router;
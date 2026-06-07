const express = require("express");
const router = express.Router();
const jamController = require("../controllers/jamController");
const authMiddleware = require("../middleware/authMiddleware");

router.get("/check-duplicate", authMiddleware, jamController.checkDuplicateJam);

router.get("/my-tracks", authMiddleware, jamController.getMyTracks);

router.get("/lobby", authMiddleware, jamController.getLobbyJams);

router.get("/top-tracks", jamController.getTopTracks);

router.get("/recent-drafts", authMiddleware, jamController.getRecentDrafts);

router.get("/trending", jamController.getTrendingJams);

router.get("/stats", jamController.getCommunityStats);

router.get("/:id/public", jamController.getJamRoomPublic);

router.get("/needs-you", authMiddleware, jamController.getJamsNeedingUser);

router.get("/orphaned-drafts", authMiddleware, jamController.getOrphanedDrafts);

router.get("/find-by-sheet/:sheetId", authMiddleware, jamController.findJamBySheetId);

router.get("/tracks/:trackId", authMiddleware, jamController.getTrackById);

router.put("/tracks/:trackId", authMiddleware, jamController.updateAudioTrack);

router.get("/:id", authMiddleware, jamController.getJamRoomById);

router.post("/", authMiddleware, jamController.createJamRoom);

router.put("/:id/mix-config", authMiddleware, jamController.saveMixConfig);

router.post("/:id/tracks", authMiddleware, jamController.uploadAudioTrack);
router.delete('/tracks/:trackId', authMiddleware, jamController.deleteTrack);
router.put('/tracks/:trackId/like', authMiddleware, jamController.toggleLikeTrack);

module.exports = router;
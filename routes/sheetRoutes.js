const express = require("express");
const router = express.Router();
const sheetController = require("../controllers/sheetController");
const authMiddleware = require("../middleware/authMiddleware");
const uploadSheet = require("../middleware/uploadSheetMiddleware");

router.get("/explore", sheetController.getExploreSheets);

router.get("/my-sheets", authMiddleware, sheetController.getMySheets);
router.post(
  "/",
  authMiddleware,
  uploadSheet.single("file"),
  sheetController.createSheet,
);
router.put("/:id", authMiddleware, sheetController.updateSheet);
router.delete("/:id", authMiddleware, sheetController.deleteSheet);
router.post("/:id/like", authMiddleware, sheetController.toggleLike);

module.exports = router;
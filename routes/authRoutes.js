const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

router.post("/register", authController.register);
router.post("/login", authController.login);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password/:token", authController.resetPassword);

// ⚠️ CHỈ DÙNG CHO MÔI TRƯỜNG TEST — Không bao giờ deploy lên production
if (process.env.NODE_ENV !== "production") {
  const jwt = require("jsonwebtoken");
  const User = require("../models/User");

  router.post("/generate-reset-token", async (req, res) => {
    try {
      const { email } = req.body;
      const user = await User.findOne({ email });
      if (!user) return res.status(404).json({ message: "Không tìm thấy user" });

      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET,
        { expiresIn: "15m" }
      );
      res.status(200).json({ token });
    } catch (error) {
      res.status(500).json({ message: "Lỗi server", error: error.message });
    }
  });
}

module.exports = router;

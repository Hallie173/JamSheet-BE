const jwt = require("jsonwebtoken");

module.exports = (req, res, next) => {
  const authHeader = req.header("Authorization");
  if (!authHeader) {
    return res
      .status(401)
      .json({ message: "Không có Token, từ chối truy cập!" });
  }

  try {
    const token = authHeader.replace("Bearer ", "");

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Lưu thông tin người dùng đã giải mã vào req.user để các route sau có thể sử dụng
    next(); // Cho phép tiếp tục đến route tiếp theo
  } catch (error) {
    console.log("❌ Lỗi giải mã Token:", error.message);
    res.status(401).json({
      message: "Token không hợp lệ hoặc đã hết hạn!",
      error: error.message,
    });
  }
};

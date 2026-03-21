const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();

// Middleware (Xử lý dữ liệu trung gian)
app.use(cors()); // Cho phép Frontend gọi API
app.use(express.json()); // Cho phép Backend đọc được dữ liệu JSON gửi lên
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // Cho phép truy cập file tĩnh trong thư mục uploads
app.use("/api/sheets", require("./routes/sheetRoutes")); // Đăng ký route cho nhạc phổ

// Kết nối MongoDB bằng Mongoose
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Đã kết nối thành công với MongoDB JamSheet!"))
  .catch((err) => console.error("❌ Lỗi kết nối MongoDB:", err));

const authRoutes = require("./routes/authRoutes");
app.use("/api/auth", authRoutes);
app.use("/api/users", require("./routes/userRoutes"));

// Khởi động Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server Backend đang chạy tại http://localhost:${PORT}`);
});

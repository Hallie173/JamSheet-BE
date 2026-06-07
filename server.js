const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const app = express();

// ==========================================
// MIDDLEWARE (phải đứng trước tất cả routes)
// ==========================================
app.use(cors()); // Cho phép Frontend gọi API
app.use(express.json()); // Cho phép Backend đọc được dữ liệu JSON gửi lên
app.use("/uploads", express.static(path.join(__dirname, "uploads"))); // Cho phép truy cập file tĩnh trong thư mục uploads

// ==========================================
// KẾT NỐI MONGODB
// ==========================================
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Đã kết nối thành công với MongoDB JamSheet!"))
  .catch((err) => console.error("❌ Lỗi kết nối MongoDB:", err));

// ==========================================
// ROUTES (đăng ký mỗi route đúng một lần)
// ==========================================
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/sheets", require("./routes/sheetRoutes"));
app.use("/api/jams", require("./routes/jamRoutes"));
app.use("/api/notifications", require("./routes/notiRoutes"));

// ==========================================
// KHỞI ĐỘNG SERVER
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server Backend đang chạy tại http://localhost:${PORT}`);
});

const mongoose = require("mongoose");

const sheetMusicSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    composer: { type: String, default: "Unknown" },
    uploader_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    file_url: { type: String, required: true },
    instrument_tags: [{ type: String }],
    tempo: { type: Number, required: true },
    genre: { type: String, default: "Other" },

    // BỔ SUNG: Dữ liệu thống kê hiển thị trên thẻ Card ở Trang chủ & Thư viện
    likes_count: { type: Number, default: 0 },
    contributors_count: { type: Number, default: 0 }, // Số nhạc công đã dùng bài này
  },
  { timestamps: true },
);

sheetMusicSchema.index({ title: "text" });

module.exports = mongoose.model("SheetMusic", sheetMusicSchema);

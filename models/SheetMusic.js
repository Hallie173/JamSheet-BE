const mongoose = require("mongoose");

const sheetMusicSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    composer: { type: String, default: "Unknown" },
    uploader_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    
    // BẮT BUỘC PHẢI GIỮ LẠI TRƯỜNG NÀY (Đóng vai trò làm Ảnh bìa ngoài thư viện)
    file_url: { type: String },
    
    // THÊM TRƯỜNG NÀY ĐỂ LƯU MẢNG ẢNH (Phục vụ auto-scroll trong phòng Jam)
    file_urls: [{ type: String }],
    
    instrument_tags: [{ type: String }],
    tempo: { type: Number, required: true },
    time_signature: { type: String, required: true },
    genre: { type: String, default: "Other" },
    liked_by: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    contributors_count: { type: Number, default: 0 },
    is_frozen: { type: Boolean, default: false },
  },
  { timestamps: true }
);

sheetMusicSchema.index({ title: "text" });
module.exports = mongoose.model("SheetMusic", sheetMusicSchema);
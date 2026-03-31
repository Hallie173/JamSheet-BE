const mongoose = require("mongoose");

const audioTrackSchema = new mongoose.Schema(
  {
    project_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "JamProject",
      required: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    instrument: { type: String, required: true },

    // BỔ SUNG: Tên của bản thu để hiện trong Dropdown (VD: "Take 1 (Bản nháp êm dịu)")
    name: { type: String, default: "Bản thu mới" },

    raw_audio_url: { type: String, required: true },
    clean_audio_url: { type: String, default: "" },

    ai_status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },

    // BỔ SUNG THÔNG SỐ TIMELINE (Dùng để vẽ giao diện sóng âm)
    sync_offset_ms: { type: Number, default: 0 }, // Điểm bắt đầu phát (tính bằng mili-giây)
    duration: { type: Number, required: true }, // Độ dài của file audio (tính bằng giây)

    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },

    likes_count: { type: Number, default: 0 },
    liked_by: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true },
);

module.exports = mongoose.model("AudioTrack", audioTrackSchema);

const mongoose = require("mongoose");

const jamProjectSchema = new mongoose.Schema(
  {
    sheet_music_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SheetMusic",
      required: true,
    },
    owner_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, required: true },

    // Khớp với Header của Bàn Mixer (VD: BPM: 120 • 4/4)
    tempo: { type: Number, required: true },
    time_signature: { type: String, default: "4/4" },

    // Dùng để hiển thị nhãn (Tags) ở Trang chủ
    tags: [{ type: String }],
    likes_count: { type: Number, default: 0 },
    participants_count: { type: Number, default: 0 },

    // CẤU HÌNH BÀN MIXER (DAW State): Lưu trạng thái các Kệ nhạc cụ
    tracks_config: [
      {
        instrument: { type: String, required: true }, // Tên kệ (VD: "Piano Grand")
        volume: { type: Number, default: 80 }, // Thanh kéo âm lượng của kệ
        // Lưu ID của Bản thu (Take) đang được chọn phát trong menu Dropdown
        active_record_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "AudioTrack",
          default: null,
        },
      },
    ],

    // Danh sách kệ bắt buộc phải có (Dùng để tính số Slot còn thiếu ở Trang chủ)
    required_instruments: [{ type: String, required: true }],
    status: { type: String, enum: ["open", "completed"], default: "open" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("JamProject", jamProjectSchema);

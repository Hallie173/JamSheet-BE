const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  recipient_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  sender_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // ID người kích hoạt
  sender_name: { type: String }, // Tên người kích hoạt thông báo
  sender_avatar: { type: String },
  type: { 
    type: String, 
    enum: ["sheet_like", "room_new_track_owner", "room_new_track_participant", "track_likes", "orphaned_draft"], 
    required: true 
  },
  target_id: { type: mongoose.Schema.Types.ObjectId, required: true }, // ID của sheet hoặc room hoặc track
  target_name: { type: String }, // Lưu tên bản nhạc/phòng Jam
  target_link: { type: String }, // Link trỏ đến khi click vào thông báo
  count: { type: Number, default: 1 }, // Để gộp số lượng (VD: n lượt thích mới)
  is_read: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("Notification", notificationSchema);
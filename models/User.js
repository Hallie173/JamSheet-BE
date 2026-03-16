const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password_hash: { type: String, required: true },
    avatar_url: { type: String, default: "" },
    bio: { type: String, default: "" },
    instruments: [{ type: String }],

    // Nhóm thống kê tương tác
    total_likes_received: { type: Number, default: 0 },
    total_tracks_contributed: { type: Number, default: 0 },
    total_projects_joined: { type: Number, default: 0 },
    total_sheets_uploaded: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);

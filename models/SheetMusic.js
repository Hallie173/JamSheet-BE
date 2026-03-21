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
    liked_by: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    contributors_count: { type: Number, default: 0 },
  },
  { timestamps: true },
);

sheetMusicSchema.index({ title: "text" });

module.exports = mongoose.model("SheetMusic", sheetMusicSchema);

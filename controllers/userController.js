const User = require("../models/User");
const SheetMusic = require("../models/SheetMusic");
const AudioTrack = require("../models/AudioTrack");
const cloudinary = require("../config/cloudinary");
const { Readable } = require("stream");

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId).select("-password_hash").lean();
    if (!user) return res.status(404).json({ message: "Người dùng không tồn tại!" });

    // 1. Thống kê cơ bản
    const total_sheets_uploaded = await SheetMusic.countDocuments({ uploader_id: userId });
    const total_tracks_contributed = await AudioTrack.countDocuments({ user_id: userId });
    
    const userTracks = await AudioTrack.find({ user_id: userId }).select("project_id");
    const uniqueProjects = new Set(userTracks.map(t => t.project_id?.toString()).filter(Boolean));
    const total_projects_joined = uniqueProjects.size;

    const userSheets = await SheetMusic.find({ uploader_id: userId }).select("liked_by");
    const sheetLikes = userSheets.reduce((sum, s) => sum + (s.liked_by?.length || 0), 0);
    const allUserTracks = await AudioTrack.find({ user_id: userId }).select("liked_by");
    const trackLikes = allUserTracks.reduce((sum, t) => sum + (t.liked_by?.length || 0), 0);
    const total_likes_received = sheetLikes + trackLikes;

    // 2. Lấy dữ liệu Nhật ký hoạt động (Activity Log) cho Heatmap
    // Chúng ta lấy ngày tạo của nhạc phổ và bản thu trong 3 tháng qua
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setDate(threeMonthsAgo.getDate() - 90);

    const sheets = await SheetMusic.find({ uploader_id: userId, createdAt: { $gte: threeMonthsAgo } }).select("createdAt title");
    const tracks = await AudioTrack.find({ user_id: userId, createdAt: { $gte: threeMonthsAgo } }).select("createdAt name");

    // Gom nhóm hoạt động theo ngày
    const activityMap = {};
    const processItem = (item, type) => {
      const date = item.createdAt.toISOString().split('T')[0];
      if (!activityMap[date]) activityMap[date] = [];
      activityMap[date].push(`${type}: ${item.title || item.name}`);
    };

    sheets.forEach(s => processItem(s, "Tải nhạc phổ"));
    tracks.forEach(t => processItem(t, "Nộp bản thu"));

    res.status(200).json({
      ...user,
      total_sheets_uploaded,
      total_tracks_contributed,
      total_projects_joined,
      total_likes_received,
      activity_log: activityMap // Gửi object { "2024-05-10": ["...", "..."] } về FE
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { username, bio, avatar_url, cover_url, instruments } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.user.userId,
      { username, bio, avatar_url, cover_url, instruments },
      { new: true, runValidators: true },
    ).select("-password_hash");

    res.status(200).json({
      message: "Cập nhật hồ sơ thành công!",
      user: updatedUser,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ message: "Vui lòng chọn một tệp hình ảnh để tải lên!" });
    }

    const uploadToCloudinary = (buffer) => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "jamsheet_avatars",
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          },
        );
        const stream = Readable.from([buffer]);
        stream.pipe(uploadStream);
      });
    };

    const cloudResult = await uploadToCloudinary(req.file.buffer);

    res.status(200).json({
      message: "Tải lên ảnh đại diện thành công!",
      avatar_url: cloudResult.secure_url, 
    });
  } catch (error) {
    console.error("Lỗi upload avatar:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

exports.uploadCover = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Vui lòng chọn ảnh bìa!" });

    const uploadToCloudinary = (buffer) => {
      return new Promise((resolve, reject) => {
        const uploadStream = require("../config/cloudinary").uploader.upload_stream(
          { folder: "jamsheet_covers" },
          (error, result) => { if (error) reject(error); else resolve(result); }
        );
        require("stream").Readable.from([buffer]).pipe(uploadStream);
      });
    };

    const cloudResult = await uploadToCloudinary(req.file.buffer);
    res.status(200).json({ message: "Thành công!", cover_url: cloudResult.secure_url });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};
const SheetMusic = require("../models/SheetMusic");
const JamProject = require("../models/JamProject");
const AudioTrack = require("../models/AudioTrack");
const Notification = require("../models/Notification");
const User = require("../models/User");
const cloudinary = require("../config/cloudinary");
const { Readable } = require("stream");

// [POST] TẠO NHẠC PHỔ MỚI (Xử lý PDF thành mảng ảnh qua Cloudinary)
// [POST] TẠO NHẠC PHỔ MỚI (Dùng sức mạnh đếm trang tích hợp sẵn của Cloudinary)
// [POST] TẠO NHẠC PHỔ MỚI (Nhận sẵn mảng link ảnh từ Frontend)
exports.createSheet = async (req, res) => {
  try {
    const {
      title,
      composer,
      instrument_tags,
      tempo,
      genre,
      time_signature,
      file_urls,
    } = req.body;

    if (!file_urls || file_urls.length === 0) {
      return res
        .status(400)
        .json({ message: "Không nhận được link ảnh nhạc phổ!" });
    }

    // Không cần xử lý Cloudinary SDK ở đây nữa
    const newSheet = new SheetMusic({
      title,
      composer,
      instrument_tags: instrument_tags
        ? instrument_tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : [],
      tempo: Number(tempo),
      genre,
      time_signature,
      uploader_id: req.user.userId,
      file_url: file_urls[0], // Lấy ảnh đầu tiên làm ảnh bìa
      file_urls: file_urls, // Lưu nguyên mảng ảnh
    });

    await newSheet.save();

    const responseData = newSheet.toObject();
    responseData.file_urls = responseData.file_urls || [];

    res
      .status(201)
      .json({ message: "Tạo nhạc phổ thành công!", sheet: responseData });
  } catch (error) {
    console.error("Lỗi tạo nhạc phổ:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

// [GET] LẤY NHẠC PHỔ CỦA TÔI
exports.getMySheets = async (req, res) => {
  try {
    const sheets = await SheetMusic.find({
      uploader_id: req.user.userId,
      is_frozen: { $ne: true },
    }).sort({ createdAt: -1 });

    // Đảm bảo file_urls luôn là array
    const safeSheets = sheets.map((sheet) => {
      const sheetObj = sheet.toObject();
      sheetObj.file_urls = sheetObj.file_urls || [];
      return sheetObj;
    });

    res.status(200).json(safeSheets);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi lấy danh sách nhạc phổ", error: error.message });
  }
};

// [GET] KHÁM PHÁ NHẠC PHỔ CỘNG ĐỒNG
exports.getExploreSheets = async (req, res) => {
  try {
    const sheets = await SheetMusic.find({ is_frozen: { $ne: true } })
      .sort({ likes_count: -1, createdAt: -1 })
      .limit(20);

    // Đảm bảo file_urls luôn là array
    const safeSheets = sheets.map((sheet) => {
      const sheetObj = sheet.toObject();
      sheetObj.file_urls = sheetObj.file_urls || [];
      return sheetObj;
    });

    res.status(200).json(safeSheets);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi lấy dữ liệu cộng đồng", error: error.message });
  }
};

// [PUT] CẬP NHẬT THÔNG TIN NHẠC PHỔ
exports.updateSheet = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, composer, instrument_tags, tempo, genre, time_signature } =
      req.body;

    let tagsArray = [];
    if (Array.isArray(instrument_tags)) {
      tagsArray = instrument_tags;
    } else if (typeof instrument_tags === "string") {
      tagsArray = instrument_tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean);
    }

    const updatedSheet = await SheetMusic.findOneAndUpdate(
      { _id: id, uploader_id: req.user.userId },
      {
        title,
        composer,
        instrument_tags: tagsArray,
        tempo,
        genre,
        time_signature,
      },
      { returnDocument: "after" },
    );

    if (!updatedSheet) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy nhạc phổ hoặc không có quyền!" });
    }

    // Đồng bộ thông tin sang các phòng Jam liên quan
    await JamProject.updateMany(
      { sheet_music_id: id },
      {
        $set: {
          title: updatedSheet.title,
          tempo: updatedSheet.tempo,
          time_signature: updatedSheet.time_signature,
          required_instruments: updatedSheet.instrument_tags,
        },
      },
    );

    res
      .status(200)
      .json({ message: "Cập nhật thành công!", sheet: updatedSheet });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi cập nhật nhạc phổ", error: error.message });
  }
};

// [DELETE] XÓA NHẠC PHỔ (Xóa cứng hoặc Đóng băng)
exports.deleteSheet = async (req, res) => {
  try {
    const sheetId = req.params.id;
    const userId = req.user.userId;

    const sheet = await SheetMusic.findById(sheetId);
    if (!sheet) return res.status(404).json({ message: "Không tồn tại!" });
    if (sheet.uploader_id.toString() !== userId)
      return res.status(403).json({ message: "Không có quyền!" });

    const associatedRooms = await JamProject.find({ sheet_music_id: sheetId });
    const roomIds = associatedRooms.map((room) => room._id);
    const trackCount = await AudioTrack.countDocuments({
      project_id: { $in: roomIds },
    });

    if (trackCount === 0) {
      await JamProject.deleteMany({ sheet_music_id: sheetId });
      await SheetMusic.findByIdAndDelete(sheetId);
      res
        .status(200)
        .json({ message: "Đã xóa hoàn toàn!", action: "hard_delete" });
    } else {
      await SheetMusic.findByIdAndUpdate(sheetId, { is_frozen: true });
      await JamProject.updateMany(
        { sheet_music_id: sheetId },
        { status: "archived" },
      );
      res
        .status(200)
        .json({ message: "Đã đóng băng nhạc phổ!", action: "freeze" });
    }
  } catch (error) {
    res.status(500).json({ message: "Lỗi xóa nhạc phổ", error: error.message });
  }
};

// [GET] TÌM KIẾM NHẠC PHỔ
exports.searchSheets = async (req, res) => {
  try {
    const { q, inst, genre } = req.query;
    let filter = { is_frozen: { $ne: true } };

    if (q) filter.title = { $regex: new RegExp(q, "i") };
    if (inst) filter.instrument_tags = { $in: inst.split(",") };
    if (genre) filter.genre = { $in: genre.split(",") };

    const sheets = await SheetMusic.find(filter).sort({ createdAt: -1 });

    // Đảm bảo file_urls luôn là array
    const safeSheets = sheets.map((sheet) => {
      const sheetObj = sheet.toObject();
      sheetObj.file_urls = sheetObj.file_urls || [];
      return sheetObj;
    });

    res.status(200).json(safeSheets);
  } catch (error) {
    res.status(500).json({ message: "Lỗi tìm kiếm", error: error.message });
  }
};

// [POST] THẢ TIM NHẠC PHỔ
exports.toggleLike = async (req, res) => {
  try {
    const sheetId = req.params.id;
    const userId = req.user.userId;

    const currentUser = await User.findById(userId);
    const senderName = currentUser
      ? currentUser.username || currentUser.name
      : "Một người dùng";

    const sheet = await SheetMusic.findById(sheetId);
    if (!sheet) return res.status(404).json({ message: "Không tồn tại!" });

    const hasLiked = sheet.liked_by.includes(userId);

    if (hasLiked) {
      sheet.liked_by.pull(userId);
      // Giảm count đi 1 (đảm bảo không bị âm)
      sheet.likes_count = Math.max(0, (sheet.likes_count || 0) - 1);
    } else {
      sheet.liked_by.push(userId);
      // Tăng count lên 1
      sheet.likes_count = (sheet.likes_count || 0) + 1;

      if (sheet.uploader_id.toString() !== userId) {
        await Notification.create({
          recipient_id: sheet.uploader_id,
          sender_id: req.user.userId,
          sender_name: senderName,
          type: "sheet_like",
          target_id: sheet._id,
          target_name: sheet.title,
          target_link: `/sheets-library?sheet_id=${sheet._id}`,
        });
      }
    }

    await sheet.save();
    res.status(200).json({
      message: hasLiked ? "Đã bỏ thích" : "Đã thích",
      liked_by: sheet.liked_by,
      likes_count: sheet.likes_count,
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi thả tim", error: error.message });
  }
};

// [GET] LẤY THÔNG TIN NHẠC PHỔ THEO ID (dùng cho notification redirect)
exports.getSheetById = async (req, res) => {
  try {
    const sheet = await SheetMusic.findById(req.params.id);

    // Trả 404 nếu không tồn tại hoặc đã bị frozen
    if (!sheet || sheet.is_frozen) {
      return res
        .status(404)
        .json({ message: "Không tìm thấy nhạc phổ nào phù hợp." });
    }

    const sheetObj = sheet.toObject();
    sheetObj.file_urls = sheetObj.file_urls || [];
    res.status(200).json(sheetObj);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Lỗi lấy thông tin nhạc phổ", error: error.message });
  }
};

const SheetMusic = require("../models/SheetMusic");
const JamProject = require("../models/JamProject");
const AudioTrack = require("../models/AudioTrack");
const Notification = require("../models/Notification");
const User = require("../models/User");
const cloudinary = require("../config/cloudinary");
const { Readable } = require("stream");

// [POST] TẠO NHẠC PHỔ MỚI (Xử lý PDF thành mảng ảnh qua Cloudinary)
// [POST] TẠO NHẠC PHỔ MỚI (Dùng sức mạnh đếm trang tích hợp sẵn của Cloudinary)
exports.createSheet = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Vui lòng đính kèm file PDF!" });
    }

    const { title, composer, instrument_tags, tempo, genre, time_signature } =
      req.body;

    // 1. Upload file PDF gốc lên Cloudinary NGAY VÀ LUÔN (Không cần đếm trang trước)
    const uploadToCloudinary = (buffer) => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "jamsheet_sheets",
            resource_type: "image",
            format: "pdf",
            pages: true, // Yêu cầu Cloudinary trả về số trang trong PDF
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result); // result này sẽ chứa thuộc tính 'pages' siêu xịn
          },
        );
        const { Readable } = require("stream");
        const stream = Readable.from([buffer]);
        stream.pipe(uploadStream);
      });
    };

    const cloudResult = await uploadToCloudinary(req.file.buffer);

    // 2. LẤY TỔNG SỐ TRANG TỪ CHÍNH CLOUDINARY
    // Tránh lỗi nếu Cloudinary không trả về (VD: file lỗi), mặc định là 1 trang
    const totalPages = cloudResult.pages || 1;

    if (totalPages === 0) {
      return res
        .status(400)
        .json({ message: "File PDF không có trang hợp lệ!" });
    }

    // 3. Tạo mảng link ảnh từ link PDF (Sử dụng pg_x transformation của Cloudinary)
    const file_urls = [];
    const baseUrl = cloudResult.secure_url;

    for (let i = 1; i <= totalPages; i++) {
      const imageUrl = baseUrl
        .replace("/upload/", `/upload/pg_${i}/`)
        .replace(".pdf", ".jpg");
      file_urls.push(imageUrl);
    }

    // 4. Lưu vào Database
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
      file_url: file_urls[0], // Link trang đầu làm thumbnail (luôn tồn tại)
      file_urls: file_urls, // Mảng toàn bộ các trang ảnh (luôn có ít nhất 1 trang)
    });

    await newSheet.save();

    // Đảm bảo response luôn có file_urls là array không bao giờ undefined
    const responseData = newSheet.toObject();
    responseData.file_urls = responseData.file_urls || [];

    res
      .status(201)
      .json({ message: "Tải lên thành công!", sheet: responseData });
  } catch (error) {
    console.error("Lỗi xử lý PDF:", error);
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
      .sort({ likes_count: -1 })
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
      { new: true },
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
    } else {
      sheet.liked_by.push(userId);
      if (sheet.uploader_id.toString() !== userId) {
        await Notification.create({
          recipient_id: sheet.uploader_id,
          sender_name: senderName,
          type: "sheet_like",
          target_id: sheet._id,
          target_name: sheet.title,
          target_link: `/sheets-library?q=${encodeURIComponent(sheet.title)}`,
        });
      }
    }

    await sheet.save();
    res
      .status(200)
      .json({
        message: hasLiked ? "Đã bỏ thích" : "Đã thích",
        liked_by: sheet.liked_by,
      });
  } catch (error) {
    res.status(500).json({ message: "Lỗi thả tim", error: error.message });
  }
};

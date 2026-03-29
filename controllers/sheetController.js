const SheetMusic = require("../models/SheetMusic");
const JamProject = require("../models/JamProject");
const cloudinary = require("../config/cloudinary");
const { Readable } = require("stream");

exports.createSheet = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ message: "Vui lòng đính kèm file nhạc phổ!" });
    }

    const { title, composer, instrument_tags, tempo, genre, time_signature } =
      req.body;

    // Hàm bọc Promise để chờ quá trình upload Cloudinary hoàn tất
    const uploadToCloudinary = (buffer) => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "jamsheet_sheets", // Tự động tạo thư mục này trên Cloudinary
            resource_type: "auto", // AUTO rất quan trọng: Cho phép nhận cả Ảnh và PDF
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          },
        );
        // Đẩy buffer (RAM) từ Multer vào stream của Cloudinary
        Readable.from(buffer).pipe(uploadStream);
      });
    };

    // Bắt đầu quá trình tải lên và lấy kết quả trả về
    const cloudResult = await uploadToCloudinary(req.file.buffer);

    // Xử lý mảng tags
    const tagsArray = instrument_tags
      ? instrument_tags
          .split(",")
          .map((tag) => tag.trim())
          .filter((tag) => tag !== "")
      : [];

    // Lưu thông tin kèm đường link URL xịn xò vào MongoDB
    const newSheet = new SheetMusic({
      title,
      composer: composer || "Unknown",
      uploader_id: req.user.userId,
      file_url: cloudResult.secure_url, // Lấy đường link HTTPS từ Cloudinary
      instrument_tags: tagsArray,
      tempo: Number(tempo) || 0,
      time_signature: time_signature || "4/4",
      genre: genre || "Other",
    });

    await newSheet.save();

    res.status(201).json({
      message: "Tải lên nhạc phổ thành công!",
      sheet: newSheet,
    });
  } catch (error) {
    console.error("Lỗi upload Cloudinary:", error);
    res
      .status(500)
      .json({ message: "Lỗi server khi xử lý file", error: error.message });
  }
};

exports.getMySheets = async (req, res) => {
  try {
    const sheets = await SheetMusic.find({ uploader_id: req.user.userId }).sort(
      { createdAt: -1 },
    );
    res.status(200).json(sheets);
  } catch (error) {
    res.status(500).json({
      message: "Lỗi server khi lấy danh sách nhạc phổ của bạn",
      error: error.message,
    });
  }
};

exports.getExploreSheets = async (req, res) => {
  try {
    const sheets = await SheetMusic.find().sort({ likes_count: -1 }).limit(20);
    res.status(200).json(sheets);
  } catch (error) {
    res.status(500).json({
      message: "Lỗi server khi lấy dữ liệu cộng đồng",
      error: error.message,
    });
  }
};

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
        .filter((tag) => tag !== "");
    }

    const updatedSheet = await SheetMusic.findOneAndUpdate(
      { _id: id, uploader_id: req.user.userId },
      { title, composer, instrument_tags: tagsArray, tempo, genre, time_signature },
      { new: true },
    );

    if (!updatedSheet) {
      return res.status(404).json({
        message: "Không tìm thấy nhạc phổ hoặc bạn không có quyền chỉnh sửa!",
      });
    }

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
      .json({ message: "Cập nhật nhạc phổ thành công!", sheet: updatedSheet });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi server khi cập nhật nhạc phổ",
      error: error.message,
    });
  }
};

exports.deleteSheet = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedSheet = await SheetMusic.findOneAndDelete({
      _id: id,
      uploader_id: req.user.userId,
    });

    if (!deletedSheet) {
      return res.status(404).json({
        message: "Không tìm thấy nhạc phổ hoặc bạn không có quyền xóa!",
      });
    }

    res.status(200).json({ message: "Xóa nhạc phổ thành công!" });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi server khi xóa nhạc phổ",
      error: error.message,
    });
  }
};

exports.toggleLike = async (req, res) => {
  try {
    const sheetId = req.params.id;
    const userId = req.user.userId;

    const sheet = await SheetMusic.findById(sheetId);
    if (!sheet) {
      return res.status(404).json({ message: "Nhạc phổ không tồn tại!" });
    }

    const hasLiked = sheet.liked_by.includes(userId);
    if (hasLiked) {
      sheet.liked_by.pull(userId);
    } else {
      sheet.liked_by.push(userId);
    }

    await sheet.save();

    res.status(200).json({
      message: hasLiked ? "Đã bỏ thích" : "Đã thích",
      liked_by: sheet.liked_by,
    });
  } catch (error) {
    res.status(500).json({
      message: "Lỗi server khi xử lý lượt thích",
      error: error.message,
    });
  }
};

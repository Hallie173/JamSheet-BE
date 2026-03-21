const User = require("../models/User");
const cloudinary = require("../config/cloudinary");
const { Readable } = require("stream");

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password_hash");
    if (!user) {
      return res.status(404).json({ message: "Người dùng không tồn tại!" });
    }
    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { username, bio, avatar_url, instruments } = req.body;

    const updatedUser = await User.findByIdAndUpdate(
      req.user.userId,
      { username, bio, avatar_url, instruments },
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

    // Hàm bọc Promise để chờ quá trình upload Cloudinary
    const uploadToCloudinary = (buffer) => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: "jamsheet_avatars", // Đưa vào một thư mục riêng biệt cho dễ quản lý
            // Không cần resource_type: "auto" vì fileFilter đã chặn chỉ cho ảnh đi qua
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          },
        );
        // Đẩy buffer ảnh vào stream
        Readable.from(buffer).pipe(uploadStream);
      });
    };

    // Đợi tải lên mây và lấy kết quả
    const cloudResult = await uploadToCloudinary(req.file.buffer);

    res.status(200).json({
      message: "Tải lên ảnh đại diện thành công!",
      avatar_url: cloudResult.secure_url, // Trả về link ảnh HTTPS xịn xò của Cloudinary
    });
  } catch (error) {
    console.error("Lỗi upload avatar:", error);
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

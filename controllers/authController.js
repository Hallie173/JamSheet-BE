const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");

exports.register = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email đã  được sử dụng" });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const newUser = new User({ username, email, password_hash });
    await newUser.save();
    res.status(201).json({ message: "Đăng ký tài khoản thành công" });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Lỗi dữ liệu",
        error: "Vui lòng cung cấp đầy đủ email và mật khẩu."
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ message: "Không tìm thấy tài khoản với email này!" });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ message: "Mật khẩu không chính xác!" });
    }

    const token = jwt.sign(
      { userId: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.status(200).json({
      message: "Đăng nhập thành công",
      token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        avatar_url: user.avatar_url,
      },
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server", error: error.message });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ message: "Không tìm thấy tài khoản với email này!" });
    }

    const resetToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "15m",
    });
    console.log("=== TOKEN TEST ===: ", resetToken);

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });

    const resetUrl = `http://localhost:5173/reset-password/${resetToken}`;

    const mailOptions = {
      from: process.env.MAIL_USER,
      to: user.email,
      subject: "[JamSheet] Yêu cầu đặt lại mật khẩu",
      html: `
        <h3>Xin chào ${user.username},</h3>
        <p>Bạn đã yêu cầu đặt lại mật khẩu tại JamSheet.</p>
        <p>Vui lòng click vào đường dẫn dưới đây để thiết lập mật khẩu mới (Link này có hiệu lực trong 15 phút):</p>
        <a href="${resetUrl}" style="padding: 10px 20px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 5px; display: inline-block;">Đổi Mật Khẩu Mới</a>
        <p>Nếu bạn không yêu cầu việc này, hãy bỏ qua email này.</p>
      `,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({
      message: "Email khôi phục đã được gửi. Vui lòng kiểm tra hộp thư.",
    });
  } catch (error) {
    res.status(500).json({ message: "Lỗi gửi email", error: error.message });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    // Sử dụng Fallback (|| {}) để đảm bảo không bao giờ destructure từ undefined
    const { token } = req.params || {};
    const { newPassword } = req.body || {};

    // 1. Kiểm tra đầu vào
    if (!token || !newPassword) {
      return res.status(400).json({ 
        message: "Thiếu dữ liệu", 
        error: "Vui lòng cung cấp đầy đủ token và mật khẩu mới." 
      });
    }

    // 2. Xác thực token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(400).json({ message: "Đường dẫn đã hết hạn." });
      }
      return res.status(400).json({ message: "Token không hợp lệ." });
    }

    // 3. Tìm user và kiểm tra sự tồn tại
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(400).json({ message: "Người dùng không tồn tại!" });
    }

    // 4. Mã hóa mật khẩu mới
    const salt = await bcrypt.genSalt(10);
    user.password_hash = await bcrypt.hash(newPassword, salt);
    
    // Cập nhật và lưu lại
    await user.save();

    return res.status(200).json({
      message: "Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.",
    });
  } catch (error) {
    console.error("Reset Password Error:", error);
    return res.status(500).json({ message: "Lỗi hệ thống", error: error.message });
  }
};
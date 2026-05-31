const Notification = require("../models/Notification");

exports.getNotifications = async (req, res) => {
  try {
    // 1. Tìm thông báo và Kéo (Populate) thêm thông tin người gửi từ bảng User
    const notifications = await Notification.find({ recipient_id: req.user.userId })
      .populate("sender_id", "avatar_url username name") // Trích xuất link ảnh và tên
      .sort({ updatedAt: -1 })
      .limit(20);
    // 2. Format lại dữ liệu để khớp với Frontend (Header.jsx đang mong đợi 'sender_avatar')
    const formattedNotifications = notifications.map(notif => {
      const notifObj = notif.toObject();
      
      // Nếu có dữ liệu người gửi được populate
      if (notifObj.sender_id) {
        notifObj.sender_avatar = notifObj.sender_id.avatar_url;
        // Cập nhật tên mới nhất đề phòng người dùng đổi tên
        notifObj.sender_name = notifObj.sender_id.username || notifObj.sender_id.name || notifObj.sender_name;
      }
      
      return notifObj;
    });
    res.status(200).json(formattedNotifications);
  } catch (error) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, { is_read: true });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server" });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany({ recipient_id: req.user.userId }, { is_read: true });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ message: "Lỗi server" });
  }
};
const Notification = require("../models/Notification");

exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient_id: req.user.userId })
      .sort({ updatedAt: -1 })
      .limit(20); // Lấy 20 thông báo gần nhất
    res.status(200).json(notifications);
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
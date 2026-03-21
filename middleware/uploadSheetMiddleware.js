const multer = require("multer");

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "application/pdf" ||
    file.mimetype.startsWith("image/")
  ) {
    cb(null, true);
  } else {
    cb(new Error("Chỉ cho phép tải lên các tệp PDF hoặc hình ảnh!"), false);
  }
};

module.exports = multer({ storage: storage, fileFilter: fileFilter });

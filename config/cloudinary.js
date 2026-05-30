const cloudinary = require("cloudinary").v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    upload_prefix: "https://api-ap.cloudinary.com", // Đảm bảo sử dụng endpoint API mới nhất
});

module.exports = cloudinary;
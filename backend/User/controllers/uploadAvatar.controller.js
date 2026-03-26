const { pool } = require("../../config/db");
const cloudinary = require("../../config/cloudinary");

exports.uploadAvatar = async (req, res) => {
  try {
    const userId = req.user.id;
    let newAvatarUrl;

    // ✅ Handle both base64 JSON and multipart file upload
    if (req.file) {
      // came from multer (form-data)
      newAvatarUrl = req.file.path;

    } else if (req.body.avatar) {
      // came from JSON base64
      const uploadResult = await cloudinary.uploader.upload(req.body.avatar, {
        folder: "fawry/avatars",
        transformation: [{ width: 300, height: 300, crop: "fill" }],
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
      });
      newAvatarUrl = uploadResult.secure_url;

    } else {
      return res.status(400).json({ message: "No image provided" });
    }

    // Get current avatar to delete old one
    const current = await pool.query(
      `SELECT avatar_url FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    const oldAvatarUrl = current.rows[0]?.avatar_url;

    // Delete old avatar from Cloudinary if exists
    if (oldAvatarUrl) {
      try {
        const parts = oldAvatarUrl.split("/");
        const filename = parts[parts.length - 1].split(".")[0];
        const publicId = `fawry/avatars/${filename}`;
        await cloudinary.uploader.destroy(publicId);
      } catch (deleteErr) {
        console.error("Failed to delete old avatar:", deleteErr.message);
      }
    }

    // Save new avatar URL to DB
    const result = await pool.query(
      `UPDATE users 
       SET avatar_url = $1 
       WHERE id = $2
       RETURNING id, name, email, avatar_url`,
      [newAvatarUrl, userId]
    );

    return res.status(200).json({
      message: "Avatar uploaded successfully",
      user: result.rows[0],
    });

  } catch (err) {
    if (err.message === "Only jpg, png, and webp images are allowed") {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "Image must be less than 2MB" });
    }
    console.error("uploadAvatar error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
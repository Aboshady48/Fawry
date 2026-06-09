const { pool } = require("../../config/db");

exports.uploadAvatar = async (req, res) => {
  try {
    console.log("USER:", req.user);
    console.log("FILE:", req.file);

    if (!req.file) {
      return res.status(400).json({
        message: "No file uploaded",
      });
    }

    const avatarUrl = req.file.path;

    const result = await pool.query(
      `
      UPDATE users
      SET avatar_url = $1
      WHERE id = $2
      RETURNING *
      `,
      [avatarUrl, req.user.id]
    );

    return res.status(200).json({
      message: "Avatar uploaded",
      user: result.rows[0],
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: err.message,
      stack: err.stack,
    });
  }
};
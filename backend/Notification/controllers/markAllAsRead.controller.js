const { pool } = require("../../config/db");

exports.markAllAsRead = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE user_id = $1
       AND   is_read = FALSE
       RETURNING id`,
      [userId]
    );

    return res.status(200).json({
      message:       "All notifications marked as read",
      updated_count: result.rowCount,
    });

  } catch (err) {
    console.error("markAllAsRead error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
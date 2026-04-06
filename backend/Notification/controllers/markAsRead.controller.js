const { pool } = require("../../config/db");

exports.markAsRead = async (req, res) => {
  const { id }  = req.params;
  const userId  = req.user.id;

  if (isNaN(id)) {
    return res.status(400).json({ message: "Invalid notification ID" });
  }

  try {
    const result = await pool.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE id      = $1
       AND   user_id = $2
       RETURNING id, title, is_read`,
      [id, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Notification not found" });
    }

    return res.status(200).json({
      message:      "Notification marked as read",
      notification: result.rows[0],
    });

  } catch (err) {
    console.error("markAsRead error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
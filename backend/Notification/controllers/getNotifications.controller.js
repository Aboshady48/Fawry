const { pool } = require("../../config/db");

exports.getNotifications = async (req, res) => {
  const userId = req.user.id;

  try {
    // 1. Pagination
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    // 2. Filter params
    const { type, is_read } = req.query;

    // 3. Build WHERE clause
    const conditions = [`n.user_id = $1`];
    const values     = [userId];
    let index        = 2;

    if (type) {
      conditions.push(`n.type = $${index++}`);
      values.push(type);
    }

    if (is_read !== undefined) {
      conditions.push(`n.is_read = $${index++}`);
      values.push(is_read === "true");
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    // 4. Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM notifications n ${whereClause}`,
      values
    );

    const totalNotifications = parseInt(countResult.rows[0].count);
    const totalPages         = Math.ceil(totalNotifications / limit);

    // 5. Get unread count
    const unreadResult = await pool.query(
      `SELECT COUNT(*) FROM notifications
       WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );

    const unreadCount = parseInt(unreadResult.rows[0].count);

    // 6. Get notifications
    const notifResult = await pool.query(
      `SELECT
        n.id,
        n.type,
        n.title,
        n.body,
        n.is_read,
        n.metadata,
        n.created_at
       FROM notifications n
       ${whereClause}
       ORDER BY n.created_at DESC
       LIMIT $${index++} OFFSET $${index++}`,
      [...values, limit, offset]
    );

    return res.status(200).json({
      page,
      limit,
      total_notifications: totalNotifications,
      total_pages:         totalPages,
      has_next:            page < totalPages,
      has_prev:            page > 1,
      unread_count:        unreadCount,
      notifications: notifResult.rows.map((n) => ({
        id:         n.id,
        type:       n.type,
        title:      n.title,
        body:       n.body,
        is_read:    n.is_read,
        metadata:   n.metadata,
        created_at: n.created_at,
      })),
    });

  } catch (err) {
    console.error("getNotifications error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
const { pool } = require("../../config/db");

const VALID_STATUSES = ["active", "suspended", "banned"];

exports.updateUserStatus = async (req, res) => {
  const { id }     = req.params;
  const { status, reason } = req.body;
  const adminId    = req.user.id;

  // 1. Validate user ID
  if (isNaN(id)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  // 2. Validate status
  if (!status) {
    return res.status(400).json({ message: "Status is required" });
  }

  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}`,
    });
  }

  // 3. Reason required when suspending or banning
  if ((status === "suspended" || status === "banned") && !reason) {
    return res.status(400).json({
      message: "Reason is required when suspending or banning a user",
    });
  }

  try {
    // 4. Find the target user
    const userResult = await pool.query(
      `SELECT id, name, email, role, status FROM users WHERE id = $1 LIMIT 1`,
      [id]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const targetUser = userResult.rows[0];

    // 5. Prevent admin from changing their own status
    if (targetUser.id === adminId) {
      return res.status(403).json({ message: "You cannot change your own status" });
    }

    // 6. Prevent changing another admin's status (only super_admin can)
    if (targetUser.role === "admin") {
      // Check if current admin is super_admin
      const adminCheck = await pool.query(
        `SELECT admin_role FROM admins WHERE user_id = $1 LIMIT 1`,
        [adminId]
      );

      if (adminCheck.rows[0]?.admin_role !== "super_admin") {
        return res.status(403).json({
          message: "Only super admins can change another admin's status",
        });
      }
    }

    // 7. If status is same as current
    if (targetUser.status === status) {
      return res.status(400).json({
        message: `User is already ${status}`,
      });
    }

    // 8. Update status + log the action in one transaction
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Update user status
      const updated = await client.query(
        `UPDATE users 
         SET status = $1 
         WHERE id = $2
         RETURNING id, name, email, role, status`,
        [status, id]
      );

      // Log admin action
      const adminRecord = await client.query(
        `SELECT id FROM admins WHERE user_id = $1 LIMIT 1`,
        [adminId]
      );

      if (adminRecord.rowCount > 0) {
        await client.query(
          `INSERT INTO admin_logs 
            (admin_id, action, target_table, target_id, description, ip_address)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            adminRecord.rows[0].id,
            `USER_${status.toUpperCase()}`,
            "users",
            id,
            reason || `User status changed to ${status}`,
            req.ip,
          ]
        );
      }

      await client.query("COMMIT");

      return res.status(200).json({
        message: `User has been ${status} successfully`,
        user: updated.rows[0],
      });

    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

  } catch (err) {
    console.error("updateUserStatus error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
const { pool } = require("../../config/db");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const isStrongPassword = (password) => {
  const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return regex.test(password);
};

exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ message: "All fields are required" });
  }

  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({
      message: "Password must be at least 8 characters and include uppercase, lowercase, number, and special character",
    });
  }

  try {
    // 1. Hash the incoming token with SHA256 to compare with DB
    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    // 2. Find matching token directly in DB (no loop needed!)
    const result = await pool.query(
      `SELECT pr.id, pr.user_id
       FROM password_resets pr
       WHERE pr.token = $1
       AND pr.used = FALSE
       AND pr.expires_at > NOW()
       LIMIT 1`,
      [hashedToken]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ message: "Invalid or expired token" });
    }

    const reset = result.rows[0];

    // 3. Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 4. Update password + mark token as used in one transaction
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      await client.query(
        `UPDATE users SET password = $1 WHERE id = $2`,
        [hashedPassword, reset.user_id]
      );

      await client.query(
        `UPDATE password_resets SET used = TRUE WHERE id = $1`,
        [reset.id]
      );

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

    return res.status(200).json({ message: "Password reset successfully" });

  } catch (err) {
    console.error("resetPassword error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
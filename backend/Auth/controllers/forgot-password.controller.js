const { pool } = require("../../config/db");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { sendResetTokenEmail } = require("../../services/email.service");

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const result = await pool.query(
      "SELECT id, email FROM users WHERE email = $1 LIMIT 1",
      [email]
    );

    if (result.rowCount === 0) {
      return res.status(200).json({
        message: "If this email is registered, a reset link has been sent",
      });
    }

    const user = result.rows[0];

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = await bcrypt.hash(rawToken, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await pool.query(
      `UPDATE users 
       SET reset_token = $1, reset_token_expires_at = $2 
       WHERE id = $3`,
      [hashedToken, expiresAt, user.id]
    );

    await sendResetTokenEmail(user.email, rawToken);

    return res.status(200).json({
      message: "If this email is registered, a reset link has been sent",
    });

  } catch (err) {
    console.error("forgotPassword error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

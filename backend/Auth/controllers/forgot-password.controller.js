const { pool } = require("../../config/db");
const crypto = require("crypto");
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

    await pool.query(
      `UPDATE password_resets SET used = TRUE WHERE user_id = $1 AND used = FALSE`,
      [user.id]
    );

    const rawToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await pool.query(
      `INSERT INTO password_resets (user_id, token, expires_at) VALUES ($1, $2, $3)`,
      [user.id, hashedToken, expiresAt]
    );

    // ✅ Try to send email but don't crash if it fails
    try {
      await sendResetTokenEmail(user.email, rawToken);
      console.log("Email sent ✅");
    } catch (emailErr) {
      console.error("Email failed (but token was saved):", emailErr.message);
    }

    // ✅ Always return the raw token in dev mode for testing
    return res.status(200).json({
      message: "If this email is registered, a reset link has been sent",
      ...(process.env.NODE_ENV !== "production" && { resetToken: rawToken }),
    });

  } catch (err) {
    console.error("forgotPassword error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
const { pool } = require("../../config/db");
const twilio = require("twilio");

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// ─── Step 1: Request phone change ────────────────────────────────────────────
exports.requestChangePhone = async (req, res) => {
  const { newPhone } = req.body;
  const userId = req.user.id;

  // 1. Validate input
  if (!newPhone) {
    return res.status(400).json({ message: "New phone number is required" });
  }

  // 2. Validate phone format
  const phoneRegex = /^\+?[1-9]\d{7,14}$/;
  if (!phoneRegex.test(newPhone.replace(/\s/g, ""))) {
    return res.status(400).json({ message: "Invalid phone number format" });
  }

  // 3. Clean phone number (remove spaces)
  const cleanPhone = newPhone.replace(/\s/g, "");

  try {
    // 4. Check phone not already taken
    const phoneCheck = await pool.query(
      `SELECT id FROM users WHERE phone = $1 AND id != $2 LIMIT 1`,
      [cleanPhone, userId]
    );

    if (phoneCheck.rowCount > 0) {
      return res.status(409).json({ message: "Phone number is already taken" });
    }

    // 5. Check it's not the same as current phone
    const currentUser = await pool.query(
      `SELECT phone FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    if (currentUser.rows[0].phone === cleanPhone) {
      return res.status(400).json({ message: "New phone must be different from current phone" });
    }

    // 6. Expire any previous OTPs for this user
    await pool.query(
      `UPDATE otps SET status = 'expired' 
       WHERE user_id = $1 AND status = 'pending'`,
      [userId]
    );

    // 7. Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // 8. Save OTP to DB
    await pool.query(
      `INSERT INTO otps (user_id, phone, code, status, expires_at)
       VALUES ($1, $2, $3, 'pending', $4)`,
      [userId, cleanPhone, otp, expiresAt]
    );

    // 9. Send OTP via SMS
    try {
      await client.messages.create({
        body: `Your Fawry phone change verification code is: ${otp}. Valid for 10 minutes.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: cleanPhone,
      });
    } catch (smsErr) {
      console.error("SMS failed:", smsErr.message);
    }

    return res.status(200).json({
      message: "OTP sent to your new phone number",
      // only in development
      ...(process.env.NODE_ENV !== "production" && { otp }),
    });

  } catch (err) {
    console.error("requestChangePhone error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

// ─── Step 2: Verify OTP and update phone ─────────────────────────────────────
exports.verifyChangePhone = async (req, res) => {
  const { otp } = req.body;
  const userId = req.user.id;

  // 1. Validate input
  if (!otp) {
    return res.status(400).json({ message: "OTP is required" });
  }

  try {
    // 2. Find latest valid OTP for this user
    const otpResult = await pool.query(
      `SELECT id, phone, code FROM otps
       WHERE user_id = $1
       AND status = 'pending'
       AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (otpResult.rowCount === 0) {
      return res.status(400).json({ message: "OTP expired or not found" });
    }

    const otpRecord = otpResult.rows[0];

    // 3. Check OTP matches
    if (otpRecord.code !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // 4. Update phone + mark OTP as verified in one transaction
    const client2 = await pool.connect();
    try {
      await client2.query("BEGIN");

      await client2.query(
        `UPDATE users SET phone = $1 WHERE id = $2`,
        [otpRecord.phone, userId]
      );

      await client2.query(
        `UPDATE otps SET status = 'verified' WHERE id = $1`,
        [otpRecord.id]
      );

      await client2.query("COMMIT");
    } catch (err) {
      await client2.query("ROLLBACK");
      throw err;
    } finally {
      client2.release();
    }

    return res.status(200).json({ message: "Phone number updated successfully" });

  } catch (err) {
    console.error("verifyChangePhone error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
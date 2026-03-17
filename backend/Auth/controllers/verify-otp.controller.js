const { pool } = require("../../config/db");

exports.verifyOtp = async (req, res) => {
  const { phone, code } = req.body;

  // 1. Basic validation
  if (!phone || !code) {
    return res.status(400).json({ message: "Phone and OTP code are required" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 2. Find the most recent pending OTP for this phone
    const otpResult = await client.query(
      `SELECT otps.id, otps.code, otps.expires_at, otps.status, users.id AS user_id, users.is_verified
       FROM otps
       JOIN users ON otps.user_id = users.id
       WHERE otps.phone = $1
         AND otps.status = 'pending'
       ORDER BY otps.created_at DESC
       LIMIT 1`,
      [phone]
    );

    // 3. No OTP found for this phone
    if (otpResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "No pending OTP found for this phone number" });
    }

    const otp = otpResult.rows[0];

    // 4. Check if already verified
    if (otp.is_verified) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Account is already verified" });
    }

    // 5. Check if OTP is expired
    if (new Date() > new Date(otp.expires_at)) {
      // mark it as expired in DB
      await client.query(
        "UPDATE otps SET status = 'expired' WHERE id = $1",
        [otp.id]
      );
      await client.query("COMMIT");
      return res.status(410).json({ message: "OTP has expired. Please request a new one" });
    }

    // 6. Check if code matches
    if (otp.code !== code) {
      await client.query("ROLLBACK");
      return res.status(401).json({ message: "Invalid OTP code" });
    }

    // 7. Mark OTP as verified
    await client.query(
      "UPDATE otps SET status = 'verified' WHERE id = $1",
      [otp.id]
    );

    // 8. Activate the user account
    await client.query(
      "UPDATE users SET is_verified = TRUE WHERE id = $1",
      [otp.user_id]
    );

    await client.query("COMMIT");

    return res.status(200).json({
      message: "Phone verified successfully. You can now log in.",
    });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Verify OTP error:", err.message);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};
const { pool } = require("../../config/db");
const bcrypt = require("bcryptjs");

exports.setPin = async (req, res) => {
  const { pin } = req.body;
  const userId = req.user.id;

  // 1. Validate input
  if (!pin) {
    return res.status(400).json({ message: "PIN is required" });
  }

  // 2. PIN must be exactly 4 digits
  const pinRegex = /^\d{4}$/;
  if (!pinRegex.test(pin)) {
    return res.status(400).json({ message: "PIN must be exactly 4 digits" });
  }

  try {
    // 3. Check if user already has a PIN
    const result = await pool.query(
      `SELECT id, pin FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];

    if (user.pin) {
      return res.status(400).json({
        message: "PIN already set. Use change-pin endpoint instead",
      });
    }

    // 4. Hash and save PIN
    const hashedPin = await bcrypt.hash(pin, 10);

    await pool.query(
      `UPDATE users SET pin = $1 WHERE id = $2`,
      [hashedPin, userId]
    );

    return res.status(200).json({ message: "PIN set successfully" });

  } catch (err) {
    console.error("setPin error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
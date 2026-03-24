const { pool } = require("../../config/db");
const bcrypt = require("bcryptjs");

exports.changePin = async (req, res) => {
  const { oldPin, newPin } = req.body;
  const userId = req.user.id; // from JWT middleware

  // 1. Validate input
  if (!oldPin || !newPin) {
    return res.status(400).json({ message: "Old PIN and new PIN are required" });
  }

  // 2. PIN must be exactly 4 digits
  const pinRegex = /^\d{4}$/;
  if (!pinRegex.test(newPin)) {
    return res.status(400).json({ message: "PIN must be exactly 4 digits" });
  }

  // 3. Old and new PIN must be different
  if (oldPin === newPin) {
    return res.status(400).json({ message: "New PIN must be different from old PIN" });
  }

  try {
    // 4. Get user from DB
    const result = await pool.query(
      `SELECT id, pin FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];

    // 5. If user has no PIN yet, they must use set-pin endpoint instead
    if (!user.pin) {
      return res.status(400).json({
        message: "You have no PIN set yet. Please set a PIN first",
      });
    }

    // 6. Verify old PIN
    const isMatch = await bcrypt.compare(oldPin, user.pin);
    if (!isMatch) {
      return res.status(401).json({ message: "Old PIN is incorrect" });
    }

    // 7. Hash new PIN
    const hashedPin = await bcrypt.hash(newPin, 10);

    // 8. Update PIN in DB
    await pool.query(
      `UPDATE users SET pin = $1 WHERE id = $2`,
      [hashedPin, userId]
    );

    return res.status(200).json({ message: "PIN changed successfully" });

  } catch (err) {
    console.error("changePin error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
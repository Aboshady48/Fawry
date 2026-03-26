const { pool } = require("../../config/db");

exports.updateMe = async (req, res) => {
  const { name, email } = req.body;
  const userId = req.user.id;

  // 1. At least one field required
  if (!name && !email) {
    return res.status(400).json({ message: "At least one field is required (name or email)" });
  }

  // 2. Validate name length
  if (name && name.trim().length < 2) {
    return res.status(400).json({ message: "Name must be at least 2 characters" });
  }

  // 3. Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (email && !emailRegex.test(email)) {
    return res.status(400).json({ message: "Invalid email format" });
  }

  try {
    // 4. If email is changing, check it's not taken by another user
    if (email) {
      const emailCheck = await pool.query(
        `SELECT id FROM users WHERE email = $1 AND id != $2 LIMIT 1`,
        [email, userId]
      );

      if (emailCheck.rowCount > 0) {
        return res.status(409).json({ message: "Email is already taken" });
      }
    }

    // 5. Build query dynamically (only update fields that were provided)
    const fields = [];
    const values = [];
    let index = 1;

    if (name) {
      fields.push(`name = $${index++}`);
      values.push(name.trim());
    }

    if (email) {
      fields.push(`email = $${index++}`);
      values.push(email.toLowerCase().trim());
    }

    values.push(userId);

    const result = await pool.query(
      `UPDATE users 
       SET ${fields.join(", ")} 
       WHERE id = $${index}
       RETURNING id, name, email, phone, role, status, avatar_url, updated_at`,
      values
    );

    const updatedUser = result.rows[0];

    return res.status(200).json({
      message: "Profile updated successfully",
      user: updatedUser,
    });

  } catch (err) {
    console.error("updateMe error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
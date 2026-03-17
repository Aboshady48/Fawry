const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../../config/db");

exports.loginController = async (req, res) => {
  const { email, password } = req.body;

  // 1. Basic validation
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    // 2. Find user by email
    const result = await pool.query(
      `SELECT id, name, email, phone, role, password, status, is_verified
       FROM users WHERE email = $1 LIMIT 1`,
      [email]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Invalid email or password" });
    }

    const user = result.rows[0];

    // 3. Check if account is active
    if (user.status === "suspended" || user.status === "banned") {
      return res.status(403).json({ message: "Account is suspended or banned" });
    }

    // 4. Compare password with hashed password in DB
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    // 5. Check if phone is verified
    if (!user.is_verified) {
      return res.status(403).json({ message: "Please verify your phone number first" });
    }

    // 6. Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 7. Return token and user (never return the password)
    return res.status(200).json({
      message: "Login successful",
      token,
      user: {
        id:          user.id,
        name:        user.name,
        email:       user.email,
        phone:       user.phone,
        role:        user.role,
        is_verified: user.is_verified,
      },
    });

  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
};
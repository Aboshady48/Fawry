const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../../config/db");

exports.loginController = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required" });
  }

  try {
    const result = await pool.query(
      `SELECT id, name, email, phone, role, password, status, is_verified
       FROM users WHERE email = $1 LIMIT 1`,
      [email]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const user = result.rows[0];

    if (user.status === "suspended" || user.status === "banned") {
      return res.status(403).json({ message: "Account is suspended or banned" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    if (!user.is_verified) {
      return res.status(403).json({ message: "Please verify your phone number first" });
    }

    // access token — short lived
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    // refresh token — long lived
    const refreshToken = jwt.sign(
      { id: user.id },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    // save refresh token to DB
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO refresh_tokens (user_id, token, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, refreshToken, expiresAt]
    );

    return res.status(200).json({
      message: "Login successful",
      accessToken,
      refreshToken,
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
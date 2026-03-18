const jwt = require("jsonwebtoken");
const { pool } = require("../../config/db");

exports.logoutController = async (req, res) => {
  const { refreshToken } = req.body;

  // 1. Basic validation
  if (!refreshToken) {
    return res.status(400).json({ message: "Refresh token is required" });
  }

  try {
    // 2. Verify JWT signature first before touching the DB
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    // 3. Find token in DB
    const result = await pool.query(
      "SELECT id, revoked, expires_at FROM refresh_tokens WHERE token = $1 LIMIT 1",
      [refreshToken]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const token = result.rows[0];

    // 4. Check if already revoked
    if (token.revoked) {
      return res.status(401).json({ message: "Already logged out" });
    }

    // 5. Check if expired
    if (new Date() > new Date(token.expires_at)) {
      return res.status(401).json({ message: "Refresh token has already expired" });
    }

    // 6. Revoke the token
    await pool.query(
      "UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1",
      [token.id]
    );

    // 7. Clean up all expired tokens for this user (good hygiene)
    await pool.query(
      "DELETE FROM refresh_tokens WHERE user_id = $1 AND expires_at < NOW()",
      [decoded.id]
    );

    return res.status(200).json({ message: "Logged out successfully" });

  } catch (err) {
    console.error("Logout error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
};
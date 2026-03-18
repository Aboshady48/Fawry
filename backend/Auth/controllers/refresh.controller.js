const jwt = require("jsonwebtoken");
const { pool } = require("../../config/db");

exports.refreshController = async (req, res) => {
  const { refreshToken } = req.body;

  // 1. Basic validation
  if (!refreshToken) {
    return res.status(400).json({ message: "Refresh token is required" });
  }

  try {
    // 2. Find refresh token in DB
    const result = await pool.query(
      `SELECT rt.id, rt.user_id, rt.expires_at, rt.revoked,
              u.email, u.role, u.status
       FROM refresh_tokens rt
       JOIN users u ON rt.user_id = u.id
       WHERE rt.token = $1 LIMIT 1`,
      [refreshToken]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const token = result.rows[0];

    // 3. Check if revoked
    if (token.revoked) {
      return res.status(401).json({ message: "Refresh token has been revoked" });
    }

    // 4. Check if expired
    if (new Date() > new Date(token.expires_at)) {
      // mark it revoked so it can't be reused
      await pool.query(
        "UPDATE refresh_tokens SET revoked = TRUE WHERE id = $1",
        [token.id]
      );
      return res.status(401).json({ message: "Refresh token has expired, please login again" });
    }

    // 5. Check user is still active
    if (token.status === "suspended" || token.status === "banned") {
      return res.status(403).json({ message: "Account is suspended or banned" });
    }

    // 6. Generate new access token
    const accessToken = jwt.sign(
      { id: token.user_id, email: token.email, role: token.role },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    return res.status(200).json({ accessToken });

  } catch (err) {
    console.error("Refresh token error:", err.message);
    return res.status(500).json({ message: "Server error" });
  }
};
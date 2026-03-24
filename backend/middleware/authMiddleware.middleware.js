const jwt = require("jsonwebtoken");
const { pool } = require("../config/db");

const authMiddleware = async (req, res, next) => {
  try {
    // 1. Get token from header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];

    // 2. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Check user still exists and is active
    const result = await pool.query(
      `SELECT id, name, email, phone, role, status, is_verified 
       FROM users 
       WHERE id = $1 LIMIT 1`,
      [decoded.id]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ message: "User no longer exists" });
    }

    const user = result.rows[0];

    // 4. Check user is not suspended or banned
    if (user.status === "suspended") {
      return res.status(403).json({ message: "Your account has been suspended" });
    }

    if (user.status === "banned") {
      return res.status(403).json({ message: "Your account has been banned" });
    }

    // 5. Check user is verified
    if (!user.is_verified) {
      return res.status(403).json({ message: "Please verify your account first" });
    }

    // 6. Attach user to request
    req.user = user;

    next();

  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Token expired" });
    }
    if (err.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Invalid token" });
    }
    console.error("authMiddleware error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = authMiddleware;
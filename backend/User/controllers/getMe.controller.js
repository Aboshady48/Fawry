const { pool } = require("../../config/db");

exports.getMe = async (req, res) => {
  try {
    // req.user already has basic info from authMiddleware
    // but we fetch fresh data from DB to include wallet info too
    const result = await pool.query(
      `SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.role,
        u.status,
        u.is_verified,
        u.avatar_url,
        u.created_at,
        w.balance        AS wallet_balance,
        w.status         AS wallet_status
       FROM users u
       LEFT JOIN wallets w ON w.user_id = u.id
       WHERE u.id = $1
       LIMIT 1`,
      [req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];

    return res.status(200).json({
      id:             user.id,
      name:           user.name,
      email:          user.email,
      phone:          user.phone,
      role:           user.role,
      status:         user.status,
      is_verified:    user.is_verified,
      avatar_url:     user.avatar_url,
      created_at:     user.created_at,
      wallet: {
        balance:      user.wallet_balance,
        status:       user.wallet_status,
      },
    });

  } catch (err) {
    console.error("getMe error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
const { pool } = require("../../config/db");

exports.getUserById = async (req, res) => {
  const { id } = req.params;

  // 1. Validate id is a number
  if (isNaN(id)) {
    return res.status(400).json({ message: "Invalid user ID" });
  }

  try {
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
        u.updated_at,
        w.balance       AS wallet_balance,
        w.status        AS wallet_status,
        a.admin_role,
        a.can_manage_users,
        a.can_manage_wallets,
        a.can_view_reports,
        a.can_suspend_users,
        a.last_login    AS admin_last_login
       FROM users u
       LEFT JOIN wallets w ON w.user_id = u.id
       LEFT JOIN admins a  ON a.user_id = u.id
       WHERE u.id = $1
       LIMIT 1`,
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = result.rows[0];

    // 2. Build response based on role
    const response = {
      id:           user.id,
      name:         user.name,
      email:        user.email,
      phone:        user.phone,
      role:         user.role,
      status:       user.status,
      is_verified:  user.is_verified,
      avatar_url:   user.avatar_url,
      created_at:   user.created_at,
      updated_at:   user.updated_at,
      wallet: {
        balance:    user.wallet_balance,
        status:     user.wallet_status,
      },
    };

    // 3. If user is admin, include admin details
    if (user.role === "admin" && user.admin_role) {
      response.admin_details = {
        admin_role:           user.admin_role,
        can_manage_users:     user.can_manage_users,
        can_manage_wallets:   user.can_manage_wallets,
        can_view_reports:     user.can_view_reports,
        can_suspend_users:    user.can_suspend_users,
        last_login:           user.admin_last_login,
      };
    }

    return res.status(200).json(response);

  } catch (err) {
    console.error("getUserById error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
const { pool } = require("../../config/db");

exports.getAllUsers = async (req, res) => {
  try {
    // 1. Pagination params
    const page     = parseInt(req.query.page)  || 1;
    const limit    = parseInt(req.query.limit) || 10;
    const offset   = (page - 1) * limit;

    // 2. Filter params
    const { role, status, from, to, search } = req.query;

    // 3. Build dynamic WHERE clause
    const conditions = [];
    const values     = [];
    let index        = 1;

    if (role) {
      conditions.push(`u.role = $${index++}`);
      values.push(role);
    }

    if (status) {
      conditions.push(`u.status = $${index++}`);
      values.push(status);
    }

    if (from) {
      conditions.push(`u.created_at >= $${index++}`);
      values.push(new Date(from));
    }

    if (to) {
      conditions.push(`u.created_at <= $${index++}`);
      values.push(new Date(to));
    }

    if (search) {
      conditions.push(`(u.name ILIKE $${index} OR u.email ILIKE $${index} OR u.phone ILIKE $${index})`);
      values.push(`%${search}%`);
      index++;
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    // 4. Get total count for pagination
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM users u ${whereClause}`,
      values
    );
    const totalUsers = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalUsers / limit);

    // 5. Get users with wallet info
    const usersResult = await pool.query(
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
        w.balance     AS wallet_balance,
        w.status      AS wallet_status
       FROM users u
       LEFT JOIN wallets w ON w.user_id = u.id
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${index++} OFFSET $${index++}`,
      [...values, limit, offset]
    );

    return res.status(200).json({
      page,
      limit,
      total_users:  totalUsers,
      total_pages:  totalPages,
      has_next:     page < totalPages,
      has_prev:     page > 1,
      users: usersResult.rows.map((user) => ({
        id:           user.id,
        name:         user.name,
        email:        user.email,
        phone:        user.phone,
        role:         user.role,
        status:       user.status,
        is_verified:  user.is_verified,
        avatar_url:   user.avatar_url,
        created_at:   user.created_at,
        wallet: {
          balance:    user.wallet_balance,
          status:     user.wallet_status,
        },
      })),
    });

  } catch (err) {
    console.error("getAllUsers error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
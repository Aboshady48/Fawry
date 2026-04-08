const { pool } = require("../../config/db");

exports.getAllTransactions = async (req, res) => {
  try {
    // 1. Pagination
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // 2. Filter params
    const {
      user_id,
      type,
      status,
      from,
      to,
      min_amount,
      max_amount,
      search,
    } = req.query;

    // 3. Build WHERE clause
    const conditions = [];
    const values     = [];
    let index        = 1;

    if (user_id) {
      conditions.push(`t.user_id = $${index++}`);
      values.push(parseInt(user_id));
    }

    if (type) {
      conditions.push(`t.type = $${index++}`);
      values.push(type);
    }

    if (status) {
      conditions.push(`t.status = $${index++}`);
      values.push(status);
    }

    if (from) {
      conditions.push(`t.created_at >= $${index++}`);
      values.push(new Date(from));
    }

    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      conditions.push(`t.created_at <= $${index++}`);
      values.push(toDate);
    }

    if (min_amount) {
      conditions.push(`t.amount >= $${index++}`);
      values.push(parseFloat(min_amount));
    }

    if (max_amount) {
      conditions.push(`t.amount <= $${index++}`);
      values.push(parseFloat(max_amount));
    }

    if (search) {
      conditions.push(
        `(t.reference_no ILIKE $${index} 
          OR u.name        ILIKE $${index} 
          OR u.email       ILIKE $${index} 
          OR u.phone       ILIKE $${index})`
      );
      values.push(`%${search}%`);
      index++;
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    // 4. Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*)
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       ${whereClause}`,
      values
    );

    const totalTransactions = parseInt(countResult.rows[0].count);
    const totalPages        = Math.ceil(totalTransactions / limit);

    // 5. Get transactions with full details
    const txResult = await pool.query(
      `SELECT
        t.id,
        t.reference_no,
        t.type,
        t.status,
        t.amount,
        t.fee,
        t.payment_method,
        t.description,
        t.metadata,
        t.created_at,
        t.updated_at,
        u.id        AS user_id,
        u.name      AS user_name,
        u.email     AS user_email,
        u.phone     AS user_phone,
        u.role      AS user_role,
        w.balance   AS wallet_balance
       FROM transactions t
       JOIN users   u ON u.id = t.user_id
       JOIN wallets w ON w.id = t.wallet_id
       ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT $${index++} OFFSET $${index++}`,
      [...values, limit, offset]
    );

    // 6. Summary stats
    const statsResult = await pool.query(
      `SELECT
        COUNT(*)                                                            AS total,
        SUM(CASE WHEN t.status = 'completed' THEN t.amount ELSE 0 END)     AS total_volume,
        SUM(CASE WHEN t.status = 'completed' THEN t.fee    ELSE 0 END)     AS total_fees,
        COUNT(CASE WHEN t.status = 'completed'  THEN 1 END)                AS completed,
        COUNT(CASE WHEN t.status = 'failed'     THEN 1 END)                AS failed,
        COUNT(CASE WHEN t.status = 'pending'    THEN 1 END)                AS pending,
        COUNT(CASE WHEN t.status = 'reversed'   THEN 1 END)                AS reversed,
        COUNT(CASE WHEN t.type = 'topup'        THEN 1 END)                AS topups,
        COUNT(CASE WHEN t.type = 'transfer'     THEN 1 END)                AS transfers,
        COUNT(CASE WHEN t.type = 'bill_payment' THEN 1 END)                AS bills,
        COUNT(CASE WHEN t.type = 'withdrawal'   THEN 1 END)                AS withdrawals,
        COUNT(CASE WHEN t.type = 'refund'       THEN 1 END)                AS refunds
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       ${whereClause}`,
      values
    );

    const stats = statsResult.rows[0];

    return res.status(200).json({
      page,
      limit,
      total_transactions: totalTransactions,
      total_pages:        totalPages,
      has_next:           page < totalPages,
      has_prev:           page > 1,
      summary: {
        total:        parseInt(stats.total         || 0),
        total_volume: parseFloat(stats.total_volume || 0).toFixed(2),
        total_fees:   parseFloat(stats.total_fees   || 0).toFixed(2),
        by_status: {
          completed:  parseInt(stats.completed  || 0),
          failed:     parseInt(stats.failed     || 0),
          pending:    parseInt(stats.pending    || 0),
          reversed:   parseInt(stats.reversed   || 0),
        },
        by_type: {
          topups:       parseInt(stats.topups      || 0),
          transfers:    parseInt(stats.transfers   || 0),
          bills:        parseInt(stats.bills       || 0),
          withdrawals:  parseInt(stats.withdrawals || 0),
          refunds:      parseInt(stats.refunds     || 0),
        },
        currency: "EGP",
      },
      transactions: txResult.rows.map((tx) => ({
        id:             tx.id,
        reference_no:   tx.reference_no,
        type:           tx.type,
        status:         tx.status,
        amount:         parseFloat(tx.amount).toFixed(2),
        fee:            parseFloat(tx.fee).toFixed(2),
        payment_method: tx.payment_method,
        description:    tx.description,
        metadata:       tx.metadata,
        user: {
          id:             tx.user_id,
          name:           tx.user_name,
          email:          tx.user_email,
          phone:          tx.user_phone,
          role:           tx.user_role,
          wallet_balance: parseFloat(tx.wallet_balance).toFixed(2),
        },
        created_at: tx.created_at,
        updated_at: tx.updated_at,
      })),
    });

  } catch (err) {
    console.error("getAllTransactions error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
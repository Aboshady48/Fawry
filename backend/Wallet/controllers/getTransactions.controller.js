const { pool } = require("../../config/db");

exports.getTransactions = async (req, res) => {
  const userId = req.user.id;

  try {
    // 1. Pagination params
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // 2. Filter params
    const { type, status, from, to } = req.query;

    // 3. Build dynamic WHERE clause
    const conditions = [`t.user_id = $1`];
    const values     = [userId];
    let index        = 2;

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
      conditions.push(`t.created_at <= $${index++}`);
      values.push(new Date(to));
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    // 4. Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM transactions t ${whereClause}`,
      values
    );

    const totalTransactions = parseInt(countResult.rows[0].count);
    const totalPages        = Math.ceil(totalTransactions / limit);

    // 5. Get transactions
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
        t.updated_at
       FROM transactions t
       ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT $${index++} OFFSET $${index++}`,
      [...values, limit, offset]
    );

    // 6. Calculate summary stats
    const statsResult = await pool.query(
      `SELECT
        SUM(CASE WHEN t.type = 'topup'        AND t.status = 'completed' THEN t.amount ELSE 0 END) AS total_topup,
        SUM(CASE WHEN t.type = 'withdrawal'   AND t.status = 'completed' THEN t.amount ELSE 0 END) AS total_withdrawal,
        SUM(CASE WHEN t.type = 'transfer'     AND t.status = 'completed' THEN t.amount ELSE 0 END) AS total_transfer,
        SUM(CASE WHEN t.type = 'bill_payment' AND t.status = 'completed' THEN t.amount ELSE 0 END) AS total_bills,
        SUM(CASE WHEN t.status = 'completed'  THEN t.fee   ELSE 0 END)                             AS total_fees_paid
       FROM transactions t
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
        total_topup:      parseFloat(stats.total_topup      || 0).toFixed(2),
        total_withdrawal: parseFloat(stats.total_withdrawal || 0).toFixed(2),
        total_transfer:   parseFloat(stats.total_transfer   || 0).toFixed(2),
        total_bills:      parseFloat(stats.total_bills      || 0).toFixed(2),
        total_fees_paid:  parseFloat(stats.total_fees_paid  || 0).toFixed(2),
        currency:         "EGP",
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
        created_at:     tx.created_at,
        updated_at:     tx.updated_at,
      })),
    });

  } catch (err) {
    console.error("getTransactions error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
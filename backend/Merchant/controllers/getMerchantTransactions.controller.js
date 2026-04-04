const { pool } = require("../../config/db");

exports.getMerchantTransactions = async (req, res) => {
  const userId = req.user.id;

  try {
    // 1. Get merchant
    const merchantResult = await pool.query(
      `SELECT id FROM merchants WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    if (merchantResult.rowCount === 0) {
      return res.status(404).json({ message: "Merchant profile not found" });
    }

    const merchantId = merchantResult.rows[0].id;

    // 2. Pagination
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // 3. Filter params
    const { status, from, to, type } = req.query;

    // 4. Build WHERE clause
    const conditions = [`t.user_id = $1`];
    const values     = [userId];
    let index        = 2;

    if (status) {
      conditions.push(`t.status = $${index++}`);
      values.push(status);
    }

    if (type) {
      conditions.push(`t.type = $${index++}`);
      values.push(type);
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

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    // 5. Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM transactions t ${whereClause}`,
      values
    );

    const totalTransactions = parseInt(countResult.rows[0].count);
    const totalPages        = Math.ceil(totalTransactions / limit);

    // 6. Get transactions
    const txResult = await pool.query(
      `SELECT
        t.id,
        t.reference_no,
        t.type,
        t.status,
        t.amount,
        t.fee,
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

    // 7. Summary stats
    const statsResult = await pool.query(
      `SELECT
        COUNT(*)                                                          AS total_transactions,
        SUM(CASE WHEN t.status = 'completed' THEN t.amount ELSE 0 END)   AS total_volume,
        SUM(CASE WHEN t.status = 'completed' THEN t.fee    ELSE 0 END)   AS total_fees,
        COUNT(CASE WHEN t.status = 'completed' THEN 1 END)               AS successful,
        COUNT(CASE WHEN t.status = 'failed'    THEN 1 END)               AS failed,
        COUNT(CASE WHEN t.status = 'pending'   THEN 1 END)               AS pending,
        COUNT(CASE WHEN t.status = 'reversed'  THEN 1 END)               AS reversed
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
        total_transactions: parseInt(stats.total_transactions || 0),
        total_volume:       parseFloat(stats.total_volume     || 0).toFixed(2),
        total_fees:         parseFloat(stats.total_fees       || 0).toFixed(2),
        successful:         parseInt(stats.successful         || 0),
        failed:             parseInt(stats.failed             || 0),
        pending:            parseInt(stats.pending            || 0),
        reversed:           parseInt(stats.reversed           || 0),
        currency:           "EGP",
      },
      transactions: txResult.rows.map((tx) => ({
        id:             tx.id,
        reference_no:   tx.reference_no,
        type:           tx.type,
        status:         tx.status,
        amount:         parseFloat(tx.amount).toFixed(2),
        fee:            parseFloat(tx.fee).toFixed(2),
        description:    tx.description,
        metadata:       tx.metadata,
        created_at:     tx.created_at,
        updated_at:     tx.updated_at,
      })),
    });

  } catch (err) {
    console.error("getMerchantTransactions error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
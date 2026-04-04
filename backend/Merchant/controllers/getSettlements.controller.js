const { pool } = require("../../config/db");

exports.getSettlements = async (req, res) => {
  const userId = req.user.id;

  try {
    // 1. Get merchant
    const merchantResult = await pool.query(
      `SELECT m.id, m.business_name, m.iban
       FROM merchants m
       WHERE m.user_id = $1 LIMIT 1`,
      [userId]
    );

    if (merchantResult.rowCount === 0) {
      return res.status(404).json({ message: "Merchant profile not found" });
    }

    const merchant = merchantResult.rows[0];

    // 2. Pagination
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // 3. Filter params
    const { status, from, to } = req.query;

    // 4. Build WHERE clause
    const conditions = [`s.merchant_id = $1`];
    const values     = [merchant.id];
    let index        = 2;

    if (status) {
      conditions.push(`s.status = $${index++}`);
      values.push(status);
    }

    if (from) {
      conditions.push(`s.created_at >= $${index++}`);
      values.push(new Date(from));
    }

    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      conditions.push(`s.created_at <= $${index++}`);
      values.push(toDate);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    // 5. Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM settlements s ${whereClause}`,
      values
    );

    const totalSettlements = parseInt(countResult.rows[0].count);
    const totalPages       = Math.ceil(totalSettlements / limit);

    // 6. Get settlements
    const settlementsResult = await pool.query(
      `SELECT
        s.id,
        s.amount,
        s.fee,
        s.net_amount,
        s.currency,
        s.status,
        s.iban,
        s.bank_reference,
        s.period_from,
        s.period_to,
        s.settled_at,
        s.notes,
        s.created_at
       FROM settlements s
       ${whereClause}
       ORDER BY s.created_at DESC
       LIMIT $${index++} OFFSET $${index++}`,
      [...values, limit, offset]
    );

    // 7. Summary stats
    const statsResult = await pool.query(
      `SELECT
        COUNT(*)                                                              AS total_settlements,
        SUM(s.amount)                                                         AS total_gross,
        SUM(s.fee)                                                            AS total_fees,
        SUM(s.net_amount)                                                     AS total_net,
        SUM(CASE WHEN s.status = 'completed' THEN s.net_amount ELSE 0 END)   AS total_settled,
        SUM(CASE WHEN s.status = 'pending'   THEN s.net_amount ELSE 0 END)   AS total_pending
       FROM settlements s
       ${whereClause}`,
      values
    );

    const stats = statsResult.rows[0];

    return res.status(200).json({
      page,
      limit,
      total_settlements: totalSettlements,
      total_pages:       totalPages,
      has_next:          page < totalPages,
      has_prev:          page > 1,
      merchant: {
        id:            merchant.id,
        business_name: merchant.business_name,
        iban:          merchant.iban,
      },
      summary: {
        total_settlements: parseInt(stats.total_settlements || 0),
        total_gross:       parseFloat(stats.total_gross    || 0).toFixed(2),
        total_fees:        parseFloat(stats.total_fees     || 0).toFixed(2),
        total_net:         parseFloat(stats.total_net      || 0).toFixed(2),
        total_settled:     parseFloat(stats.total_settled  || 0).toFixed(2),
        total_pending:     parseFloat(stats.total_pending  || 0).toFixed(2),
        currency:          "EGP",
      },
      settlements: settlementsResult.rows.map((s) => ({
        id:             s.id,
        amount:         parseFloat(s.amount).toFixed(2),
        fee:            parseFloat(s.fee).toFixed(2),
        net_amount:     parseFloat(s.net_amount).toFixed(2),
        currency:       s.currency,
        status:         s.status,
        iban:           s.iban,
        bank_reference: s.bank_reference,
        period: {
          from: s.period_from,
          to:   s.period_to,
        },
        settled_at: s.settled_at,
        notes:      s.notes,
        created_at: s.created_at,
      })),
    });

  } catch (err) {
    console.error("getSettlements error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
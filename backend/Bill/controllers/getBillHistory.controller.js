const { pool } = require("../../config/db");

exports.getBillHistory = async (req, res) => {
  const userId = req.user.id;

  try {
    // 1. Pagination params
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // 2. Filter params
    const { biller_id, category, from, to } = req.query;

    // 3. Build dynamic WHERE clause
    const conditions = [`t.user_id = $1`, `t.type = 'bill_payment'`, `t.status = 'completed'`];
    const values     = [userId];
    let index        = 2;

    if (biller_id) {
      conditions.push(`(t.metadata->>'biller_id')::int = $${index++}`);
      values.push(parseInt(biller_id));
    }

    if (category) {
      conditions.push(`t.metadata->>'category' = $${index++}`);
      values.push(category);
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

    // 4. Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM transactions t ${whereClause}`,
      values
    );

    const totalBills = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalBills / limit);

    // 5. Get bill payments
    const billsResult = await pool.query(
      `SELECT
        t.id,
        t.reference_no,
        t.amount,
        t.fee,
        t.status,
        t.description,
        t.metadata,
        t.created_at,
        (t.metadata->>'biller_name')  AS biller_name,
        (t.metadata->>'category')     AS category,
        (t.metadata->>'account_ref')  AS account_ref,
        (t.metadata->>'biller_id')    AS biller_id
       FROM transactions t
       ${whereClause}
       ORDER BY t.created_at DESC
       LIMIT $${index++} OFFSET $${index++}`,
      [...values, limit, offset]
    );

    // 6. Summary stats
    const statsResult = await pool.query(
      `SELECT
        COUNT(*)          AS total_bills,
        SUM(t.amount)     AS total_spent,
        SUM(t.fee)        AS total_fees
       FROM transactions t
       ${whereClause}`,
      values
    );

    const stats = statsResult.rows[0];

    return res.status(200).json({
      page,
      limit,
      total_bills:  totalBills,
      total_pages:  totalPages,
      has_next:     page < totalPages,
      has_prev:     page > 1,
      summary: {
        total_bills:  parseInt(stats.total_bills),
        total_spent:  parseFloat(stats.total_spent  || 0).toFixed(2),
        total_fees:   parseFloat(stats.total_fees   || 0).toFixed(2),
        currency:     "EGP",
      },
      bills: billsResult.rows.map((bill) => ({
        id:           bill.id,
        reference_no: bill.reference_no,
        biller: {
          id:       bill.biller_id,
          name:     bill.biller_name,
          category: bill.category,
        },
        account_ref:  bill.account_ref,
        amount:       parseFloat(bill.amount).toFixed(2),
        fee:          parseFloat(bill.fee).toFixed(2),
        total_paid:   parseFloat(parseFloat(bill.amount) + parseFloat(bill.fee)).toFixed(2),
        currency:     "EGP",
        status:       bill.status,
        paid_at:      bill.created_at,
      })),
    });

  } catch (err) {
    console.error("getBillHistory error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
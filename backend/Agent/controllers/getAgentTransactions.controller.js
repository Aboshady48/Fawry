const { pool } = require("../../config/db");

exports.getAgentTransactions = async (req, res) => {
  const agentUserId = req.user.id;

  try {
    // 1. Get agent
    const agentResult = await pool.query(
      `SELECT id, business_name FROM agents WHERE user_id = $1 LIMIT 1`,
      [agentUserId]
    );

    if (agentResult.rowCount === 0) {
      return res.status(404).json({ message: "Agent profile not found" });
    }

    const agent = agentResult.rows[0];

    // 2. Pagination
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // 3. Filter params
    const { type, status, from, to } = req.query;

    // 4. Build WHERE clause
    const conditions = [`at.agent_id = $1`];
    const values     = [agent.id];
    let index        = 2;

    if (type) {
      conditions.push(`at.type = $${index++}`);
      values.push(type);
    }

    if (status) {
      conditions.push(`at.status = $${index++}`);
      values.push(status);
    }

    if (from) {
      conditions.push(`at.created_at >= $${index++}`);
      values.push(new Date(from));
    }

    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      conditions.push(`at.created_at <= $${index++}`);
      values.push(toDate);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    // 5. Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM agent_transactions at ${whereClause}`,
      values
    );

    const totalTransactions = parseInt(countResult.rows[0].count);
    const totalPages        = Math.ceil(totalTransactions / limit);

    // 6. Get transactions with customer info
    const txResult = await pool.query(
      `SELECT
        at.id,
        at.type,
        at.status,
        at.amount,
        at.fee,
        at.reference_no,
        at.note,
        at.created_at,
        u.name    AS customer_name,
        u.phone   AS customer_phone
       FROM agent_transactions at
       JOIN users u ON u.id = at.user_id
       ${whereClause}
       ORDER BY at.created_at DESC
       LIMIT $${index++} OFFSET $${index++}`,
      [...values, limit, offset]
    );

    // 7. Summary stats
    const statsResult = await pool.query(
      `SELECT
        COUNT(*)                                                              AS total,
        SUM(CASE WHEN at.type = 'cashin'  AND at.status = 'completed' THEN at.amount ELSE 0 END) AS total_cashin,
        SUM(CASE WHEN at.type = 'cashout' AND at.status = 'completed' THEN at.amount ELSE 0 END) AS total_cashout,
        SUM(CASE WHEN at.status = 'completed' THEN at.fee ELSE 0 END)        AS total_fees,
        COUNT(CASE WHEN at.status = 'completed' THEN 1 END)                  AS completed,
        COUNT(CASE WHEN at.status = 'failed'    THEN 1 END)                  AS failed
       FROM agent_transactions at
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
      agent: {
        id:            agent.id,
        business_name: agent.business_name,
      },
      summary: {
        total_transactions: parseInt(stats.total          || 0),
        total_cashin:       parseFloat(stats.total_cashin  || 0).toFixed(2),
        total_cashout:      parseFloat(stats.total_cashout || 0).toFixed(2),
        total_fees:         parseFloat(stats.total_fees    || 0).toFixed(2),
        completed:          parseInt(stats.completed       || 0),
        failed:             parseInt(stats.failed          || 0),
        currency:           "EGP",
      },
      transactions: txResult.rows.map((tx) => ({
        id:           tx.id,
        type:         tx.type,
        status:       tx.status,
        amount:       parseFloat(tx.amount).toFixed(2),
        fee:          parseFloat(tx.fee).toFixed(2),
        reference_no: tx.reference_no,
        note:         tx.note,
        customer: {
          name:  tx.customer_name,
          phone: tx.customer_phone,
        },
        created_at: tx.created_at,
      })),
    });

  } catch (err) {
    console.error("getAgentTransactions error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
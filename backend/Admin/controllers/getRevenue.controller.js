const { pool } = require("../../config/db");

exports.getRevenue = async (req, res) => {
  try {
    const { from, to } = req.query;

    // 1. Build date filter
    const conditions = [];
    const values     = [];
    let index        = 1;

    if (from) {
      conditions.push(`pr.created_at >= $${index++}`);
      values.push(new Date(from));
    }

    if (to) {
      conditions.push(`pr.created_at <= $${index++}`);
      values.push(new Date(to));
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    // 2. Get platform wallet summary
    const walletResult = await pool.query(
      `SELECT balance, total_earned FROM platform_wallet LIMIT 1`
    );

    const platformWallet = walletResult.rows[0];

    // 3. Get revenue breakdown by type
    const breakdownResult = await pool.query(
      `SELECT 
        pr.type,
        COUNT(*)              AS total_transactions,
        SUM(pr.amount)        AS total_amount
       FROM platform_revenue pr
       ${whereClause}
       GROUP BY pr.type
       ORDER BY total_amount DESC`,
      values
    );

    // 4. Get daily revenue for chart
    const dailyResult = await pool.query(
      `SELECT 
        DATE(pr.created_at)   AS date,
        SUM(pr.amount)        AS daily_revenue,
        COUNT(*)              AS transactions
       FROM platform_revenue pr
       ${whereClause}
       GROUP BY DATE(pr.created_at)
       ORDER BY date DESC
       LIMIT 30`,
      values
    );

    // 5. Get total revenue in date range
    const totalResult = await pool.query(
      `SELECT 
        COUNT(*)        AS total_transactions,
        SUM(pr.amount)  AS total_revenue
       FROM platform_revenue pr
       ${whereClause}`,
      values
    );

    const total = totalResult.rows[0];

    return res.status(200).json({
      platform_wallet: {
        current_balance: parseFloat(platformWallet.balance).toFixed(2),
        total_earned:    parseFloat(platformWallet.total_earned).toFixed(2),
        currency:        "EGP",
      },
      summary: {
        total_transactions: parseInt(total.total_transactions),
        total_revenue:      parseFloat(total.total_revenue || 0).toFixed(2),
        currency:           "EGP",
      },
      breakdown: breakdownResult.rows.map((row) => ({
        type:               row.type,
        total_transactions: parseInt(row.total_transactions),
        total_amount:       parseFloat(row.total_amount).toFixed(2),
      })),
      daily_revenue: dailyResult.rows.map((row) => ({
        date:         row.date,
        revenue:      parseFloat(row.daily_revenue).toFixed(2),
        transactions: parseInt(row.transactions),
      })),
    });

  } catch (err) {
    console.error("getRevenue error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
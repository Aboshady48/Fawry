const { pool } = require("../../config/db");

exports.getFloat = async (req, res) => {
  const agentUserId = req.user.id;

  try {
    // 1. Get agent with float balance and stats
    const agentResult = await pool.query(
      `SELECT
        a.id,
        a.business_name,
        a.location,
        a.float_balance,
        a.is_active,
        a.created_at,
        u.name,
        u.phone,
        u.email
       FROM agents a
       JOIN users u ON u.id = a.user_id
       WHERE a.user_id = $1 LIMIT 1`,
      [agentUserId]
    );

    if (agentResult.rowCount === 0) {
      return res.status(404).json({ message: "Agent profile not found" });
    }

    const agent = agentResult.rows[0];

    // 2. Get today's transaction stats
    const todayStatsResult = await pool.query(
      `SELECT
        COUNT(*)                                                            AS total_today,
        SUM(CASE WHEN at.type = 'cashin'  THEN at.amount ELSE 0 END)       AS cashin_today,
        SUM(CASE WHEN at.type = 'cashout' THEN at.amount ELSE 0 END)       AS cashout_today,
        SUM(at.fee)                                                         AS fees_today
       FROM agent_transactions at
       WHERE at.agent_id  = $1
       AND   at.status    = 'completed'
       AND   at.created_at >= CURRENT_DATE`,
      [agent.id]
    );

    // 3. Get overall stats
    const overallStatsResult = await pool.query(
      `SELECT
        COUNT(*)                                                            AS total_transactions,
        SUM(CASE WHEN at.type = 'cashin'  THEN at.amount ELSE 0 END)       AS total_cashin,
        SUM(CASE WHEN at.type = 'cashout' THEN at.amount ELSE 0 END)       AS total_cashout,
        SUM(at.fee)                                                         AS total_fees
       FROM agent_transactions at
       WHERE at.agent_id = $1
       AND   at.status   = 'completed'`,
      [agent.id]
    );

    const todayStats   = todayStatsResult.rows[0];
    const overallStats = overallStatsResult.rows[0];

    return res.status(200).json({
      agent: {
        id:             agent.id,
        business_name:  agent.business_name,
        location:       agent.location,
        is_active:      agent.is_active,
        owner: {
          name:   agent.name,
          phone:  agent.phone,
          email:  agent.email,
        },
      },
      float: {
        balance:  parseFloat(agent.float_balance).toFixed(2),
        currency: "EGP",
        status:   agent.is_active ? "active" : "suspended",
      },
      today: {
        total_transactions: parseInt(todayStats.total_today    || 0),
        total_cashin:       parseFloat(todayStats.cashin_today || 0).toFixed(2),
        total_cashout:      parseFloat(todayStats.cashout_today || 0).toFixed(2),
        fees_earned:        parseFloat(todayStats.fees_today   || 0).toFixed(2),
        currency:           "EGP",
      },
      overall: {
        total_transactions: parseInt(overallStats.total_transactions || 0),
        total_cashin:       parseFloat(overallStats.total_cashin     || 0).toFixed(2),
        total_cashout:      parseFloat(overallStats.total_cashout    || 0).toFixed(2),
        total_fees:         parseFloat(overallStats.total_fees       || 0).toFixed(2),
        currency:           "EGP",
      },
    });

  } catch (err) {
    console.error("getFloat error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
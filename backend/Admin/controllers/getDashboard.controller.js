const { pool } = require("../../config/db");

exports.getDashboard = async (req, res) => {
  try {

    // 1. Users stats
    const usersResult = await pool.query(
      `SELECT
        COUNT(*)                                                          AS total_users,
        COUNT(CASE WHEN role    = 'customer'  THEN 1 END)                AS total_customers,
        COUNT(CASE WHEN role    = 'merchant'  THEN 1 END)                AS total_merchants,
        COUNT(CASE WHEN role    = 'agent'     THEN 1 END)                AS total_agents,
        COUNT(CASE WHEN role    = 'admin'     THEN 1 END)                AS total_admins,
        COUNT(CASE WHEN status  = 'active'    THEN 1 END)                AS active_users,
        COUNT(CASE WHEN status  = 'suspended' THEN 1 END)                AS suspended_users,
        COUNT(CASE WHEN status  = 'banned'    THEN 1 END)                AS banned_users,
        COUNT(CASE WHEN is_verified = TRUE    THEN 1 END)                AS verified_users,
        COUNT(CASE WHEN created_at >= CURRENT_DATE THEN 1 END)           AS new_users_today
       FROM users`
    );

    // 2. Transactions today
    const todayTxResult = await pool.query(
      `SELECT
        COUNT(*)                                                          AS total_today,
        COUNT(CASE WHEN status = 'completed' THEN 1 END)                 AS completed_today,
        COUNT(CASE WHEN status = 'failed'    THEN 1 END)                 AS failed_today,
        COUNT(CASE WHEN status = 'pending'   THEN 1 END)                 AS pending_today,
        SUM(CASE WHEN status = 'completed'   THEN amount ELSE 0 END)     AS volume_today,
        SUM(CASE WHEN status = 'completed'   THEN fee    ELSE 0 END)     AS fees_today
       FROM transactions
       WHERE created_at >= CURRENT_DATE`
    );

    // 3. Overall transactions
    const overallTxResult = await pool.query(
      `SELECT
        COUNT(*)                                                          AS total_transactions,
        COUNT(CASE WHEN status = 'completed' THEN 1 END)                 AS total_completed,
        COUNT(CASE WHEN status = 'failed'    THEN 1 END)                 AS total_failed,
        COUNT(CASE WHEN status = 'reversed'  THEN 1 END)                 AS total_reversed,
        SUM(CASE WHEN status = 'completed'   THEN amount ELSE 0 END)     AS total_volume,
        SUM(CASE WHEN status = 'completed'   THEN fee    ELSE 0 END)     AS total_fees,
        COUNT(CASE WHEN type = 'topup'        AND status = 'completed' THEN 1 END) AS total_topups,
        COUNT(CASE WHEN type = 'transfer'     AND status = 'completed' THEN 1 END) AS total_transfers,
        COUNT(CASE WHEN type = 'bill_payment' AND status = 'completed' THEN 1 END) AS total_bills,
        COUNT(CASE WHEN type = 'withdrawal'   AND status = 'completed' THEN 1 END) AS total_withdrawals
       FROM transactions`
    );

    // 4. Platform wallet
    const platformWalletResult = await pool.query(
      `SELECT balance, total_earned FROM platform_wallet LIMIT 1`
    );

    // 5. Active merchants
    const merchantsResult = await pool.query(
      `SELECT
        COUNT(*)                                                          AS total_merchants,
        COUNT(CASE WHEN is_active = TRUE  THEN 1 END)                    AS active_merchants,
        COUNT(CASE WHEN is_active = FALSE THEN 1 END)                    AS inactive_merchants
       FROM merchants`
    );

    // 6. Wallet stats
    const walletsResult = await pool.query(
      `SELECT
        COUNT(*)                                                          AS total_wallets,
        SUM(balance)                                                      AS total_balance,
        AVG(balance)                                                      AS avg_balance,
        COUNT(CASE WHEN status = 'suspended' THEN 1 END)                 AS suspended_wallets
       FROM wallets`
    );

    // 7. Last 7 days revenue chart
    const revenueChartResult = await pool.query(
      `SELECT
        DATE(created_at)    AS date,
        SUM(amount)         AS revenue,
        COUNT(*)            AS transactions
       FROM platform_revenue
       WHERE created_at >= NOW() - INTERVAL '7 days'
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    );

    // 8. Last 7 days transaction volume chart
    const volumeChartResult = await pool.query(
      `SELECT
        DATE(created_at)    AS date,
        SUM(amount)         AS volume,
        COUNT(*)            AS transactions
       FROM transactions
       WHERE status     = 'completed'
       AND   created_at >= NOW() - INTERVAL '7 days'
       GROUP BY DATE(created_at)
       ORDER BY date ASC`
    );

    // 9. Recent transactions
    const recentTxResult = await pool.query(
      `SELECT
        t.id,
        t.reference_no,
        t.type,
        t.status,
        t.amount,
        t.fee,
        t.created_at,
        u.name    AS user_name,
        u.email   AS user_email
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       ORDER BY t.created_at DESC
       LIMIT 10`
    );

    // 10. Recent users
    const recentUsersResult = await pool.query(
      `SELECT
        id,
        name,
        email,
        phone,
        role,
        status,
        is_verified,
        created_at
       FROM users
       ORDER BY created_at DESC
       LIMIT 5`
    );

    const users         = usersResult.rows[0];
    const todayTx       = todayTxResult.rows[0];
    const overallTx     = overallTxResult.rows[0];
    const platformWallet = platformWalletResult.rows[0];
    const merchants     = merchantsResult.rows[0];
    const wallets       = walletsResult.rows[0];

    return res.status(200).json({
      generated_at: new Date(),

      users: {
        total:      parseInt(users.total_users),
        customers:  parseInt(users.total_customers),
        merchants:  parseInt(users.total_merchants),
        agents:     parseInt(users.total_agents),
        admins:     parseInt(users.total_admins),
        active:     parseInt(users.active_users),
        suspended:  parseInt(users.suspended_users),
        banned:     parseInt(users.banned_users),
        verified:   parseInt(users.verified_users),
        new_today:  parseInt(users.new_users_today),
      },

      transactions: {
        today: {
          total:      parseInt(todayTx.total_today),
          completed:  parseInt(todayTx.completed_today),
          failed:     parseInt(todayTx.failed_today),
          pending:    parseInt(todayTx.pending_today),
          volume:     parseFloat(todayTx.volume_today    || 0).toFixed(2),
          fees:       parseFloat(todayTx.fees_today      || 0).toFixed(2),
        },
        overall: {
          total:        parseInt(overallTx.total_transactions),
          completed:    parseInt(overallTx.total_completed),
          failed:       parseInt(overallTx.total_failed),
          reversed:     parseInt(overallTx.total_reversed),
          volume:       parseFloat(overallTx.total_volume  || 0).toFixed(2),
          fees:         parseFloat(overallTx.total_fees    || 0).toFixed(2),
          topups:       parseInt(overallTx.total_topups),
          transfers:    parseInt(overallTx.total_transfers),
          bills:        parseInt(overallTx.total_bills),
          withdrawals:  parseInt(overallTx.total_withdrawals),
        },
        currency: "EGP",
      },

      platform_wallet: {
        current_balance: parseFloat(platformWallet?.balance      || 0).toFixed(2),
        total_earned:    parseFloat(platformWallet?.total_earned  || 0).toFixed(2),
        currency:        "EGP",
      },

      merchants: {
        total:    parseInt(merchants.total_merchants),
        active:   parseInt(merchants.active_merchants),
        inactive: parseInt(merchants.inactive_merchants),
      },

      wallets: {
        total:      parseInt(wallets.total_wallets),
        total_balance: parseFloat(wallets.total_balance  || 0).toFixed(2),
        avg_balance:   parseFloat(wallets.avg_balance    || 0).toFixed(2),
        suspended:     parseInt(wallets.suspended_wallets),
        currency:      "EGP",
      },

      charts: {
        revenue_last_7_days: revenueChartResult.rows.map((r) => ({
          date:         r.date,
          revenue:      parseFloat(r.revenue).toFixed(2),
          transactions: parseInt(r.transactions),
        })),
        volume_last_7_days: volumeChartResult.rows.map((r) => ({
          date:         r.date,
          volume:       parseFloat(r.volume).toFixed(2),
          transactions: parseInt(r.transactions),
        })),
      },

      recent_transactions: recentTxResult.rows.map((tx) => ({
        id:           tx.id,
        reference_no: tx.reference_no,
        type:         tx.type,
        status:       tx.status,
        amount:       parseFloat(tx.amount).toFixed(2),
        fee:          parseFloat(tx.fee).toFixed(2),
        user: {
          name:  tx.user_name,
          email: tx.user_email,
        },
        created_at: tx.created_at,
      })),

      recent_users: recentUsersResult.rows,
    });

  } catch (err) {
    console.error("getDashboard error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
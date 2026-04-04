const { pool } = require("../../config/db");

exports.getMerchantMe = async (req, res) => {
  const userId = req.user.id;

  try {
    // 1. Get merchant profile with user info and wallet
    const result = await pool.query(
      `SELECT
        m.id              AS merchant_id,
        m.business_name,
        m.business_type,
        m.iban,
        m.webhook_url,
        m.api_key,
        m.is_active,
        m.created_at      AS merchant_since,
        u.id              AS user_id,
        u.name,
        u.email,
        u.phone,
        u.avatar_url,
        w.balance         AS wallet_balance,
        w.status          AS wallet_status
       FROM merchants m
       JOIN users   u ON u.id = m.user_id
       JOIN wallets w ON w.user_id = m.user_id
       WHERE m.user_id = $1
       LIMIT 1`,
      [userId]
    );

    // 2. Not a merchant
    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Merchant profile not found. Please register as a merchant first.",
      });
    }

    const merchant = result.rows[0];

    // 3. Get merchant transaction stats
    const statsResult = await pool.query(
      `SELECT
        COUNT(*)                                                          AS total_transactions,
        SUM(CASE WHEN t.status = 'completed' THEN t.amount ELSE 0 END)   AS total_volume,
        SUM(CASE WHEN t.status = 'completed' THEN t.fee    ELSE 0 END)   AS total_fees,
        COUNT(CASE WHEN t.status = 'completed' THEN 1 END)               AS successful_transactions,
        COUNT(CASE WHEN t.status = 'failed'    THEN 1 END)               AS failed_transactions,
        MAX(t.created_at)                                                 AS last_transaction_at
       FROM transactions t
       JOIN wallets w ON w.id = t.wallet_id
       WHERE w.user_id = $1`,
      [userId]
    );

    const stats = statsResult.rows[0];

    return res.status(200).json({
      merchant: {
        id:             merchant.merchant_id,
        business_name:  merchant.business_name,
        business_type:  merchant.business_type,
        is_active:      merchant.is_active,
        merchant_since: merchant.merchant_since,
      },
      owner: {
        id:         merchant.user_id,
        name:       merchant.name,
        email:      merchant.email,
        phone:      merchant.phone,
        avatar_url: merchant.avatar_url,
      },
      settlement: {
        iban:        merchant.iban,
        webhook_url: merchant.webhook_url,
      },
      api_key:  merchant.api_key,
      wallet: {
        balance:  parseFloat(merchant.wallet_balance).toFixed(2),
        status:   merchant.wallet_status,
        currency: "EGP",
      },
      stats: {
        total_transactions:     parseInt(stats.total_transactions     || 0),
        successful_transactions: parseInt(stats.successful_transactions || 0),
        failed_transactions:    parseInt(stats.failed_transactions    || 0),
        total_volume:           parseFloat(stats.total_volume         || 0).toFixed(2),
        total_fees:             parseFloat(stats.total_fees           || 0).toFixed(2),
        last_transaction_at:    stats.last_transaction_at || null,
        currency:               "EGP",
      },
    });

  } catch (err) {
    console.error("getMerchantMe error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
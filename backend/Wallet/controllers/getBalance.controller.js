const { pool } = require("../../config/db");

exports.getBalance = async (req, res) => {
  const userId = req.user.id;

  try {
    const result = await pool.query(
      `SELECT 
        w.id,
        w.balance,
        w.status,
        w.updated_at,
        u.name,
        u.email
       FROM wallets w
       JOIN users u ON u.id = w.user_id
       WHERE w.user_id = $1
       LIMIT 1`,
      [userId]
    );

    // 1. No wallet found
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    const wallet = result.rows[0];

    // 2. Check wallet is not suspended
    if (wallet.status === "suspended") {
      return res.status(403).json({
        message: "Your wallet has been suspended. Please contact support.",
      });
    }

    return res.status(200).json({
      wallet_id:    wallet.id,
      balance:      parseFloat(wallet.balance).toFixed(2),
      currency:     "EGP",
      status:       wallet.status,
      last_updated: wallet.updated_at,
      owner: {
        name:   wallet.name,
        email:  wallet.email,
      },
    });

  } catch (err) {
    console.error("getBalance error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
const { pool }  = require("../../config/db");
const crypto    = require("crypto");
const bcrypt    = require("bcryptjs");

exports.generateWithdrawalCode = async (req, res) => {
  const { amount, pin } = req.body;
  const userId = req.user.id;

  // 1. Validate input
  if (!amount || !pin) {
    return res.status(400).json({ message: "amount and pin are required" });
  }

  // 2. Validate amount
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ message: "Amount must be a positive number" });
  }

  if (parsedAmount < 50) {
    return res.status(400).json({ message: "Minimum withdrawal amount is 50 EGP" });
  }

  if (parsedAmount > 10000) {
    return res.status(400).json({ message: "Maximum withdrawal amount is 10,000 EGP" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 3. Verify PIN
    const userResult = await client.query(
      `SELECT id, name, pin FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    const user = userResult.rows[0];

    if (!user.pin) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "You need to set a PIN first" });
    }

    const isPinValid = await bcrypt.compare(pin, user.pin);
    if (!isPinValid) {
      await client.query("ROLLBACK");
      return res.status(401).json({ message: "Incorrect PIN" });
    }

    // 4. Lock wallet
    const walletResult = await client.query(
      `SELECT id, balance, status FROM wallets
       WHERE user_id = $1 LIMIT 1 FOR UPDATE`,
      [userId]
    );

    const wallet = walletResult.rows[0];

    if (!wallet) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Wallet not found" });
    }

    if (wallet.status === "suspended") {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Your wallet is suspended" });
    }

    // 5. Check balance
    if (parseFloat(wallet.balance) < parsedAmount) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message:   "Insufficient balance",
        available: parseFloat(wallet.balance).toFixed(2),
        required:  parsedAmount.toFixed(2),
      });
    }

    // 6. Cancel any existing pending codes for this user
    await client.query(
      `UPDATE withdrawal_codes
       SET status = 'cancelled'
       WHERE user_id = $1 AND status = 'pending'`,
      [userId]
    );

    // 7. Generate 6 digit code
    const code      = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // 8. Reserve the amount (deduct from wallet now)
    await client.query(
      `UPDATE wallets SET balance = balance - $1 WHERE id = $2`,
      [parsedAmount, wallet.id]
    );

    // 9. Save withdrawal code
    await client.query(
      `INSERT INTO withdrawal_codes (user_id, code, amount, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [userId, code, parsedAmount, expiresAt]
    );

    await client.query("COMMIT");

    return res.status(201).json({
      message:    "Withdrawal code generated successfully",
      code:       code,
      amount:     parsedAmount,
      currency:   "EGP",
      expires_at: expiresAt,
      expires_in: "10 minutes",
      note:       "Show this code to the agent to receive your cash",
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("generateWithdrawalCode error:", err);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};
const { pool } = require("../../config/db");

const FEE_RULES = {
  card:          0.02,
  bank_transfer: 0.00,
  agent:         0.01,
};

const generateReference = () => {
  const timestamp = Date.now().toString().slice(-8);
  const random    = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `TXN-${timestamp}-${random}`;
};

exports.topup = async (req, res) => {
  const { amount, payment_method, description } = req.body;
  const userId = req.user.id;

  // 1. Validate input
  if (!amount || !payment_method) {
    return res.status(400).json({ message: "Amount and payment method are required" });
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ message: "Amount must be a positive number" });
  }

  if (parsedAmount < 10) {
    return res.status(400).json({ message: "Minimum top-up amount is 10 EGP" });
  }

  if (parsedAmount > 50000) {
    return res.status(400).json({ message: "Maximum top-up amount is 50,000 EGP" });
  }

  const validMethods = ["card", "bank_transfer", "agent"];
  if (!validMethods.includes(payment_method)) {
    return res.status(400).json({
      message: `Invalid payment method. Must be one of: ${validMethods.join(", ")}`,
    });
  }

  try {
    // 2. Get user wallet
    const walletResult = await pool.query(
      `SELECT id, balance, status FROM wallets WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    if (walletResult.rowCount === 0) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    const wallet = walletResult.rows[0];

    if (wallet.status === "suspended") {
      return res.status(403).json({
        message: "Your wallet is suspended. Please contact support.",
      });
    }

    // 3. Calculate fee
    const feeRate   = FEE_RULES[payment_method];
    const fee       = parseFloat((parsedAmount * feeRate).toFixed(2));
    const netAmount = parseFloat((parsedAmount - fee).toFixed(2));

    const referenceNo = generateReference();

    // 4. Run everything in one DB transaction
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 5. Create transaction record
      const txResult = await client.query(
        `INSERT INTO transactions 
          (reference_no, wallet_id, user_id, type, status, amount, fee, payment_method, description, metadata)
         VALUES ($1, $2, $3, 'topup', 'pending', $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          referenceNo,
          wallet.id,
          userId,
          parsedAmount,
          fee,
          payment_method,
          description || `Wallet top-up via ${payment_method}`,
          JSON.stringify({ payment_method, original_amount: parsedAmount }),
        ]
      );

      const transaction = txResult.rows[0];

      // 6. Update to processing
      await client.query(
        `UPDATE transactions SET status = 'processing' WHERE id = $1`,
        [transaction.id]
      );

      // 7. Credit net amount to user wallet
      await client.query(
        `UPDATE wallets SET balance = balance + $1 WHERE id = $2`,
        [netAmount, wallet.id]
      );

      // 8. ✅ Credit fee to platform wallet
      if (fee > 0) {
        await client.query(
          `UPDATE platform_wallet 
           SET balance      = balance      + $1,
               total_earned = total_earned + $1,
               updated_at   = NOW()`,
          [fee]
        );

        // 9. ✅ Record in platform_revenue for audit trail
        await client.query(
          `INSERT INTO platform_revenue (transaction_id, amount, type)
           VALUES ($1, $2, $3)`,
          [transaction.id, fee, "topup_fee"]
        );
      }

      // 10. Mark transaction completed
      await client.query(
        `UPDATE transactions SET status = 'completed' WHERE id = $1`,
        [transaction.id]
      );

      await client.query("COMMIT");

      // 11. Get updated balance
      const updatedWallet = await pool.query(
        `SELECT balance FROM wallets WHERE id = $1`,
        [wallet.id]
      );

      return res.status(200).json({
        message:        "Wallet topped up successfully",
        reference_no:   referenceNo,
        amount:         parsedAmount,
        fee:            fee,
        net_credited:   netAmount,
        payment_method: payment_method,
        currency:       "EGP",
        new_balance:    parseFloat(updatedWallet.rows[0].balance).toFixed(2),
      });

    } catch (err) {
      await client.query("ROLLBACK");
      try {
        await pool.query(
          `UPDATE transactions SET status = 'failed' WHERE reference_no = $1`,
          [referenceNo]
        );
      } catch (updateErr) {
        console.error("Failed to mark transaction as failed:", updateErr.message);
      }
      throw err;
    } finally {
      client.release();
    }

  } catch (err) {
    console.error("topup error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
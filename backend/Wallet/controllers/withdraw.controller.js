const { pool } = require("../../config/db");

const FEE_RULES = {
  bank_transfer: 0.01,  // 1%
  agent:         0.01,  // 1%
};

const generateReference = () => {
  const timestamp = Date.now().toString().slice(-8);
  const random    = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
  return `WDR-${timestamp}-${random}`;
};

exports.withdraw = async (req, res) => {
  const { amount, method, bank_account_id, description } = req.body;
  const userId = req.user.id;

  // 1. Validate input
  if (!amount || !method) {
    return res.status(400).json({ message: "Amount and method are required" });
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
    return res.status(400).json({ message: "Maximum withdrawal amount is 10,000 EGP per transaction" });
  }

  // 3. Validate method
  const validMethods = ["bank_transfer", "agent"];
  if (!validMethods.includes(method)) {
    return res.status(400).json({
      message: `Invalid method. Must be one of: ${validMethods.join(", ")}`,
    });
  }

  // 4. Bank transfer requires a bank account
  if (method === "bank_transfer" && !bank_account_id) {
    return res.status(400).json({
      message: "bank_account_id is required for bank transfer withdrawals",
    });
  }

  try {
    // 5. Get user wallet
    const walletResult = await pool.query(
      `SELECT id, balance, status FROM wallets WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    if (walletResult.rowCount === 0) {
      return res.status(404).json({ message: "Wallet not found" });
    }

    const wallet = walletResult.rows[0];

    // 6. Check wallet is active
    if (wallet.status === "suspended") {
      return res.status(403).json({
        message: "Your wallet is suspended. Please contact support.",
      });
    }

    // 7. Calculate fee
    const feeRate      = FEE_RULES[method];
    const fee          = parseFloat((parsedAmount * feeRate).toFixed(2));
    const totalDeducted = parseFloat((parsedAmount + fee).toFixed(2));

    // 8. Check sufficient balance (amount + fee)
    if (parseFloat(wallet.balance) < totalDeducted) {
      return res.status(400).json({
        message:          "Insufficient balance",
        available:        parseFloat(wallet.balance).toFixed(2),
        required:         totalDeducted.toFixed(2),
        amount:           parsedAmount,
        fee:              fee,
        total_deducted:   totalDeducted,
      });
    }

    // 9. Validate bank account if bank transfer
    let bankAccount = null;
    if (method === "bank_transfer") {
      const bankResult = await pool.query(
        `SELECT id, bank_name, account_number, account_name 
         FROM bank_accounts 
         WHERE id = $1 AND user_id = $2 
         LIMIT 1`,
        [bank_account_id, userId]
      );

      if (bankResult.rowCount === 0) {
        return res.status(404).json({ message: "Bank account not found" });
      }

      bankAccount = bankResult.rows[0];
    }

    const referenceNo = generateReference();

    // 10. Run everything in one DB transaction
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 11. Create transaction record
      const txResult = await client.query(
        `INSERT INTO transactions
          (reference_no, wallet_id, user_id, type, status, amount, fee, payment_method, description, metadata)
         VALUES ($1, $2, $3, 'withdrawal', 'pending', $4, $5, $6, $7, $8)
         RETURNING *`,
        [
          referenceNo,
          wallet.id,
          userId,
          parsedAmount,
          fee,
          method,
          description || `Withdrawal via ${method}`,
          JSON.stringify({
            method,
            bank_account: bankAccount || null,
          }),
        ]
      );

      const transaction = txResult.rows[0];

      // 12. Update to processing
      await client.query(
        `UPDATE transactions SET status = 'processing' WHERE id = $1`,
        [transaction.id]
      );

      // 13. Deduct total (amount + fee) from wallet
      await client.query(
        `UPDATE wallets SET balance = balance - $1 WHERE id = $2`,
        [totalDeducted, wallet.id]
      );

      // 14. Credit fee to platform wallet
      if (fee > 0) {
        await client.query(
          `UPDATE platform_wallet
           SET balance      = balance      + $1,
               total_earned = total_earned + $1,
               updated_at   = NOW()`,
          [fee]
        );

        await client.query(
          `INSERT INTO platform_revenue (transaction_id, amount, type)
           VALUES ($1, $2, $3)`,
          [transaction.id, fee, "withdrawal_fee"]
        );
      }

      // 15. Mark transaction completed
      await client.query(
        `UPDATE transactions SET status = 'completed' WHERE id = $1`,
        [transaction.id]
      );

      await client.query("COMMIT");

      // 16. Get updated balance
      const updatedWallet = await pool.query(
        `SELECT balance FROM wallets WHERE id = $1`,
        [wallet.id]
      );

      return res.status(200).json({
        message:          "Withdrawal successful",
        reference_no:     referenceNo,
        amount:           parsedAmount,
        fee:              fee,
        total_deducted:   totalDeducted,
        method:           method,
        currency:         "EGP",
        new_balance:      parseFloat(updatedWallet.rows[0].balance).toFixed(2),
        ...(bankAccount && {
          bank_account: {
            bank_name:      bankAccount.bank_name,
            account_number: bankAccount.account_number,
            account_name:   bankAccount.account_name,
          },
        }),
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
    console.error("withdraw error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
const { pool }  = require("../../config/db");
const bcrypt    = require("bcryptjs");
const crypto    = require("crypto");

const PLATFORM_FEE_RATE = 0.005; // 0.5%

exports.payBill = async (req, res) => {
  const { biller_id, account_ref, amount, pin } = req.body;
  const userId = req.user.id;

  // 1. Validate input
  if (!biller_id || !account_ref || !amount || !pin) {
    return res.status(400).json({
      message: "biller_id, account_ref, amount and pin are required",
    });
  }

  if (isNaN(biller_id)) {
    return res.status(400).json({ message: "Invalid biller_id" });
  }

  // 2. Validate amount
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ message: "Amount must be a positive number" });
  }

  if (parsedAmount > 50000) {
    return res.status(400).json({ message: "Maximum bill payment is 50,000 EGP" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 3. Get user + verify PIN
    const userResult = await client.query(
      `SELECT id, name, email, phone, pin FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    const user = userResult.rows[0];

    if (!user.pin) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        message: "You need to set a PIN before making payments",
      });
    }

    const isPinValid = await bcrypt.compare(pin, user.pin);
    if (!isPinValid) {
      await client.query("ROLLBACK");
      return res.status(401).json({ message: "Incorrect PIN" });
    }

    // 4. Get biller
    const billerResult = await client.query(
      `SELECT id, name, category, logo_url, is_active
       FROM billers WHERE id = $1 LIMIT 1`,
      [biller_id]
    );

    if (billerResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Biller not found" });
    }

    const biller = billerResult.rows[0];

    if (!biller.is_active) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "This biller is currently unavailable" });
    }

    // 5. Calculate platform fee
    const fee           = parseFloat((parsedAmount * PLATFORM_FEE_RATE).toFixed(2));
    const totalDeducted = parseFloat((parsedAmount + fee).toFixed(2));

    // 6. Lock user wallet
    const walletResult = await client.query(
      `SELECT id, balance, status FROM wallets
       WHERE user_id = $1 LIMIT 1 FOR UPDATE`,
      [userId]
    );

    if (walletResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Wallet not found" });
    }

    const wallet = walletResult.rows[0];

    // 7. Check wallet status
    if (wallet.status === "suspended") {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Your wallet is suspended" });
    }

    // 8. Check sufficient balance
    if (parseFloat(wallet.balance) < totalDeducted) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message:        "Insufficient balance",
        available:      parseFloat(wallet.balance).toFixed(2),
        required:       totalDeducted.toFixed(2),
        amount:         parsedAmount,
        fee:            fee,
        total_deducted: totalDeducted,
      });
    }

    // 9. Generate reference
    const referenceNo = crypto.randomUUID();

    // 10. Create transaction record
    const txResult = await client.query(
      `INSERT INTO transactions
        (reference_no, wallet_id, user_id, type, status, amount, fee, description, metadata)
       VALUES ($1, $2, $3, 'bill_payment', 'pending', $4, $5, $6, $7)
       RETURNING id`,
      [
        referenceNo,
        wallet.id,
        userId,
        parsedAmount,
        fee,
        `Bill payment — ${biller.name} (${account_ref})`,
        JSON.stringify({
          biller_id:    biller.id,
          biller_name:  biller.name,
          category:     biller.category,
          account_ref:  account_ref,
        }),
      ]
    );

    const transaction = txResult.rows[0];

    // 11. Deduct from wallet
    await client.query(
      `UPDATE wallets SET balance = balance - $1 WHERE id = $2`,
      [totalDeducted, wallet.id]
    );

    // 12. Credit platform fee
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
         VALUES ($1, $2, 'bill_fee')`,
        [transaction.id, fee]
      );
    }

    // 13. Mark transaction completed
    await client.query(
      `UPDATE transactions SET status = 'completed' WHERE id = $1`,
      [transaction.id]
    );

    // 14. Update bill status to paid if exists
    await client.query(
      `UPDATE bills
       SET status = 'paid', paid_at = NOW()
       WHERE user_id = $1
       AND biller_id = $2
       AND account_ref = $3
       AND status != 'paid'`,
      [userId, biller_id, account_ref.toString().trim()]
    );

    // 15. Simulate biller confirmation API call
    // In production: await axios.post(biller.confirm_endpoint, { reference_no, account_ref, amount })
    const billerConfirmation = {
      confirmed:    true,
      biller_ref:   `BREF-${Date.now()}`,
      confirmed_at: new Date(),
    };

    await client.query("COMMIT");

    // 16. Get updated balance
    const updatedWallet = await pool.query(
      `SELECT balance FROM wallets WHERE id = $1`,
      [wallet.id]
    );

    return res.status(200).json({
      message:        "Bill paid successfully",
      receipt: {
        reference_no:   referenceNo,
        biller_ref:     billerConfirmation.biller_ref,
        biller: {
          id:           biller.id,
          name:         biller.name,
          category:     biller.category,
        },
        account_ref:    account_ref,
        amount:         parsedAmount,
        fee:            fee,
        total_deducted: totalDeducted,
        currency:       "EGP",
        paid_at:        billerConfirmation.confirmed_at,
        new_balance:    parseFloat(updatedWallet.rows[0].balance).toFixed(2),
        paid_by: {
          name:         user.name,
          phone:        user.phone,
        },
      },
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("payBill error:", err);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};
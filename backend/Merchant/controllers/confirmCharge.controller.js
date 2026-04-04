const { pool }  = require("../../config/db");
const bcrypt    = require("bcryptjs");
const crypto    = require("crypto");

const PLATFORM_FEE_RATE = 0.015; // 1.5% on merchant charges

exports.confirmCharge = async (req, res) => {
  const { payment_token, pin } = req.body;
  const customerId = req.user.id;

  // 1. Validate input
  if (!payment_token || !pin) {
    return res.status(400).json({ message: "payment_token and pin are required" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 2. Get charge and lock it
    const chargeResult = await client.query(
      `SELECT * FROM merchant_charges
       WHERE payment_token = $1
       LIMIT 1 FOR UPDATE`,
      [payment_token]
    );

    if (chargeResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Payment not found" });
    }

    const charge = chargeResult.rows[0];

    // 3. Check charge status
    if (charge.status === "completed") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "This payment has already been completed" });
    }

    if (charge.status === "expired" || new Date() > new Date(charge.expires_at)) {
      await client.query(
        `UPDATE merchant_charges SET status = 'expired' WHERE id = $1`,
        [charge.id]
      );
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "This payment has expired" });
    }

    if (charge.status === "failed") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "This payment has failed" });
    }

    // 4. If charge was for specific customer, enforce it
    if (charge.customer_phone) {
      const customerResult = await client.query(
        `SELECT phone FROM users WHERE id = $1 LIMIT 1`,
        [customerId]
      );

      if (customerResult.rows[0]?.phone !== charge.customer_phone) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "This payment is not for you" });
      }
    }

    // 5. Get customer + verify PIN
    const customerResult = await client.query(
      `SELECT id, name, phone, pin FROM users WHERE id = $1 LIMIT 1`,
      [customerId]
    );

    const customer = customerResult.rows[0];

    if (!customer.pin) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "You need to set a PIN before making payments" });
    }

    const isPinValid = await bcrypt.compare(pin, customer.pin);
    if (!isPinValid) {
      await client.query("ROLLBACK");
      return res.status(401).json({ message: "Incorrect PIN" });
    }

    // 6. Calculate fees
    const amount        = parseFloat(charge.amount);
    const fee           = parseFloat((amount * PLATFORM_FEE_RATE).toFixed(2));
    const totalDeducted = parseFloat((amount + fee).toFixed(2));

    // 7. Lock customer wallet
    const customerWalletRes = await client.query(
      `SELECT id, balance, status FROM wallets
       WHERE user_id = $1 LIMIT 1 FOR UPDATE`,
      [customerId]
    );

    // 8. Lock merchant wallet
    const merchantWalletRes = await client.query(
      `SELECT id, balance, status FROM wallets
       WHERE user_id = (SELECT user_id FROM merchants WHERE id = $1)
       LIMIT 1 FOR UPDATE`,
      [charge.merchant_id]
    );

    const customerWallet = customerWalletRes.rows[0];
    const merchantWallet = merchantWalletRes.rows[0];

    if (!customerWallet || !merchantWallet) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Wallet not found" });
    }

    if (customerWallet.status === "suspended") {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Your wallet is suspended" });
    }

    // 9. Check balance
    if (parseFloat(customerWallet.balance) < totalDeducted) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message:        "Insufficient balance",
        available:      parseFloat(customerWallet.balance).toFixed(2),
        required:       totalDeducted.toFixed(2),
        amount:         amount,
        fee:            fee,
        total_deducted: totalDeducted,
      });
    }

    // 10. Generate references
    const customerRefNo = crypto.randomUUID();
    const merchantRefNo = crypto.randomUUID();

    // 11. Insert customer transaction (debit)
    const customerTxResult = await client.query(
      `INSERT INTO transactions
        (reference_no, wallet_id, user_id, type, status, amount, fee, description, metadata)
       VALUES ($1, $2, $3, 'transfer', 'pending', $4, $5, $6, $7)
       RETURNING id`,
      [
        customerRefNo,
        customerWallet.id,
        customerId,
        amount,
        fee,
        charge.description,
        JSON.stringify({
          direction:   "debit",
          charge_id:   charge.id,
          order_id:    charge.order_id,
          merchant_id: charge.merchant_id,
        }),
      ]
    );

    // 12. Insert merchant transaction (credit)
    await client.query(
      `INSERT INTO transactions
        (reference_no, wallet_id, user_id, type, status, amount, fee, description, metadata)
       VALUES ($1, $2, $3, 'transfer', 'pending', $4, $5, $6, $7)`,
      [
        merchantRefNo,
        merchantWallet.id,
        (await client.query(`SELECT user_id FROM merchants WHERE id = $1`, [charge.merchant_id])).rows[0].user_id,
        amount,
        0,
        charge.description,
        JSON.stringify({
          direction:   "credit",
          charge_id:   charge.id,
          order_id:    charge.order_id,
          customer_id: customerId,
        }),
      ]
    );

    // 13. Deduct from customer
    await client.query(
      `UPDATE wallets SET balance = balance - $1 WHERE id = $2`,
      [totalDeducted, customerWallet.id]
    );

    // 14. Credit merchant
    await client.query(
      `UPDATE wallets SET balance = balance + $1 WHERE id = $2`,
      [amount, merchantWallet.id]
    );

    // 15. Platform fee
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
         VALUES ($1, $2, 'merchant_fee')`,
        [customerTxResult.rows[0].id, fee]
      );
    }

    // 16. Mark transactions completed
    await client.query(
      `UPDATE transactions SET status = 'completed'
       WHERE reference_no = $1 OR reference_no = $2`,
      [customerRefNo, merchantRefNo]
    );

    // 17. Mark charge as completed
    await client.query(
      `UPDATE merchant_charges
       SET status = 'completed', customer_id = $1, paid_at = NOW()
       WHERE id = $2`,
      [customerId, charge.id]
    );

    await client.query("COMMIT");

    // 18. Get updated customer balance
    const balanceRes = await pool.query(
      `SELECT balance FROM wallets WHERE id = $1`,
      [customerWallet.id]
    );

    // 19. Trigger webhook (fire and forget)
    if (charge.callback_url) {
      fetch(charge.callback_url, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event:       "payment.completed",
          order_id:    charge.order_id,
          amount:      amount,
          currency:    charge.currency,
          reference:   customerRefNo,
          paid_at:     new Date(),
        }),
      }).catch((err) => console.error("Webhook delivery failed:", err.message));
    }

    return res.status(200).json({
      message:        "Payment completed successfully",
      reference_no:   customerRefNo,
      order_id:       charge.order_id,
      amount:         amount,
      fee:            fee,
      total_deducted: totalDeducted,
      currency:       charge.currency,
      new_balance:    parseFloat(balanceRes.rows[0].balance).toFixed(2),
      paid_at:        new Date(),
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("confirmCharge error:", err);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};
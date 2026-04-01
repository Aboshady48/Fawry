const { pool }  = require("../../config/db");
const bcrypt    = require("bcryptjs");
const crypto    = require("crypto");

const FEE_RATE = 0.005; // 0.5%

exports.payRequest = async (req, res) => {
  const { requestId } = req.params;
  const { pin }       = req.body;
  const payerId       = req.user.id;

  if (!pin) {
    return res.status(400).json({ message: "PIN is required" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Get payment request and lock it
    const requestResult = await client.query(
      `SELECT * FROM payment_requests 
       WHERE reference_no = $1 
       LIMIT 1 
       FOR UPDATE`,
      [requestId]
    );

    if (requestResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Payment request not found" });
    }

    const paymentRequest = requestResult.rows[0];

    // 2. Check status
    if (paymentRequest.status === "paid") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "This payment request has already been paid" });
    }

    if (paymentRequest.status === "cancelled") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "This payment request has been cancelled" });
    }

    if (paymentRequest.status === "expired" || new Date() > new Date(paymentRequest.expires_at)) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "This payment request has expired" });
    }

    // 3. Prevent requester from paying their own request
    if (paymentRequest.requester_id === payerId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "You cannot pay your own payment request" });
    }

    // 4. If request was for specific payer, enforce it
    if (paymentRequest.payer_phone) {
      const payerResult = await client.query(
        `SELECT phone FROM users WHERE id = $1 LIMIT 1`,
        [payerId]
      );
      if (payerResult.rows[0]?.phone !== paymentRequest.payer_phone) {
        await client.query("ROLLBACK");
        return res.status(403).json({ message: "This payment request is not for you" });
      }
    }

    // 5. Get payer info + verify PIN
    const payerResult = await client.query(
      `SELECT id, name, phone, pin FROM users WHERE id = $1 LIMIT 1`,
      [payerId]
    );
    const payer = payerResult.rows[0];

    if (!payer.pin) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "You need to set a PIN before making payments" });
    }

    const isPinValid = await bcrypt.compare(pin, payer.pin);
    if (!isPinValid) {
      await client.query("ROLLBACK");
      return res.status(401).json({ message: "Incorrect PIN" });
    }

    // 6. Calculate fee
    const amount        = parseFloat(paymentRequest.amount);
    const fee           = parseFloat((amount * FEE_RATE).toFixed(2));
    const totalDeducted = parseFloat((amount + fee).toFixed(2));

    // 7. Lock payer wallet
    const payerWalletRes = await client.query(
      `SELECT id, balance, status FROM wallets 
       WHERE user_id = $1 LIMIT 1 FOR UPDATE`,
      [payerId]
    );

    // 8. Lock requester wallet
    const requesterWalletRes = await client.query(
      `SELECT id, balance, status FROM wallets 
       WHERE user_id = $1 LIMIT 1 FOR UPDATE`,
      [paymentRequest.requester_id]
    );

    const payerWallet     = payerWalletRes.rows[0];
    const requesterWallet = requesterWalletRes.rows[0];

    if (!payerWallet || !requesterWallet) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Wallet not found" });
    }

    if (payerWallet.status === "suspended") {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Your wallet is suspended" });
    }

    // 9. Check balance
    if (parseFloat(payerWallet.balance) < totalDeducted) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message:        "Insufficient balance",
        available:      parseFloat(payerWallet.balance).toFixed(2),
        required:       totalDeducted.toFixed(2),
        amount:         amount,
        fee:            fee,
        total_deducted: totalDeducted,
      });
    }

    // 10. Generate references
    const payerReferenceNo     = crypto.randomUUID();
    const requesterReferenceNo = crypto.randomUUID();

    // 11. Insert payer transaction (debit)
    const payerTxResult = await client.query(
      `INSERT INTO transactions
        (reference_no, wallet_id, user_id, type, status, amount, fee, description, metadata)
       VALUES ($1, $2, $3, 'transfer', 'pending', $4, $5, $6, $7)
       RETURNING id`,
      [
        payerReferenceNo,
        payerWallet.id,
        payerId,
        amount,
        fee,
        paymentRequest.note || `Payment request from ${payer.name}`,
        JSON.stringify({
          direction:       "debit",
          payment_request: requestId,
        }),
      ]
    );

    // 12. Insert requester transaction (credit)
    await client.query(
      `INSERT INTO transactions
        (reference_no, wallet_id, user_id, type, status, amount, fee, description, metadata)
       VALUES ($1, $2, $3, 'transfer', 'pending', $4, $5, $6, $7)`,
      [
        requesterReferenceNo,
        requesterWallet.id,
        paymentRequest.requester_id,
        amount,
        0,
        paymentRequest.note || `Payment received from ${payer.name}`,
        JSON.stringify({
          direction:       "credit",
          payment_request: requestId,
        }),
      ]
    );

    // 13. Deduct from payer
    await client.query(
      `UPDATE wallets SET balance = balance - $1 WHERE id = $2`,
      [totalDeducted, payerWallet.id]
    );

    // 14. Credit requester
    await client.query(
      `UPDATE wallets SET balance = balance + $1 WHERE id = $2`,
      [amount, requesterWallet.id]
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
         VALUES ($1, $2, 'transfer_fee')`,
        [payerTxResult.rows[0].id, fee]
      );
    }

    // 16. Mark transactions completed
    await client.query(
      `UPDATE transactions SET status = 'completed'
       WHERE reference_no = $1 OR reference_no = $2`,
      [payerReferenceNo, requesterReferenceNo]
    );

    // 17. Mark payment request as paid
    await client.query(
      `UPDATE payment_requests 
       SET status = 'paid', paid_at = NOW() 
       WHERE reference_no = $1`,
      [requestId]
    );

    await client.query("COMMIT");

    // 18. Get updated payer balance
    const balanceRes = await pool.query(
      `SELECT balance FROM wallets WHERE id = $1`,
      [payerWallet.id]
    );

    return res.status(200).json({
      message:        "Payment request paid successfully",
      reference_no:   payerReferenceNo,
      amount:         amount,
      fee:            fee,
      total_deducted: totalDeducted,
      currency:       "EGP",
      new_balance:    parseFloat(balanceRes.rows[0].balance).toFixed(2),
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("payRequest error:", err);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};
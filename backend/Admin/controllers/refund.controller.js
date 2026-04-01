const { pool }  = require("../../config/db");
const crypto    = require("crypto");

exports.refund = async (req, res) => {
  const { transaction_id, reason } = req.body;
  const adminId = req.user.id;

  // 1. Validate input
  if (!transaction_id) {
    return res.status(400).json({ message: "transaction_id is required" });
  }

  if (!reason) {
    return res.status(400).json({ message: "Reason is required for refund" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 2. Get the original transaction
    const txResult = await client.query(
      `SELECT 
        t.id,
        t.reference_no,
        t.wallet_id,
        t.user_id,
        t.type,
        t.status,
        t.amount,
        t.fee,
        t.metadata
       FROM transactions t
       WHERE t.id = $1
       LIMIT 1
       FOR UPDATE`,
      [transaction_id]
    );

    if (txResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Transaction not found" });
    }

    const originalTx = txResult.rows[0];

    // 3. Only completed transactions can be refunded
    if (originalTx.status !== "completed") {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: `Cannot refund a transaction with status: ${originalTx.status}`,
      });
    }

    // 4. Only topup and transfer types can be refunded
    const refundableTypes = ["topup", "transfer"];
    if (!refundableTypes.includes(originalTx.type)) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: `Cannot refund a ${originalTx.type} transaction`,
      });
    }

    // 5. Check not already refunded
    const alreadyRefunded = await client.query(
      `SELECT id FROM transactions 
       WHERE metadata->>'original_transaction_id' = $1
       AND type = 'refund'
       LIMIT 1`,
      [transaction_id.toString()]
    );

    if (alreadyRefunded.rowCount > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "This transaction has already been refunded" });
    }

    const refundAmount = parseFloat(originalTx.amount);
    const metadata     = originalTx.metadata || {};

    // 6. Handle refund based on transaction type
    if (originalTx.type === "topup") {

      // 6a. Get the user's wallet
      const walletResult = await client.query(
        `SELECT id, balance FROM wallets WHERE id = $1 LIMIT 1 FOR UPDATE`,
        [originalTx.wallet_id]
      );

      const wallet = walletResult.rows[0];

      if (!wallet) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Wallet not found" });
      }

      // Check wallet has enough balance to reverse
      if (parseFloat(wallet.balance) < refundAmount) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message:   "User does not have enough balance to refund this transaction",
          available: parseFloat(wallet.balance).toFixed(2),
          required:  refundAmount.toFixed(2),
        });
      }

      // Deduct from user wallet
      await client.query(
        `UPDATE wallets SET balance = balance - $1 WHERE id = $2`,
        [refundAmount, wallet.id]
      );

      // Deduct from platform wallet (reverse the fee)
      const fee = parseFloat(originalTx.fee);
      if (fee > 0) {
        await client.query(
          `UPDATE platform_wallet
           SET balance      = balance      - $1,
               total_earned = total_earned - $1,
               updated_at   = NOW()`,
          [fee]
        );
      }

    } else if (originalTx.type === "transfer") {

      // 6b. Get sender (debit) and receiver (credit) from metadata
      const receiverId   = metadata.receiver_id;
      const senderId     = metadata.sender_id || originalTx.user_id;
      const direction    = metadata.direction;

      // Only refund the debit side
      if (direction !== "debit") {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message: "Please use the sender's transaction ID to refund a transfer",
        });
      }

      // Lock sender wallet
      const senderWalletRes = await client.query(
        `SELECT id, balance FROM wallets WHERE user_id = $1 LIMIT 1 FOR UPDATE`,
        [senderId]
      );

      // Lock receiver wallet
      const receiverWalletRes = await client.query(
        `SELECT id, balance FROM wallets WHERE user_id = $1 LIMIT 1 FOR UPDATE`,
        [receiverId]
      );

      const senderWallet   = senderWalletRes.rows[0];
      const receiverWallet = receiverWalletRes.rows[0];

      if (!senderWallet || !receiverWallet) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "Wallet not found" });
      }

      // Check receiver has enough to reverse
      if (parseFloat(receiverWallet.balance) < refundAmount) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          message:   "Receiver does not have enough balance to reverse this transfer",
          available: parseFloat(receiverWallet.balance).toFixed(2),
          required:  refundAmount.toFixed(2),
        });
      }

      // Deduct from receiver
      await client.query(
        `UPDATE wallets SET balance = balance - $1 WHERE id = $2`,
        [refundAmount, receiverWallet.id]
      );

      // Credit back to sender (amount + fee)
      const fee         = parseFloat(originalTx.fee);
      const totalReturn = parseFloat((refundAmount + fee).toFixed(2));

      await client.query(
        `UPDATE wallets SET balance = balance + $1 WHERE id = $2`,
        [totalReturn, senderWallet.id]
      );

      // Deduct fee from platform wallet
      if (fee > 0) {
        await client.query(
          `UPDATE platform_wallet
           SET balance      = balance      - $1,
               total_earned = total_earned - $1,
               updated_at   = NOW()`,
          [fee]
        );
      }
    }

    // 7. Create refund transaction record
    const refundReferenceNo = crypto.randomUUID();

    await client.query(
      `INSERT INTO transactions
        (reference_no, wallet_id, user_id, type, status, amount, fee, description, metadata)
       VALUES ($1, $2, $3, 'refund', 'completed', $4, $5, $6, $7)`,
      [
        refundReferenceNo,
        originalTx.wallet_id,
        originalTx.user_id,
        refundAmount,
        0,
        `Refund for transaction #${transaction_id} — ${reason}`,
        JSON.stringify({
          original_transaction_id: transaction_id.toString(),
          original_reference_no:   originalTx.reference_no,
          original_type:           originalTx.type,
          reason:                  reason,
          refunded_by_admin:       adminId,
        }),
      ]
    );

    // 8. Mark original transaction as reversed
    await client.query(
      `UPDATE transactions SET status = 'reversed' WHERE id = $1`,
      [transaction_id]
    );

    // 9. Log admin action
    const adminRecord = await client.query(
      `SELECT id FROM admins WHERE user_id = $1 LIMIT 1`,
      [adminId]
    );

    if (adminRecord.rowCount > 0) {
      await client.query(
        `INSERT INTO admin_logs
          (admin_id, action, target_table, target_id, description, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          adminRecord.rows[0].id,
          "TRANSACTION_REFUND",
          "transactions",
          transaction_id,
          reason,
          req.ip,
        ]
      );
    }

    await client.query("COMMIT");

    return res.status(200).json({
      message:          "Transaction refunded successfully",
      refund_reference: refundReferenceNo,
      original: {
        transaction_id: transaction_id,
        reference_no:   originalTx.reference_no,
        type:           originalTx.type,
        amount:         refundAmount,
        status:         "reversed",
      },
      reason: reason,
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("refund error:", err);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};
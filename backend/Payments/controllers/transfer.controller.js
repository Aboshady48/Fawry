const { pool } = require("../../config/db");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const FEE_RATE = 0.005; // 0.5%

const rollback = async (client, res, status, message) => {
  await client.query("ROLLBACK").catch(() => {});
  return res.status(status).json({ message });
};

exports.transfer = async (req, res) => {
  const { receiver_phone, amount, pin, note } = req.body;
  const senderId = req.user.id;

  // 1. Validate input
  if (!receiver_phone || !amount || !pin) {
    return res.status(400).json({
      message: "receiver_phone, amount and pin are required",
    });
  }

  // 2. Validate amount
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount < 1 || parsedAmount > 10000) {
    return res.status(400).json({
      message: "Amount must be between 1 and 10,000 EGP",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 3. Get sender
    const senderResult = await client.query(
      `SELECT id, name, phone, pin FROM users WHERE id = $1 LIMIT 1`,
      [senderId]
    );
    const sender = senderResult.rows[0];

    if (!sender)     return rollback(client, res, 404, "Sender not found");
    if (!sender.pin) return rollback(client, res, 403, "You need to set a PIN before making transfers");

    // 4. Verify PIN
    const isPinValid = await bcrypt.compare(pin, sender.pin);
    if (!isPinValid) return rollback(client, res, 401, "Incorrect PIN");

    // 5. Prevent self transfer
    const cleanPhone = receiver_phone.replace(/\s/g, "");
    if (sender.phone === cleanPhone) {
      return rollback(client, res, 400, "You cannot transfer to yourself");
    }

    // 6. Get receiver
    const receiverResult = await client.query(
      `SELECT id, name, phone, status FROM users WHERE phone = $1 LIMIT 1`,
      [cleanPhone]
    );
    const receiver = receiverResult.rows[0];

    if (!receiver)                    return rollback(client, res, 404, "Receiver not found");
    if (receiver.status !== "active") return rollback(client, res, 400, "Receiver account is not active");

    // 7. Calculate fee
    const fee           = parseFloat((parsedAmount * FEE_RATE).toFixed(2));
    const totalDeducted = parseFloat((parsedAmount + fee).toFixed(2));

    // 8. Lock both wallets FOR UPDATE (prevents race conditions)
    const senderWalletRes = await client.query(
      `SELECT id, balance, status FROM wallets 
       WHERE user_id = $1 LIMIT 1 FOR UPDATE`,
      [senderId]
    );

    const receiverWalletRes = await client.query(
      `SELECT id, balance, status FROM wallets 
       WHERE user_id = $1 LIMIT 1 FOR UPDATE`,
      [receiver.id]
    );

    const senderWallet   = senderWalletRes.rows[0];
    const receiverWallet = receiverWalletRes.rows[0];

    if (!senderWallet)   return rollback(client, res, 404, "Sender wallet not found");
    if (!receiverWallet) return rollback(client, res, 404, "Receiver wallet not found");

    if (senderWallet.status === "suspended") {
      return rollback(client, res, 403, "Your wallet is suspended");
    }
    if (receiverWallet.status === "suspended") {
      return rollback(client, res, 400, "Receiver wallet is suspended");
    }

    // 9. Check balance
    if (parseFloat(senderWallet.balance) < totalDeducted) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message:        "Insufficient balance",
        available:      parseFloat(senderWallet.balance).toFixed(2),
        required:       totalDeducted.toFixed(2),
        amount:         parsedAmount,
        fee:            fee,
        total_deducted: totalDeducted,
      });
    }

    // 10. Generate TWO unique references — one for each transaction
    const senderReferenceNo   = crypto.randomUUID();
    const receiverReferenceNo = crypto.randomUUID();

    // 11. Insert sender transaction (debit)
    const senderTxResult = await client.query(
      `INSERT INTO transactions
        (reference_no, wallet_id, user_id, type, status, amount, fee, description, metadata)
       VALUES ($1, $2, $3, 'transfer', 'pending', $4, $5, $6, $7)
       RETURNING id`,
      [
        senderReferenceNo,
        senderWallet.id,
        senderId,
        parsedAmount,
        fee,
        note || `Transfer to ${receiver.name}`,
        JSON.stringify({
          direction:      "debit",
          receiver_id:    receiver.id,
          receiver_name:  receiver.name,
          receiver_phone: receiver.phone,
        }),
      ]
    );

    // 12. Insert receiver transaction (credit)
    await client.query(
      `INSERT INTO transactions
        (reference_no, wallet_id, user_id, type, status, amount, fee, description, metadata)
       VALUES ($1, $2, $3, 'transfer', 'pending', $4, $5, $6, $7)`,
      [
        receiverReferenceNo,
        receiverWallet.id,
        receiver.id,
        parsedAmount,
        0,
        note || `Transfer from ${sender.name}`,
        JSON.stringify({
          direction:    "credit",
          sender_id:    senderId,
          sender_name:  sender.name,
          sender_phone: sender.phone,
        }),
      ]
    );

    // 13. Deduct from sender (amount + fee)
    await client.query(
      `UPDATE wallets SET balance = balance - $1 WHERE id = $2`,
      [totalDeducted, senderWallet.id]
    );

    // 14. Credit receiver (amount only)
    await client.query(
      `UPDATE wallets SET balance = balance + $1 WHERE id = $2`,
      [parsedAmount, receiverWallet.id]
    );

    // 15. Credit fee to platform wallet
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
        [senderTxResult.rows[0].id, fee]
      );
    }

    // 16. Mark both transactions completed using their own references
    await client.query(
      `UPDATE transactions SET status = 'completed' 
       WHERE reference_no = $1 OR reference_no = $2`,
      [senderReferenceNo, receiverReferenceNo]
    );

    await client.query("COMMIT");

    // 17. Get updated sender balance
    const balanceRes = await pool.query(
      `SELECT balance FROM wallets WHERE id = $1`,
      [senderWallet.id]
    );

    return res.status(200).json({
      message:        "Transfer successful",
      reference_no:   senderReferenceNo,
      amount:         parsedAmount,
      fee:            fee,
      total_deducted: totalDeducted,
      currency:       "EGP",
      new_balance:    parseFloat(balanceRes.rows[0].balance).toFixed(2),
      receiver: {
        name:  receiver.name,
        phone: receiver.phone,
      },
      note: note || null,
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("transfer error:", err);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};
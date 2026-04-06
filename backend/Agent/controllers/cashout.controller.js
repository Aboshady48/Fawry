const { pool }  = require("../../config/db");
const crypto    = require("crypto");

const PLATFORM_FEE_RATE = 0.005; // 0.5%

exports.cashout = async (req, res) => {
  const { withdrawal_code, note } = req.body;
  const agentUserId = req.user.id;

  // 1. Validate input
  if (!withdrawal_code) {
    return res.status(400).json({ message: "withdrawal_code is required" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 2. Get agent and lock
    const agentResult = await client.query(
      `SELECT a.id, a.business_name, a.float_balance, a.is_active
       FROM agents a
       WHERE a.user_id = $1 LIMIT 1 FOR UPDATE`,
      [agentUserId]
    );

    if (agentResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Agent profile not found" });
    }

    const agent = agentResult.rows[0];

    if (!agent.is_active) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Your agent account is suspended" });
    }

    // 3. Find and lock withdrawal code
    const codeResult = await client.query(
      `SELECT wc.id, wc.user_id, wc.amount, wc.status, wc.expires_at
       FROM withdrawal_codes wc
       WHERE wc.code = $1
       LIMIT 1 FOR UPDATE`,
      [withdrawal_code]
    );

    if (codeResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Invalid withdrawal code" });
    }

    const withdrawalCode = codeResult.rows[0];

    // 4. Check code status
    if (withdrawalCode.status === "used") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "This withdrawal code has already been used" });
    }

    if (withdrawalCode.status === "cancelled") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "This withdrawal code has been cancelled" });
    }

    if (withdrawalCode.status === "expired" || new Date() > new Date(withdrawalCode.expires_at)) {
      await client.query(
        `UPDATE withdrawal_codes SET status = 'expired' WHERE id = $1`,
        [withdrawalCode.id]
      );
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "This withdrawal code has expired" });
    }

    // 5. Get customer info
    const customerResult = await client.query(
      `SELECT id, name, phone FROM users WHERE id = $1 LIMIT 1`,
      [withdrawalCode.user_id]
    );

    const customer = customerResult.rows[0];

    const amount = parseFloat(withdrawalCode.amount);

    // 6. Calculate fee
    const fee       = parseFloat((amount * PLATFORM_FEE_RATE).toFixed(2));
    const netAmount = parseFloat((amount - fee).toFixed(2));

    // 7. Generate references
    const agentRefNo    = crypto.randomUUID();
    const customerRefNo = crypto.randomUUID();

    // 8. Get customer wallet
    const customerWalletRes = await client.query(
      `SELECT id FROM wallets WHERE user_id = $1 LIMIT 1`,
      [customer.id]
    );

    const customerWallet = customerWalletRes.rows[0];

    // 9. Credit agent float (net amount)
    await client.query(
      `UPDATE agents SET float_balance = float_balance + $1 WHERE id = $2`,
      [netAmount, agent.id]
    );

    // 10. Insert agent transaction record
    const agentTxResult = await client.query(
      `INSERT INTO agent_transactions
        (agent_id, user_id, type, status, amount, fee, reference_no, note)
       VALUES ($1, $2, 'cashout', 'completed', $3, $4, $5, $6)
       RETURNING id`,
      [
        agent.id,
        customer.id,
        amount,
        fee,
        agentRefNo,
        note || `Cash-out for ${customer.name}`,
      ]
    );

    // 11. Insert customer wallet transaction
    await client.query(
      `INSERT INTO transactions
        (reference_no, wallet_id, user_id, type, status, amount, fee, description, metadata)
       VALUES ($1, $2, $3, 'withdrawal', 'completed', $4, $5, $6, $7)`,
      [
        customerRefNo,
        customerWallet.id,
        customer.id,
        amount,
        fee,
        note || `Cash-out via agent — ${agent.business_name}`,
        JSON.stringify({
          agent_id:         agent.id,
          agent_name:       agent.business_name,
          agent_ref:        agentRefNo,
          withdrawal_code:  withdrawal_code,
          payment_method:   "agent",
        }),
      ]
    );

    // 12. Platform fee
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
         VALUES ($1, $2, 'cashout_fee')`,
        [agentTxResult.rows[0].id, fee]
      );
    }

    // 13. Mark withdrawal code as used
    await client.query(
      `UPDATE withdrawal_codes
       SET status       = 'used',
           used_at      = NOW(),
           used_by_agent = $1
       WHERE id = $2`,
      [agent.id, withdrawalCode.id]
    );

    await client.query("COMMIT");

    // 14. Get updated float balance
    const updatedAgent = await pool.query(
      `SELECT float_balance FROM agents WHERE id = $1`,
      [agent.id]
    );

    return res.status(200).json({
      message:              "Cash-out successful",
      reference_no:         agentRefNo,
      amount:               amount,
      fee:                  fee,
      net_to_agent:         netAmount,
      currency:             "EGP",
      agent_float_balance:  parseFloat(updatedAgent.rows[0].float_balance).toFixed(2),
      customer: {
        name:  customer.name,
        phone: customer.phone,
      },
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("cashout error:", err);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};
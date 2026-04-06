const { pool }  = require("../../config/db");
const crypto    = require("crypto");

const PLATFORM_FEE_RATE = 0.005; // 0.5%

exports.cashin = async (req, res) => {
  const { customer_phone, amount, note } = req.body;
  const agentUserId = req.user.id;

  // 1. Validate input
  if (!customer_phone || !amount) {
    return res.status(400).json({ message: "customer_phone and amount are required" });
  }

  // 2. Validate amount
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ message: "Amount must be a positive number" });
  }

  if (parsedAmount < 50) {
    return res.status(400).json({ message: "Minimum cash-in amount is 50 EGP" });
  }

  if (parsedAmount > 10000) {
    return res.status(400).json({ message: "Maximum cash-in amount is 10,000 EGP" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 3. Get agent record
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

    // 4. Check agent is active
    if (!agent.is_active) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "Your agent account is suspended" });
    }

    // 5. Check agent float balance
    if (parseFloat(agent.float_balance) < parsedAmount) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message:           "Insufficient float balance",
        float_balance:     parseFloat(agent.float_balance).toFixed(2),
        required:          parsedAmount.toFixed(2),
      });
    }

    // 6. Find customer by phone
    const cleanPhone = customer_phone.replace(/\s/g, "");
    const customerResult = await client.query(
      `SELECT id, name, phone, status FROM users
       WHERE phone = $1 LIMIT 1`,
      [cleanPhone]
    );

    if (customerResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Customer not found" });
    }

    const customer = customerResult.rows[0];

    // 7. Check customer is active
    if (customer.status !== "active") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Customer account is not active" });
    }

    // 8. Prevent agent cashing in to themselves
    if (customer.id === agentUserId) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "You cannot cash-in to your own account" });
    }

    // 9. Calculate fee
    const fee       = parseFloat((parsedAmount * PLATFORM_FEE_RATE).toFixed(2));
    const netAmount = parseFloat((parsedAmount - fee).toFixed(2));

    // 10. Lock customer wallet
    const customerWalletRes = await client.query(
      `SELECT id, balance, status FROM wallets
       WHERE user_id = $1 LIMIT 1 FOR UPDATE`,
      [customer.id]
    );

    if (customerWalletRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Customer wallet not found" });
    }

    const customerWallet = customerWalletRes.rows[0];

    if (customerWallet.status === "suspended") {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Customer wallet is suspended" });
    }

    // 11. Generate references
    const agentRefNo    = crypto.randomUUID();
    const customerRefNo = crypto.randomUUID();

    // 12. Deduct from agent float balance
    await client.query(
      `UPDATE agents SET float_balance = float_balance - $1 WHERE id = $2`,
      [parsedAmount, agent.id]
    );

    // 13. Credit customer wallet (net amount after fee)
    await client.query(
      `UPDATE wallets SET balance = balance + $1 WHERE id = $2`,
      [netAmount, customerWallet.id]
    );

    // 14. Insert agent transaction record
    const agentTxResult = await client.query(
      `INSERT INTO agent_transactions
        (agent_id, user_id, type, status, amount, fee, reference_no, note)
       VALUES ($1, $2, 'cashin', 'completed', $3, $4, $5, $6)
       RETURNING id`,
      [
        agent.id,
        customer.id,
        parsedAmount,
        fee,
        agentRefNo,
        note || `Cash-in for ${customer.name}`,
      ]
    );

    // 15. Insert customer wallet transaction
    await client.query(
      `INSERT INTO transactions
        (reference_no, wallet_id, user_id, type, status, amount, fee, description, metadata)
       VALUES ($1, $2, $3, 'topup', 'completed', $4, $5, $6, $7)`,
      [
        customerRefNo,
        customerWallet.id,
        customer.id,
        parsedAmount,
        fee,
        note || `Cash-in via agent — ${agent.business_name}`,
        JSON.stringify({
          agent_id:       agent.id,
          agent_name:     agent.business_name,
          agent_ref:      agentRefNo,
          payment_method: "agent",
        }),
      ]
    );

    // 16. Platform fee
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
         VALUES ($1, $2, 'cashin_fee')`,
        [agentTxResult.rows[0].id, fee]
      );
    }

    await client.query("COMMIT");

    // 17. Get updated float balance
    const updatedAgent = await pool.query(
      `SELECT float_balance FROM agents WHERE id = $1`,
      [agent.id]
    );

    return res.status(200).json({
      message:          "Cash-in successful",
      reference_no:     agentRefNo,
      amount:           parsedAmount,
      fee:              fee,
      net_credited:     netAmount,
      currency:         "EGP",
      agent_float_balance: parseFloat(updatedAgent.rows[0].float_balance).toFixed(2),
      customer: {
        name:           customer.name,
        phone:          customer.phone,
        amount_credited: netAmount,
      },
    });

  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("cashin error:", err);
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    client.release();
  }
};
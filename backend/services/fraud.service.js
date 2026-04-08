const { pool } = require("../config/db");

// Flag types
const FLAG_TYPES = {
  LARGE_AMOUNT:       "large_amount",
  HIGH_VELOCITY:      "high_velocity",
  MULTIPLE_FAILURES:  "multiple_failures",
  UNUSUAL_PATTERN:    "unusual_pattern",
  RAPID_TRANSFERS:    "rapid_transfers",
};

// ── Check for large amount ────────────────────────────────
const checkLargeAmount = async (userId, transaction) => {
  const amount = parseFloat(transaction.amount);

  if (amount >= 10000) {
    await createFraudFlag({
      transaction_id: transaction.id,
      user_id:        userId,
      flag_type:      FLAG_TYPES.LARGE_AMOUNT,
      severity:       amount >= 50000 ? "critical" : "high",
      description:    `Large transaction detected: ${amount} EGP`,
      metadata: {
        amount,
        type:         transaction.type,
        reference_no: transaction.reference_no,
      },
    });
  }
};

// ── Check for high velocity (many transactions in short time) ─
const checkHighVelocity = async (userId) => {
  const result = await pool.query(
    `SELECT COUNT(*) AS count
     FROM transactions
     WHERE user_id    = $1
     AND   created_at >= NOW() - INTERVAL '1 hour'
     AND   status     = 'completed'`,
    [userId]
  );

  const count = parseInt(result.rows[0].count);

  if (count >= 10) {
    await createFraudFlag({
      transaction_id: null,
      user_id:        userId,
      flag_type:      FLAG_TYPES.HIGH_VELOCITY,
      severity:       count >= 20 ? "critical" : "high",
      description:    `High velocity detected: ${count} transactions in the last hour`,
      metadata:       { transaction_count: count, window: "1 hour" },
    });
  }
};

// ── Check for multiple failed attempts ──────────────────────
const checkMultipleFailures = async (userId) => {
  const result = await pool.query(
    `SELECT COUNT(*) AS count
     FROM transactions
     WHERE user_id    = $1
     AND   status     = 'failed'
     AND   created_at >= NOW() - INTERVAL '30 minutes'`,
    [userId]
  );

  const count = parseInt(result.rows[0].count);

  if (count >= 5) {
    await createFraudFlag({
      transaction_id: null,
      user_id:        userId,
      flag_type:      FLAG_TYPES.MULTIPLE_FAILURES,
      severity:       "medium",
      description:    `Multiple failed transactions: ${count} failures in 30 minutes`,
      metadata:       { failure_count: count, window: "30 minutes" },
    });
  }
};

// ── Check for rapid transfers ────────────────────────────────
const checkRapidTransfers = async (userId) => {
  const result = await pool.query(
    `SELECT COUNT(*) AS count, SUM(amount) AS total
     FROM transactions
     WHERE user_id    = $1
     AND   type       = 'transfer'
     AND   status     = 'completed'
     AND   created_at >= NOW() - INTERVAL '10 minutes'`,
    [userId]
  );

  const count = parseInt(result.rows[0].count);
  const total = parseFloat(result.rows[0].total || 0);

  if (count >= 5 || total >= 5000) {
    await createFraudFlag({
      transaction_id: null,
      user_id:        userId,
      flag_type:      FLAG_TYPES.RAPID_TRANSFERS,
      severity:       total >= 10000 ? "critical" : "high",
      description:    `Rapid transfers detected: ${count} transfers totaling ${total} EGP in 10 minutes`,
      metadata:       { transfer_count: count, total_amount: total, window: "10 minutes" },
    });
  }
};

// ── Create fraud flag ────────────────────────────────────────
const createFraudFlag = async ({ transaction_id, user_id, flag_type, severity, description, metadata }) => {
  try {
    // Check if same flag already exists and is open
    const existing = await pool.query(
      `SELECT id FROM fraud_flags
       WHERE user_id   = $1
       AND   flag_type = $2
       AND   status    = 'open'
       AND   created_at >= NOW() - INTERVAL '1 hour'
       LIMIT 1`,
      [user_id, flag_type]
    );

    if (existing.rowCount > 0) return; // Already flagged

    await pool.query(
      `INSERT INTO fraud_flags
        (transaction_id, user_id, flag_type, severity, description, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [transaction_id, user_id, flag_type, severity, description, JSON.stringify(metadata)]
    );

    console.log(`🚨 Fraud flag created: ${flag_type} for user ${user_id}`);
  } catch (err) {
    console.error("createFraudFlag error:", err.message);
  }
};

// ── Run all checks ────────────────────────────────────────────
const runFraudChecks = async (userId, transaction) => {
  try {
    await Promise.all([
      checkLargeAmount(userId, transaction),
      checkHighVelocity(userId),
      checkMultipleFailures(userId),
      checkRapidTransfers(userId),
    ]);
  } catch (err) {
    console.error("runFraudChecks error:", err.message);
  }
};

module.exports = { runFraudChecks, createFraudFlag };
const { pool } = require("../../config/db");

exports.getFraudFlags = async (req, res) => {
  try {
    // 1. Pagination
    const page   = parseInt(req.query.page)  || 1;
    const limit  = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    // 2. Filter params
    const { status, severity, flag_type, user_id, from, to } = req.query;

    // 3. Build WHERE clause
    const conditions = [];
    const values     = [];
    let index        = 1;

    if (status) {
      conditions.push(`ff.status = $${index++}`);
      values.push(status);
    }

    if (severity) {
      conditions.push(`ff.severity = $${index++}`);
      values.push(severity);
    }

    if (flag_type) {
      conditions.push(`ff.flag_type = $${index++}`);
      values.push(flag_type);
    }

    if (user_id) {
      conditions.push(`ff.user_id = $${index++}`);
      values.push(parseInt(user_id));
    }

    if (from) {
      conditions.push(`ff.created_at >= $${index++}`);
      values.push(new Date(from));
    }

    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      conditions.push(`ff.created_at <= $${index++}`);
      values.push(toDate);
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    // 4. Get total count
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM fraud_flags ff ${whereClause}`,
      values
    );

    const totalFlags = parseInt(countResult.rows[0].count);
    const totalPages = Math.ceil(totalFlags / limit);

    // 5. Get fraud flags with full details
    const flagsResult = await pool.query(
      `SELECT
        ff.id,
        ff.flag_type,
        ff.severity,
        ff.status,
        ff.description,
        ff.metadata,
        ff.resolution_note,
        ff.resolved_at,
        ff.created_at,
        ff.updated_at,
        u.id          AS user_id,
        u.name        AS user_name,
        u.email       AS user_email,
        u.phone       AS user_phone,
        u.status      AS user_status,
        t.id          AS transaction_id,
        t.reference_no,
        t.type        AS transaction_type,
        t.amount      AS transaction_amount,
        t.status      AS transaction_status,
        r.name        AS resolved_by_name
       FROM fraud_flags ff
       JOIN users u ON u.id = ff.user_id
       LEFT JOIN transactions t ON t.id  = ff.transaction_id
       LEFT JOIN users r        ON r.id  = ff.resolved_by
       ${whereClause}
       ORDER BY
         CASE ff.severity
           WHEN 'critical' THEN 1
           WHEN 'high'     THEN 2
           WHEN 'medium'   THEN 3
           WHEN 'low'      THEN 4
         END ASC,
         ff.created_at DESC
       LIMIT $${index++} OFFSET $${index++}`,
      [...values, limit, offset]
    );

    // 6. Summary stats
    const statsResult = await pool.query(
      `SELECT
        COUNT(*)                                                          AS total,
        COUNT(CASE WHEN ff.status   = 'open'      THEN 1 END)            AS open,
        COUNT(CASE WHEN ff.status   = 'reviewing' THEN 1 END)            AS reviewing,
        COUNT(CASE WHEN ff.status   = 'resolved'  THEN 1 END)            AS resolved,
        COUNT(CASE WHEN ff.status   = 'dismissed' THEN 1 END)            AS dismissed,
        COUNT(CASE WHEN ff.severity = 'critical'  THEN 1 END)            AS critical,
        COUNT(CASE WHEN ff.severity = 'high'      THEN 1 END)            AS high,
        COUNT(CASE WHEN ff.severity = 'medium'    THEN 1 END)            AS medium,
        COUNT(CASE WHEN ff.severity = 'low'       THEN 1 END)            AS low
       FROM fraud_flags ff
       ${whereClause}`,
      values
    );

    const stats = statsResult.rows[0];

    return res.status(200).json({
      page,
      limit,
      total_flags:  totalFlags,
      total_pages:  totalPages,
      has_next:     page < totalPages,
      has_prev:     page > 1,
      summary: {
        total:      parseInt(stats.total      || 0),
        by_status: {
          open:       parseInt(stats.open       || 0),
          reviewing:  parseInt(stats.reviewing  || 0),
          resolved:   parseInt(stats.resolved   || 0),
          dismissed:  parseInt(stats.dismissed  || 0),
        },
        by_severity: {
          critical:   parseInt(stats.critical   || 0),
          high:       parseInt(stats.high       || 0),
          medium:     parseInt(stats.medium     || 0),
          low:        parseInt(stats.low        || 0),
        },
      },
      flags: flagsResult.rows.map((flag) => ({
        id:           flag.id,
        flag_type:    flag.flag_type,
        severity:     flag.severity,
        status:       flag.status,
        description:  flag.description,
        metadata:     flag.metadata,
        user: {
          id:     flag.user_id,
          name:   flag.user_name,
          email:  flag.user_email,
          phone:  flag.user_phone,
          status: flag.user_status,
        },
        transaction: flag.transaction_id ? {
          id:           flag.transaction_id,
          reference_no: flag.reference_no,
          type:         flag.transaction_type,
          amount:       parseFloat(flag.transaction_amount).toFixed(2),
          status:       flag.transaction_status,
        } : null,
        resolution: flag.resolved_at ? {
          resolved_by:  flag.resolved_by_name,
          note:         flag.resolution_note,
          resolved_at:  flag.resolved_at,
        } : null,
        created_at: flag.created_at,
        updated_at: flag.updated_at,
      })),
    });

  } catch (err) {
    console.error("getFraudFlags error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
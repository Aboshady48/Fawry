const { pool } = require("../../config/db");

exports.resolveFraudFlag = async (req, res) => {
  const { id }                      = req.params;
  const { status, resolution_note } = req.body;
  const adminId                     = req.user.id;

  if (isNaN(id)) {
    return res.status(400).json({ message: "Invalid flag ID" });
  }

  const validStatuses = ["reviewing", "resolved", "dismissed"];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({
      message: `Status must be one of: ${validStatuses.join(", ")}`,
    });
  }

  if ((status === "resolved" || status === "dismissed") && !resolution_note) {
    return res.status(400).json({
      message: "resolution_note is required when resolving or dismissing a flag",
    });
  }

  try {
    // ✅ Cast $1 explicitly to fraud_flag_status
    const result = await pool.query(
      `UPDATE fraud_flags
       SET status          = $1::fraud_flag_status,
           resolution_note = $2,
           resolved_by     = $3,
           resolved_at     = CASE 
                               WHEN $1::fraud_flag_status IN ('resolved', 'dismissed') 
                               THEN NOW() 
                               ELSE NULL 
                             END,
           updated_at      = NOW()
       WHERE id = $4
       RETURNING *`,
      [status, resolution_note || null, adminId, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Fraud flag not found" });
    }

    return res.status(200).json({
      message: `Fraud flag marked as ${status}`,
      flag:    result.rows[0],
    });

  } catch (err) {
    console.error("resolveFraudFlag error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};  
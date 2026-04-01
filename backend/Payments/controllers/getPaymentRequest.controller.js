const { pool } = require("../../config/db");

exports.getPaymentRequest = async (req, res) => {
  const { requestId } = req.params;

  try {
    const result = await pool.query(
      `SELECT
        pr.id,
        pr.reference_no,
        pr.amount,
        pr.note,
        pr.status,
        pr.payer_phone,
        pr.expires_at,
        pr.paid_at,
        pr.created_at,
        u.name    AS requester_name,
        u.phone   AS requester_phone
       FROM payment_requests pr
       JOIN users u ON u.id = pr.requester_id
       WHERE pr.reference_no = $1
       LIMIT 1`,
      [requestId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Payment request not found" });
    }

    const request = result.rows[0];

    // Check if expired
    if (new Date() > new Date(request.expires_at) && request.status === "pending") {
      await pool.query(
        `UPDATE payment_requests SET status = 'expired' WHERE reference_no = $1`,
        [requestId]
      );
      request.status = "expired";
    }

    return res.status(200).json({
      reference_no: request.reference_no,
      amount:       parseFloat(request.amount).toFixed(2),
      currency:     "EGP",
      note:         request.note,
      status:       request.status,
      expires_at:   request.expires_at,
      paid_at:      request.paid_at,
      created_at:   request.created_at,
      requester: {
        name:  request.requester_name,
        phone: request.requester_phone,
      },
      payer_phone: request.payer_phone,
    });

  } catch (err) {
    console.error("getPaymentRequest error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
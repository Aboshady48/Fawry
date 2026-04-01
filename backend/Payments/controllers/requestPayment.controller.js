const { pool } = require("../../config/db");
const crypto   = require("crypto");
const QRCode   = require("qrcode");

exports.requestPayment = async (req, res) => {
  const { amount, payer_phone, note, expires_in_minutes } = req.body;
  const requesterId = req.user.id;

  // 1. Validate input
  if (!amount) {
    return res.status(400).json({ message: "Amount is required" });
  }

  // 2. Validate amount
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount < 1) {
    return res.status(400).json({ message: "Amount must be at least 1 EGP" });
  }

  if (parsedAmount > 10000) {
    return res.status(400).json({ message: "Maximum request amount is 10,000 EGP" });
  }

  try {
    // 3. Get requester info
    const requesterResult = await pool.query(
      `SELECT id, name, phone FROM users WHERE id = $1 LIMIT 1`,
      [requesterId]
    );
    const requester = requesterResult.rows[0];

    // 4. If payer_phone provided, validate they exist
    let payer = null;
    if (payer_phone) {
      const cleanPhone = payer_phone.replace(/\s/g, "");

      // Prevent requesting from yourself
      if (requester.phone === cleanPhone) {
        return res.status(400).json({ message: "You cannot request payment from yourself" });
      }

      const payerResult = await pool.query(
        `SELECT id, name, phone, status FROM users WHERE phone = $1 LIMIT 1`,
        [cleanPhone]
      );

      if (payerResult.rowCount === 0) {
        return res.status(404).json({ message: "Payer not found" });
      }

      payer = payerResult.rows[0];

      if (payer.status !== "active") {
        return res.status(400).json({ message: "Payer account is not active" });
      }
    }

    // 5. Set expiry (default 24 hours)
    const expiryMinutes = parseInt(expires_in_minutes) || 1440;
    const expiresAt     = new Date(Date.now() + expiryMinutes * 60 * 1000);

    // 6. Generate unique reference
    const referenceNo = crypto.randomUUID();

    // 7. Build payment link
    const paymentLink = `${process.env.FRONTEND_URL}/pay/${referenceNo}`;

    // 8. Generate QR code
    const qrCodeBase64 = await QRCode.toDataURL(paymentLink, {
      width:  300,
      margin: 2,
      color: {
        dark:  "#000000",
        light: "#ffffff",
      },
    });

    // 9. Save payment request to DB
    const result = await pool.query(
      `INSERT INTO payment_requests
        (reference_no, requester_id, payer_phone, amount, note, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        referenceNo,
        requesterId,
        payer ? payer.phone : null,
        parsedAmount,
        note || null,
        expiresAt,
      ]
    );

    const paymentRequest = result.rows[0];

    return res.status(201).json({
      message:       "Payment request created successfully",
      reference_no:  referenceNo,
      payment_link:  paymentLink,
      qr_code:       qrCodeBase64,
      amount:        parsedAmount,
      currency:      "EGP",
      note:          note || null,
      expires_at:    expiresAt,
      status:        "pending",
      requester: {
        name:  requester.name,
        phone: requester.phone,
      },
      ...(payer && {
        payer: {
          name:  payer.name,
          phone: payer.phone,
        },
      }),
    });

  } catch (err) {
    console.error("requestPayment error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
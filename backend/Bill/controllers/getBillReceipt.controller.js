const { pool }      = require("../../config/db");
const PDFDocument   = require("pdfkit");

exports.getBillReceipt = async (req, res) => {
  const { billPaymentId } = req.params;
  const { format }        = req.query;
  const userId            = req.user.id;

  // 1. Validate ID
  if (isNaN(billPaymentId)) {
    return res.status(400).json({ message: "Invalid bill payment ID" });
  }

  try {
    // 2. Get the bill payment transaction
    const result = await pool.query(
      `SELECT
        t.id,
        t.reference_no,
        t.amount,
        t.fee,
        t.status,
        t.description,
        t.metadata,
        t.created_at,
        u.name      AS user_name,
        u.email     AS user_email,
        u.phone     AS user_phone
       FROM transactions t
       JOIN users u ON u.id = t.user_id
       WHERE t.id      = $1
       AND   t.user_id = $2
       AND   t.type    = 'bill_payment'
       AND   t.status  = 'completed'
       LIMIT 1`,
      [billPaymentId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Bill payment receipt not found" });
    }

    const tx       = result.rows[0];
    const metadata = tx.metadata || {};
    const totalPaid = parseFloat(
      (parseFloat(tx.amount) + parseFloat(tx.fee)).toFixed(2)
    );

    // 3. Return JSON format
    if (format !== "pdf") {
      return res.status(200).json({
        receipt: {
          transaction_id: tx.id,
          reference_no:   tx.reference_no,
          biller: {
            id:         metadata.biller_id,
            name:       metadata.biller_name,
            category:   metadata.category,
          },
          account_ref:    metadata.account_ref,
          amount:         parseFloat(tx.amount).toFixed(2),
          fee:            parseFloat(tx.fee).toFixed(2),
          total_paid:     totalPaid.toFixed(2),
          currency:       "EGP",
          status:         tx.status,
          paid_at:        tx.created_at,
          paid_by: {
            name:         tx.user_name,
            email:        tx.user_email,
            phone:        tx.user_phone,
          },
        },
      });
    }

    // 4. Generate PDF receipt
    const doc = new PDFDocument({ margin: 50, size: "A4" });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=receipt-${tx.reference_no}.pdf`
    );

    doc.pipe(res);

    // ── Header ──────────────────────────────────────────
    doc
      .fontSize(28)
      .fillColor("#4CAF50")
      .text("FAWRY", { align: "center" })
      .fontSize(12)
      .fillColor("#666666")
      .text("Bill Payment Receipt", { align: "center" })
      .moveDown(0.5);

    // ── Green divider ────────────────────────────────────
    doc
      .moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .strokeColor("#4CAF50")
      .lineWidth(2)
      .stroke()
      .moveDown(0.5);

    // ── Success badge ────────────────────────────────────
    doc
      .fontSize(14)
      .fillColor("#4CAF50")
      .text("✓  Payment Successful", { align: "center" })
      .moveDown(1);

    // ── Amount box ───────────────────────────────────────
    const boxY = doc.y;
    doc
      .rect(150, boxY, 300, 60)
      .fillAndStroke("#f0faf0", "#4CAF50");

    doc
      .fontSize(12)
      .fillColor("#666666")
      .text("Amount Paid", 0, boxY + 10, { align: "center" })
      .fontSize(24)
      .fillColor("#2e7d32")
      .text(`${totalPaid.toFixed(2)} EGP`, 0, boxY + 28, { align: "center" });

    doc.moveDown(4);

    // ── Divider ──────────────────────────────────────────
    doc
      .moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .strokeColor("#eeeeee")
      .lineWidth(1)
      .stroke()
      .moveDown(0.5);

    // ── Bill Details ─────────────────────────────────────
    doc
      .fontSize(14)
      .fillColor("#4CAF50")
      .text("Bill Details", { underline: true })
      .moveDown(0.5);

    const detailsLeft  = 60;
    const detailsRight = 300;

    const addRow = (label, value, color = "#333333") => {
      const y = doc.y;
      doc
        .fontSize(11)
        .fillColor("#999999")
        .text(label, detailsLeft, y)
        .fillColor(color)
        .text(value, detailsRight, y)
        .moveDown(0.4);
    };

    addRow("Biller",         metadata.biller_name  || "N/A");
    addRow("Category",       metadata.category     || "N/A");
    addRow("Account Ref",    metadata.account_ref  || "N/A");
    addRow("Bill Amount",    `${parseFloat(tx.amount).toFixed(2)} EGP`);
    addRow("Service Fee",    `${parseFloat(tx.fee).toFixed(2)} EGP`);
    addRow("Total Paid",     `${totalPaid.toFixed(2)} EGP`, "#2e7d32");
    addRow("Currency",       "EGP");
    addRow("Status",         "Completed ✓", "#4CAF50");
    addRow("Paid At",        new Date(tx.created_at).toLocaleString());

    doc.moveDown(0.5);

    // ── Divider ──────────────────────────────────────────
    doc
      .moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .strokeColor("#eeeeee")
      .lineWidth(1)
      .stroke()
      .moveDown(0.5);

    // ── Transaction Details ───────────────────────────────
    doc
      .fontSize(14)
      .fillColor("#4CAF50")
      .text("Transaction Details", { underline: true })
      .moveDown(0.5);

    addRow("Transaction ID",  tx.id.toString());
    addRow("Reference No",    tx.reference_no);

    doc.moveDown(0.5);

    // ── Divider ──────────────────────────────────────────
    doc
      .moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .strokeColor("#eeeeee")
      .lineWidth(1)
      .stroke()
      .moveDown(0.5);

    // ── Paid By ───────────────────────────────────────────
    doc
      .fontSize(14)
      .fillColor("#4CAF50")
      .text("Paid By", { underline: true })
      .moveDown(0.5);

    addRow("Name",  tx.user_name);
    addRow("Email", tx.user_email);
    addRow("Phone", tx.user_phone);

    doc.moveDown(1);

    // ── Footer ───────────────────────────────────────────
    doc
      .moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .strokeColor("#4CAF50")
      .lineWidth(2)
      .stroke()
      .moveDown(0.5)
      .fontSize(10)
      .fillColor("#999999")
      .text("This is an official payment receipt generated by Fawry.", { align: "center" })
      .text("For support contact: support@fawry.com", { align: "center" })
      .text(`Generated at: ${new Date().toLocaleString()}`, { align: "center" });

    doc.end();

  } catch (err) {
    console.error("getBillReceipt error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
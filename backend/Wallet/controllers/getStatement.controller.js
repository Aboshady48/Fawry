const { pool } = require("../../config/db");
const PDFDocument = require("pdfkit");

exports.getStatement = async (req, res) => {
  const userId = req.user.id;
  const { from, to, format } = req.query;

  // 1. Validate date range
  if (!from || !to) {
    return res.status(400).json({ message: "from and to date are required" });
  }

  const fromDate = new Date(from);
  const toDate   = new Date(to);
  toDate.setHours(23, 59, 59, 999); // include full last day

  if (isNaN(fromDate) || isNaN(toDate)) {
    return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
  }

  if (fromDate > toDate) {
    return res.status(400).json({ message: "from date must be before to date" });
  }

  try {
    // 2. Get user info
    const userResult = await pool.query(
      `SELECT u.name, u.email, u.phone, w.balance, w.id AS wallet_id
       FROM users u
       JOIN wallets w ON w.user_id = u.id
       WHERE u.id = $1 LIMIT 1`,
      [userId]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userResult.rows[0];

    // 3. Get transactions in date range
    const txResult = await pool.query(
      `SELECT
        t.reference_no,
        t.type,
        t.status,
        t.amount,
        t.fee,
        t.payment_method,
        t.description,
        t.created_at
       FROM transactions t
       WHERE t.user_id  = $1
       AND   t.created_at >= $2
       AND   t.created_at <= $3
       AND   t.status = 'completed'
       ORDER BY t.created_at ASC`,
      [userId, fromDate, toDate]
    );

    const transactions = txResult.rows;

    // 4. Calculate totals
    let totalCredits = 0;
    let totalDebits  = 0;
    let totalFees    = 0;

    transactions.forEach((tx) => {
      const amount = parseFloat(tx.amount);
      const fee    = parseFloat(tx.fee);

      if (tx.type === "topup") {
        totalCredits += amount;
      } else {
        totalDebits += amount;
      }
      totalFees += fee;
    });

    const netBalance = totalCredits - totalDebits - totalFees;

    // 5. Return JSON format
    if (format !== "pdf") {
      return res.status(200).json({
        statement: {
          generated_at: new Date(),
          period: {
            from: fromDate,
            to:   toDate,
          },
          account: {
            name:           user.name,
            email:          user.email,
            phone:          user.phone,
            current_balance: parseFloat(user.balance).toFixed(2),
            currency:       "EGP",
          },
          summary: {
            total_credits:  totalCredits.toFixed(2),
            total_debits:   totalDebits.toFixed(2),
            total_fees:     totalFees.toFixed(2),
            net_change:     netBalance.toFixed(2),
            currency:       "EGP",
          },
          transactions: transactions.map((tx) => ({
            date:           tx.created_at,
            reference_no:   tx.reference_no,
            type:           tx.type,
            description:    tx.description,
            payment_method: tx.payment_method,
            amount:         parseFloat(tx.amount).toFixed(2),
            fee:            parseFloat(tx.fee).toFixed(2),
            direction:      tx.type === "topup" ? "credit" : "debit",
          })),
        },
      });
    }

    // 6. Generate PDF
    const doc = new PDFDocument({ margin: 50 });

    // Set response headers for PDF download
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=statement-${from}-to-${to}.pdf`
    );

    doc.pipe(res);

    // ── Header ──────────────────────────────────────────
    doc
      .fontSize(24)
      .fillColor("#4CAF50")
      .text("FAWRY", { align: "center" })
      .fontSize(12)
      .fillColor("#666666")
      .text("Wallet Statement", { align: "center" })
      .moveDown(0.5);

    // ── Divider ─────────────────────────────────────────
    doc
      .moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .strokeColor("#4CAF50")
      .stroke()
      .moveDown(0.5);

    // ── Account Info ────────────────────────────────────
    doc
      .fontSize(12)
      .fillColor("#333333")
      .text(`Account Holder : ${user.name}`)
      .text(`Email          : ${user.email}`)
      .text(`Phone          : ${user.phone}`)
      .text(`Period         : ${from} to ${to}`)
      .text(`Generated At   : ${new Date().toLocaleString()}`)
      .text(`Current Balance: ${parseFloat(user.balance).toFixed(2)} EGP`)
      .moveDown(1);

    // ── Summary Box ─────────────────────────────────────
    doc
      .fontSize(14)
      .fillColor("#4CAF50")
      .text("Summary", { underline: true })
      .moveDown(0.5)
      .fontSize(12)
      .fillColor("#333333")
      .text(`Total Credits : + ${totalCredits.toFixed(2)} EGP`)
      .text(`Total Debits  : - ${totalDebits.toFixed(2)} EGP`)
      .text(`Total Fees    : - ${totalFees.toFixed(2)} EGP`)
      .text(`Net Change    :   ${netBalance.toFixed(2)} EGP`)
      .moveDown(1);

    // ── Transactions Table Header ────────────────────────
    doc
      .fontSize(14)
      .fillColor("#4CAF50")
      .text("Transactions", { underline: true })
      .moveDown(0.5);

    // Table header row
    doc
      .fontSize(10)
      .fillColor("#ffffff")
      .rect(50, doc.y, 500, 20)
      .fill("#4CAF50");

    const tableTop = doc.y - 20;
    doc
      .fillColor("#ffffff")
      .text("Date",         60,  tableTop + 5)
      .text("Reference",    130, tableTop + 5)
      .text("Type",         250, tableTop + 5)
      .text("Direction",    320, tableTop + 5)
      .text("Amount",       400, tableTop + 5)
      .text("Fee",          470, tableTop + 5)
      .moveDown(0.5);

    // ── Transaction Rows ────────────────────────────────
    transactions.forEach((tx, i) => {
      const rowY      = doc.y;
      const isEven    = i % 2 === 0;
      const direction = tx.type === "topup" ? "Credit" : "Debit";
      const color     = tx.type === "topup" ? "#2e7d32" : "#c62828";

      // Alternate row background
      if (isEven) {
        doc.rect(50, rowY, 500, 18).fill("#f5f5f5");
      }

      doc
        .fillColor("#333333")
        .fontSize(9)
        .text(new Date(tx.created_at).toLocaleDateString(), 60,  rowY + 4)
        .text(tx.reference_no,                               130, rowY + 4)
        .text(tx.type,                                       250, rowY + 4)
        .fillColor(color)
        .text(direction,                                     320, rowY + 4)
        .fillColor("#333333")
        .text(`${parseFloat(tx.amount).toFixed(2)} EGP`,    400, rowY + 4)
        .text(`${parseFloat(tx.fee).toFixed(2)} EGP`,       470, rowY + 4);

      doc.moveDown(0.5);

      // Add new page if needed
      if (doc.y > 700) {
        doc.addPage();
      }
    });

    // ── Footer ──────────────────────────────────────────
    doc
      .moveDown(2)
      .moveTo(50, doc.y)
      .lineTo(550, doc.y)
      .strokeColor("#4CAF50")
      .stroke()
      .moveDown(0.5)
      .fontSize(10)
      .fillColor("#999999")
      .text("This statement was generated automatically by Fawry.", { align: "center" })
      .text("For support contact: support@fawry.com", { align: "center" });

    doc.end();

  } catch (err) {
    console.error("getStatement error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
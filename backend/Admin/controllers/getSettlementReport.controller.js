const { pool }      = require("../../config/db");
const PDFDocument   = require("pdfkit");
const { Parser }    = require("json2csv");

exports.getSettlementReport = async (req, res) => {
  const { from, to, format, merchant_id } = req.query;

  // 1. Validate date range
  if (!from || !to) {
    return res.status(400).json({ message: "from and to date are required" });
  }

  const fromDate = new Date(from);
  const toDate   = new Date(to);
  toDate.setHours(23, 59, 59, 999);

  if (isNaN(fromDate) || isNaN(toDate)) {
    return res.status(400).json({ message: "Invalid date format. Use YYYY-MM-DD" });
  }

  if (fromDate > toDate) {
    return res.status(400).json({ message: "from date must be before to date" });
  }

  try {
    // 2. Build WHERE clause
    const conditions = [
      `t.created_at >= $1`,
      `t.created_at <= $2`,
      `t.status = 'completed'`,
      `t.type IN ('transfer', 'bill_payment', 'topup', 'withdrawal')`,
    ];
    const values = [fromDate, toDate];
    let index    = 3;

    if (merchant_id) {
      conditions.push(`m.id = $${index++}`);
      values.push(parseInt(merchant_id));
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    // 3. Get settlement data per merchant
    const settlementResult = await pool.query(
      `SELECT
        m.id                          AS merchant_id,
        m.business_name,
        m.iban,
        u.name                        AS owner_name,
        u.email                       AS owner_email,
        u.phone                       AS owner_phone,
        COUNT(t.id)                   AS total_transactions,
        SUM(t.amount)                 AS gross_amount,
        SUM(t.fee)                    AS total_fees,
        SUM(t.amount - t.fee)         AS net_amount,
        MIN(t.created_at)             AS first_transaction,
        MAX(t.created_at)             AS last_transaction
       FROM merchants m
       JOIN users        u  ON u.id  = m.user_id
       JOIN wallets      w  ON w.user_id = m.user_id
       JOIN transactions t  ON t.wallet_id = w.id
       ${whereClause}
       GROUP BY m.id, m.business_name, m.iban, u.name, u.email, u.phone
       ORDER BY gross_amount DESC`,
      values
    );

    const settlements = settlementResult.rows;

    // 4. Overall summary
    const totalGross  = settlements.reduce((sum, s) => sum + parseFloat(s.gross_amount  || 0), 0);
    const totalFees   = settlements.reduce((sum, s) => sum + parseFloat(s.total_fees    || 0), 0);
    const totalNet    = settlements.reduce((sum, s) => sum + parseFloat(s.net_amount    || 0), 0);
    const totalTx     = settlements.reduce((sum, s) => sum + parseInt(s.total_transactions || 0), 0);

    // 5. Return JSON
    if (!format || format === "json") {
      return res.status(200).json({
        report: {
          generated_at: new Date(),
          period: { from: fromDate, to: toDate },
          summary: {
            total_merchants:    settlements.length,
            total_transactions: totalTx,
            gross_amount:       totalGross.toFixed(2),
            total_fees:         totalFees.toFixed(2),
            net_amount:         totalNet.toFixed(2),
            currency:           "EGP",
          },
          settlements: settlements.map((s) => ({
            merchant: {
              id:             s.merchant_id,
              business_name:  s.business_name,
              iban:           s.iban,
              owner: {
                name:   s.owner_name,
                email:  s.owner_email,
                phone:  s.owner_phone,
              },
            },
            transactions:       parseInt(s.total_transactions),
            gross_amount:       parseFloat(s.gross_amount).toFixed(2),
            total_fees:         parseFloat(s.total_fees).toFixed(2),
            net_amount:         parseFloat(s.net_amount).toFixed(2),
            first_transaction:  s.first_transaction,
            last_transaction:   s.last_transaction,
            currency:           "EGP",
          })),
        },
      });
    }

    // 6. Generate CSV
    if (format === "csv") {
      const csvData = settlements.map((s) => ({
        "Merchant ID":        s.merchant_id,
        "Business Name":      s.business_name,
        "Owner Name":         s.owner_name,
        "Owner Email":        s.owner_email,
        "Owner Phone":        s.owner_phone,
        "IBAN":               s.iban,
        "Total Transactions": parseInt(s.total_transactions),
        "Gross Amount (EGP)": parseFloat(s.gross_amount).toFixed(2),
        "Total Fees (EGP)":   parseFloat(s.total_fees).toFixed(2),
        "Net Amount (EGP)":   parseFloat(s.net_amount).toFixed(2),
        "First Transaction":  s.first_transaction,
        "Last Transaction":   s.last_transaction,
        "Period From":        from,
        "Period To":          to,
      }));

      const parser = new Parser();
      const csv    = parser.parse(csvData);

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=settlement-report-${from}-to-${to}.csv`
      );

      return res.status(200).send(csv);
    }

    // 7. Generate PDF
    if (format === "pdf") {
      const doc = new PDFDocument({ margin: 50, size: "A4" });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=settlement-report-${from}-to-${to}.pdf`
      );

      doc.pipe(res);

      // ── Header ──────────────────────────────────────────
      doc
        .fontSize(24)
        .fillColor("#4CAF50")
        .text("FAWRY", { align: "center" })
        .fontSize(14)
        .fillColor("#666666")
        .text("Merchant Settlement Report", { align: "center" })
        .moveDown(0.5);

      // ── Divider ─────────────────────────────────────────
      doc
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .strokeColor("#4CAF50")
        .lineWidth(2)
        .stroke()
        .moveDown(0.5);

      // ── Period & Summary ─────────────────────────────────
      doc
        .fontSize(11)
        .fillColor("#333333")
        .text(`Period        : ${from} to ${to}`)
        .text(`Generated At  : ${new Date().toLocaleString()}`)
        .text(`Total Merchants: ${settlements.length}`)
        .moveDown(0.5);

      // ── Summary Box ──────────────────────────────────────
      doc
        .fontSize(14)
        .fillColor("#4CAF50")
        .text("Summary", { underline: true })
        .moveDown(0.5)
        .fontSize(11)
        .fillColor("#333333")
        .text(`Total Transactions : ${totalTx}`)
        .text(`Gross Amount       : ${totalGross.toFixed(2)} EGP`)
        .text(`Total Fees         : ${totalFees.toFixed(2)} EGP`)
        .text(`Net Amount         : ${totalNet.toFixed(2)} EGP`)
        .moveDown(1);

      // ── Table Header ─────────────────────────────────────
      doc
        .fontSize(14)
        .fillColor("#4CAF50")
        .text("Merchant Breakdown", { underline: true })
        .moveDown(0.5);

      doc
        .fontSize(9)
        .fillColor("#ffffff")
        .rect(50, doc.y, 500, 18)
        .fill("#4CAF50");

      const headerY = doc.y - 18;
      doc
        .fillColor("#ffffff")
        .text("Merchant",     55,  headerY + 4)
        .text("Transactions", 200, headerY + 4)
        .text("Gross (EGP)",  290, headerY + 4)
        .text("Fees (EGP)",   370, headerY + 4)
        .text("Net (EGP)",    450, headerY + 4)
        .moveDown(0.3);

      // ── Table Rows ────────────────────────────────────────
      settlements.forEach((s, i) => {
        const rowY   = doc.y;
        const isEven = i % 2 === 0;

        if (isEven) {
          doc.rect(50, rowY, 500, 16).fill("#f5f5f5");
        }

        doc
          .fontSize(8)
          .fillColor("#333333")
          .text(s.business_name,                        55,  rowY + 3)
          .text(s.total_transactions.toString(),         200, rowY + 3)
          .text(parseFloat(s.gross_amount).toFixed(2),  290, rowY + 3)
          .text(parseFloat(s.total_fees).toFixed(2),    370, rowY + 3)
          .text(parseFloat(s.net_amount).toFixed(2),    450, rowY + 3);

        doc.moveDown(0.4);

        if (doc.y > 700) doc.addPage();
      });

      // ── Footer ───────────────────────────────────────────
      doc
        .moveDown(2)
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .strokeColor("#4CAF50")
        .lineWidth(2)
        .stroke()
        .moveDown(0.5)
        .fontSize(9)
        .fillColor("#999999")
        .text("This report was generated automatically by Fawry.", { align: "center" })
        .text("For support: support@fawry.com", { align: "center" });

      doc.end();
      return;
    }

    return res.status(400).json({ message: "Invalid format. Use json, csv or pdf" });

  } catch (err) {
    console.error("getSettlementReport error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
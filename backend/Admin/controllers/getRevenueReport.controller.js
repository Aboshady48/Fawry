const { pool }    = require("../../config/db");
const PDFDocument = require("pdfkit");
const { Parser }  = require("json2csv");

exports.getRevenueReport = async (req, res) => {
  const { from, to, format } = req.query;

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
    // 2. Platform wallet summary
    const walletResult = await pool.query(
      `SELECT balance, total_earned FROM platform_wallet LIMIT 1`
    );

    // 3. Revenue breakdown by type
    const breakdownResult = await pool.query(
      `SELECT
        pr.type,
        COUNT(*)          AS total_transactions,
        SUM(pr.amount)    AS total_revenue,
        AVG(pr.amount)    AS avg_per_transaction,
        MIN(pr.amount)    AS min_fee,
        MAX(pr.amount)    AS max_fee
       FROM platform_revenue pr
       WHERE pr.created_at >= $1
       AND   pr.created_at <= $2
       GROUP BY pr.type
       ORDER BY total_revenue DESC`,
      [fromDate, toDate]
    );

    // 4. Daily revenue for chart
    const dailyResult = await pool.query(
      `SELECT
        DATE(pr.created_at)   AS date,
        SUM(pr.amount)        AS daily_revenue,
        COUNT(*)              AS transactions
       FROM platform_revenue pr
       WHERE pr.created_at >= $1
       AND   pr.created_at <= $2
       GROUP BY DATE(pr.created_at)
       ORDER BY date ASC`,
      [fromDate, toDate]
    );

    // 5. Weekly revenue
    const weeklyResult = await pool.query(
      `SELECT
        DATE_TRUNC('week', pr.created_at)   AS week_start,
        SUM(pr.amount)                       AS weekly_revenue,
        COUNT(*)                             AS transactions
       FROM platform_revenue pr
       WHERE pr.created_at >= $1
       AND   pr.created_at <= $2
       GROUP BY DATE_TRUNC('week', pr.created_at)
       ORDER BY week_start ASC`,
      [fromDate, toDate]
    );

    // 6. Total in period
    const totalResult = await pool.query(
      `SELECT
        COUNT(*)        AS total_transactions,
        SUM(pr.amount)  AS total_revenue,
        AVG(pr.amount)  AS avg_fee
       FROM platform_revenue pr
       WHERE pr.created_at >= $1
       AND   pr.created_at <= $2`,
      [fromDate, toDate]
    );

    const platformWallet = walletResult.rows[0];
    const total          = totalResult.rows[0];
    const breakdown      = breakdownResult.rows;
    const daily          = dailyResult.rows;
    const weekly         = weeklyResult.rows;

    // 7. Return JSON
    if (!format || format === "json") {
      return res.status(200).json({
        report: {
          generated_at: new Date(),
          period: {
            from: fromDate,
            to:   toDate,
          },
          platform_wallet: {
            current_balance: parseFloat(platformWallet?.balance      || 0).toFixed(2),
            total_earned:    parseFloat(platformWallet?.total_earned  || 0).toFixed(2),
            currency:        "EGP",
          },
          summary: {
            total_transactions: parseInt(total.total_transactions || 0),
            total_revenue:      parseFloat(total.total_revenue   || 0).toFixed(2),
            avg_fee:            parseFloat(total.avg_fee         || 0).toFixed(2),
            currency:           "EGP",
          },
          breakdown: breakdown.map((b) => ({
            type:               b.type,
            total_transactions: parseInt(b.total_transactions),
            total_revenue:      parseFloat(b.total_revenue).toFixed(2),
            avg_per_transaction: parseFloat(b.avg_per_transaction).toFixed(2),
            min_fee:            parseFloat(b.min_fee).toFixed(2),
            max_fee:            parseFloat(b.max_fee).toFixed(2),
            percentage:         total.total_revenue > 0
              ? ((parseFloat(b.total_revenue) / parseFloat(total.total_revenue)) * 100).toFixed(2) + "%"
              : "0%",
          })),
          daily_revenue: daily.map((d) => ({
            date:         d.date,
            revenue:      parseFloat(d.daily_revenue).toFixed(2),
            transactions: parseInt(d.transactions),
          })),
          weekly_revenue: weekly.map((w) => ({
            week_start:   w.week_start,
            revenue:      parseFloat(w.weekly_revenue).toFixed(2),
            transactions: parseInt(w.transactions),
          })),
        },
      });
    }

    // 8. Generate CSV
    if (format === "csv") {
      const csvData = breakdown.map((b) => ({
        "Fee Type":           b.type,
        "Total Transactions": parseInt(b.total_transactions),
        "Total Revenue (EGP)": parseFloat(b.total_revenue).toFixed(2),
        "Avg Fee (EGP)":      parseFloat(b.avg_per_transaction).toFixed(2),
        "Min Fee (EGP)":      parseFloat(b.min_fee).toFixed(2),
        "Max Fee (EGP)":      parseFloat(b.max_fee).toFixed(2),
        "Percentage":         total.total_revenue > 0
          ? ((parseFloat(b.total_revenue) / parseFloat(total.total_revenue)) * 100).toFixed(2) + "%"
          : "0%",
        "Period From":        from,
        "Period To":          to,
      }));

      const parser = new Parser();
      const csv    = parser.parse(csvData);

      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=revenue-report-${from}-to-${to}.csv`
      );

      return res.status(200).send(csv);
    }

    // 9. Generate PDF
    if (format === "pdf") {
      const doc = new PDFDocument({ margin: 50, size: "A4" });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=revenue-report-${from}-to-${to}.pdf`
      );

      doc.pipe(res);

      // ── Header ──────────────────────────────────────────
      doc
        .fontSize(24)
        .fillColor("#4CAF50")
        .text("FAWRY", { align: "center" })
        .fontSize(14)
        .fillColor("#666666")
        .text("Platform Revenue Report", { align: "center" })
        .moveDown(0.5);

      // ── Divider ─────────────────────────────────────────
      doc
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .strokeColor("#4CAF50")
        .lineWidth(2)
        .stroke()
        .moveDown(0.5);

      // ── Period ───────────────────────────────────────────
      doc
        .fontSize(11)
        .fillColor("#333333")
        .text(`Period       : ${from} to ${to}`)
        .text(`Generated At : ${new Date().toLocaleString()}`)
        .moveDown(1);

      // ── Platform Wallet ───────────────────────────────────
      doc
        .fontSize(14)
        .fillColor("#4CAF50")
        .text("Platform Wallet", { underline: true })
        .moveDown(0.5)
        .fontSize(11)
        .fillColor("#333333")
        .text(`Current Balance : ${parseFloat(platformWallet?.balance     || 0).toFixed(2)} EGP`)
        .text(`Total Earned    : ${parseFloat(platformWallet?.total_earned || 0).toFixed(2)} EGP`)
        .moveDown(1);

      // ── Summary ───────────────────────────────────────────
      doc
        .fontSize(14)
        .fillColor("#4CAF50")
        .text("Period Summary", { underline: true })
        .moveDown(0.5)
        .fontSize(11)
        .fillColor("#333333")
        .text(`Total Transactions : ${parseInt(total.total_transactions || 0)}`)
        .text(`Total Revenue      : ${parseFloat(total.total_revenue   || 0).toFixed(2)} EGP`)
        .text(`Average Fee        : ${parseFloat(total.avg_fee         || 0).toFixed(2)} EGP`)
        .moveDown(1);

      // ── Breakdown Table ───────────────────────────────────
      doc
        .fontSize(14)
        .fillColor("#4CAF50")
        .text("Revenue Breakdown by Type", { underline: true })
        .moveDown(0.5);

      doc
        .fontSize(9)
        .fillColor("#ffffff")
        .rect(50, doc.y, 500, 18)
        .fill("#4CAF50");

      const headerY = doc.y - 18;
      doc
        .fillColor("#ffffff")
        .text("Type",         55,  headerY + 4)
        .text("Transactions", 180, headerY + 4)
        .text("Revenue",      270, headerY + 4)
        .text("Avg Fee",      360, headerY + 4)
        .text("%",            450, headerY + 4)
        .moveDown(0.3);

      breakdown.forEach((b, i) => {
        const rowY   = doc.y;
        const isEven = i % 2 === 0;
        const pct    = total.total_revenue > 0
          ? ((parseFloat(b.total_revenue) / parseFloat(total.total_revenue)) * 100).toFixed(1) + "%"
          : "0%";

        if (isEven) doc.rect(50, rowY, 500, 16).fill("#f5f5f5");

        doc
          .fontSize(9)
          .fillColor("#333333")
          .text(b.type,                                      55,  rowY + 3)
          .text(b.total_transactions.toString(),             180, rowY + 3)
          .text(parseFloat(b.total_revenue).toFixed(2),     270, rowY + 3)
          .text(parseFloat(b.avg_per_transaction).toFixed(2), 360, rowY + 3)
          .text(pct,                                         450, rowY + 3);

        doc.moveDown(0.4);
        if (doc.y > 700) doc.addPage();
      });

      // ── Daily Revenue ─────────────────────────────────────
      doc
        .moveDown(1)
        .fontSize(14)
        .fillColor("#4CAF50")
        .text("Daily Revenue", { underline: true })
        .moveDown(0.5);

      doc
        .fontSize(9)
        .fillColor("#ffffff")
        .rect(50, doc.y, 300, 18)
        .fill("#4CAF50");

      const dailyHeaderY = doc.y - 18;
      doc
        .fillColor("#ffffff")
        .text("Date",         55,  dailyHeaderY + 4)
        .text("Revenue (EGP)", 180, dailyHeaderY + 4)
        .text("Transactions", 270, dailyHeaderY + 4)
        .moveDown(0.3);

      daily.forEach((d, i) => {
        const rowY   = doc.y;
        const isEven = i % 2 === 0;

        if (isEven) doc.rect(50, rowY, 300, 16).fill("#f5f5f5");

        doc
          .fontSize(9)
          .fillColor("#333333")
          .text(new Date(d.date).toLocaleDateString(), 55,  rowY + 3)
          .text(parseFloat(d.daily_revenue).toFixed(2), 180, rowY + 3)
          .text(d.transactions.toString(),              270, rowY + 3);

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
    console.error("getRevenueReport error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
const { pool } = require("../../config/db");

exports.getBillers = async (req, res) => {
  try {
    const { category, search } = req.query;

    // 1. Build dynamic WHERE clause
    const conditions = [`b.is_active = TRUE`];
    const values     = [];
    let index        = 1;

    if (category) {
      conditions.push(`b.category = $${index++}`);
      values.push(category);
    }

    if (search) {
      conditions.push(`b.name ILIKE $${index++}`);
      values.push(`%${search}%`);
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    // 2. Get billers
    const result = await pool.query(
      `SELECT
        b.id,
        b.name,
        b.category,
        b.logo_url,
        b.is_active
       FROM billers b
       ${whereClause}
       ORDER BY b.category ASC, b.name ASC`,
      values
    );

    // 3. Group by category
    const grouped = {};
    result.rows.forEach((biller) => {
      if (!grouped[biller.category]) {
        grouped[biller.category] = [];
      }
      grouped[biller.category].push({
        id:       biller.id,
        name:     biller.name,
        category: biller.category,
        logo_url: biller.logo_url,
      });
    });

    return res.status(200).json({
      total:   result.rowCount,
      grouped: grouped,
      billers: result.rows.map((b) => ({
        id:       b.id,
        name:     b.name,
        category: b.category,
        logo_url: b.logo_url,
      })),
    });

  } catch (err) {
    console.error("getBillers error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
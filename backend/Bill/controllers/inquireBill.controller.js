const { pool } = require("../../config/db");

// Simulate bill amounts per biller category
// In production this would call the biller's real API
const simulateBillerInquiry = (biller, accountRef) => {
  const now     = new Date();
  const dueDate = new Date(now);
  dueDate.setDate(dueDate.getDate() + 14); // due in 14 days

  const billingPeriodStart = new Date(now);
  billingPeriodStart.setMonth(billingPeriodStart.getMonth() - 1);

  // Generate realistic amount based on category
  const amounts = {
    electricity: Math.floor(Math.random() * (800  - 100)  + 100),
    water:       Math.floor(Math.random() * (300  - 50)   + 50),
    gas:         Math.floor(Math.random() * (200  - 30)   + 30),
    telecom:     Math.floor(Math.random() * (500  - 50)   + 50),
    internet:    Math.floor(Math.random() * (400  - 100)  + 100),
    insurance:   Math.floor(Math.random() * (2000 - 500)  + 500),
    education:   Math.floor(Math.random() * (5000 - 1000) + 1000),
    government:  Math.floor(Math.random() * (1000 - 100)  + 100),
    other:       Math.floor(Math.random() * (500  - 50)   + 50),
  };

  const amount = amounts[biller.category] || 100;

  // Check if overdue (simulate some bills being overdue)
  const isOverdue = Math.random() > 0.7;
  if (isOverdue) {
    dueDate.setDate(dueDate.getDate() - 30);
  }

  return {
    amount,
    due_date:       dueDate,
    billing_period: `${billingPeriodStart.toLocaleString("en", { month: "long" })} ${billingPeriodStart.getFullYear()}`,
    is_overdue:     isOverdue,
    late_fee:       isOverdue ? Math.floor(amount * 0.05) : 0,
  };
};

exports.inquireBill = async (req, res) => {
  const { biller_id, account_ref } = req.body;
  const userId = req.user.id;

  // 1. Validate input
  if (!biller_id || !account_ref) {
    return res.status(400).json({ message: "biller_id and account_ref are required" });
  }

  if (isNaN(biller_id)) {
    return res.status(400).json({ message: "Invalid biller_id" });
  }

  if (account_ref.toString().trim().length < 3) {
    return res.status(400).json({ message: "account_ref must be at least 3 characters" });
  }

  try {
    // 2. Get biller
    const billerResult = await pool.query(
      `SELECT id, name, category, logo_url, is_active
       FROM billers WHERE id = $1 LIMIT 1`,
      [biller_id]
    );

    if (billerResult.rowCount === 0) {
      return res.status(404).json({ message: "Biller not found" });
    }

    const biller = billerResult.rows[0];

    if (!biller.is_active) {
      return res.status(400).json({ message: "This biller is currently unavailable" });
    }

    // 3. Call biller inquiry API (simulated)
    // In production: const billerResponse = await axios.get(biller.inquiry_endpoint, { params: { account_ref } })
    const billerResponse = simulateBillerInquiry(biller, account_ref);

    const totalAmount = parseFloat(
      (billerResponse.amount + billerResponse.late_fee).toFixed(2)
    );

    // 4. Save inquiry to bills table
    const billResult = await pool.query(
      `INSERT INTO bills
        (user_id, biller_id, account_ref, amount, due_date, billing_period, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        userId,
        biller.id,
        account_ref.toString().trim(),
        totalAmount,
        billerResponse.due_date,
        billerResponse.billing_period,
        billerResponse.is_overdue ? "overdue" : "unpaid",
      ]
    );

    return res.status(200).json({
      message:      "Bill inquiry successful",
      bill: {
        biller: {
          id:       biller.id,
          name:     biller.name,
          category: biller.category,
          logo_url: biller.logo_url,
        },
        account_ref:    account_ref,
        amount:         billerResponse.amount,
        late_fee:       billerResponse.late_fee,
        total_amount:   totalAmount,
        currency:       "EGP",
        billing_period: billerResponse.billing_period,
        due_date:       billerResponse.due_date,
        is_overdue:     billerResponse.is_overdue,
        status:         billerResponse.is_overdue ? "overdue" : "unpaid",
      },
    });

  } catch (err) {
    console.error("inquireBill error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
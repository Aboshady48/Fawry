const { pool }  = require("../../config/db");
const crypto    = require("crypto");

exports.charge = async (req, res) => {
  const {
    amount,
    currency,
    order_id,
    customer_phone,
    callback_url,
    description,
  } = req.body;

  const userId = req.user.id;

  // 1. Validate input
  if (!amount || !order_id) {
    return res.status(400).json({
      message: "amount and order_id are required",
    });
  }

  // 2. Validate amount
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ message: "Amount must be a positive number" });
  }

  if (parsedAmount > 100000) {
    return res.status(400).json({ message: "Maximum charge amount is 100,000 EGP" });
  }

  // 3. Validate currency
  const validCurrencies = ["EGP"];
  const usedCurrency    = currency || "EGP";
  if (!validCurrencies.includes(usedCurrency)) {
    return res.status(400).json({ message: "Only EGP currency is supported" });
  }

  // 4. Validate callback URL if provided
  if (callback_url) {
    try {
      new URL(callback_url);
    } catch {
      return res.status(400).json({ message: "Invalid callback_url format" });
    }
  }

  // 5. Validate customer phone if provided
  let cleanPhone = null;
  if (customer_phone) {
    cleanPhone = customer_phone.replace(/\s/g, "");
  }

  try {
    // 6. Get merchant record
    const merchantResult = await pool.query(
      `SELECT m.id, m.business_name, m.is_active
      FROM merchants m
      WHERE m.user_id = $1 LIMIT 1`,
      [userId]
    );

    if (merchantResult.rowCount === 0) {
      return res.status(404).json({ message: "Merchant profile not found" });
    }

    const merchant = merchantResult.rows[0];

    if (!merchant.is_active) {
      return res.status(403).json({ message: "Your merchant account is suspended" });
    }

    // 7. Check order_id is unique for this merchant
    const existingOrder = await pool.query(
      `SELECT id FROM merchant_charges
       WHERE merchant_id = $1 AND order_id = $2
       LIMIT 1`,
      [merchant.id, order_id]
    );

    if (existingOrder.rowCount > 0) {
      return res.status(409).json({
        message: `Order ID ${order_id} already exists for your merchant account`,
      });
    }

    // 8. Find customer by phone if provided
    let customerId = null;
    let customer   = null;

    if (cleanPhone) {
      const customerResult = await pool.query(
        `SELECT id, name, phone, status FROM users WHERE phone = $1 LIMIT 1`,
        [cleanPhone]
      );

      if (customerResult.rowCount > 0) {
        customer   = customerResult.rows[0];
        customerId = customer.id;

        if (customer.status !== "active") {
          return res.status(400).json({ message: "Customer account is not active" });
        }
      }
    }

    // 9. Generate payment token and URL
    const paymentToken = crypto.randomBytes(32).toString("hex");
    const expiresAt    = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
    const paymentUrl   = `${process.env.FRONTEND_URL}/pay/merchant/${paymentToken}`;

    // 10. Create charge record
    const chargeResult = await pool.query(
      `INSERT INTO merchant_charges
        (merchant_id, customer_id, order_id, amount, currency, description,
         payment_token, payment_url, callback_url, customer_phone, expires_at, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [
        merchant.id,
        customerId,
        order_id,
        parsedAmount,
        usedCurrency,
        description || `Payment for order ${order_id}`,
        paymentToken,
        paymentUrl,
        callback_url  || null,
        cleanPhone    || null,
        expiresAt,
        JSON.stringify({
          merchant_name:  merchant.business_name,
          customer_phone: cleanPhone,
          order_id:       order_id,
        }),
      ]
    );

    const charge = chargeResult.rows[0];

    return res.status(201).json({
      message:       "Charge created successfully",
      charge: {
        id:            charge.id,
        order_id:      charge.order_id,
        amount:        parseFloat(charge.amount).toFixed(2),
        currency:      charge.currency,
        description:   charge.description,
        status:        charge.status,
        payment_token: charge.payment_token,
        payment_url:   charge.payment_url,
        expires_at:    charge.expires_at,
        created_at:    charge.created_at,
        ...(customer && {
          customer: {
            name:  customer.name,
            phone: customer.phone,
          },
        }),
      },
      instructions: "Share the payment_url or payment_token with your customer to complete the payment",
    });

  } catch (err) {
    console.error("charge error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
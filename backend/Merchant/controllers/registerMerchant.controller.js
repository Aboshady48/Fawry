const { pool }  = require("../../config/db");
const crypto    = require("crypto");

exports.registerMerchant = async (req, res) => {
  const {
    business_name,
    business_type,
    iban,
    webhook_url,
  } = req.body;

  const userId = req.user.id;

  // 1. Validate input
  if (!business_name || !iban) {
    return res.status(400).json({
      message: "business_name and iban are required",
    });
  }

  // 2. Validate business name length
  if (business_name.trim().length < 3) {
    return res.status(400).json({
      message: "Business name must be at least 3 characters",
    });
  }

  // 3. Validate IBAN format (basic)
  const ibanClean = iban.replace(/\s/g, "").toUpperCase();
  if (ibanClean.length < 15 || ibanClean.length > 34) {
    return res.status(400).json({
      message: "Invalid IBAN format",
    });
  }

  // 4. Validate webhook URL if provided
  if (webhook_url) {
    try {
      new URL(webhook_url);
    } catch {
      return res.status(400).json({
        message: "Invalid webhook URL format",
      });
    }
  }

  try {
    // 5. Check user is not already a merchant
    const existingMerchant = await pool.query(
      `SELECT id FROM merchants WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    if (existingMerchant.rowCount > 0) {
      return res.status(409).json({
        message: "You are already registered as a merchant",
      });
    }

    // 6. Generate unique API key
    const apiKey = `fawry_${crypto.randomBytes(24).toString("hex")}`;

    // 7. Update user role to merchant + insert merchant record in one transaction
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Update user role to merchant
      await client.query(
        `UPDATE users SET role = 'merchant' WHERE id = $1`,
        [userId]
      );

      // Insert merchant record
      const merchantResult = await client.query(
        `INSERT INTO merchants
          (user_id, business_name, business_type, iban, webhook_url, api_key)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          userId,
          business_name.trim(),
          business_type || null,
          ibanClean,
          webhook_url   || null,
          apiKey,
        ]
      );

      await client.query("COMMIT");

      const merchant = merchantResult.rows[0];

      return res.status(201).json({
        message: "Merchant registered successfully",
        merchant: {
          id:             merchant.id,
          business_name:  merchant.business_name,
          business_type:  merchant.business_type,
          iban:           merchant.iban,
          webhook_url:    merchant.webhook_url,
          api_key:        merchant.api_key,
          is_active:      merchant.is_active,
          created_at:     merchant.created_at,
        },
        warning: "Save your API key securely — it will not be shown again!",
      });

    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }

  } catch (err) {
    console.error("registerMerchant error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
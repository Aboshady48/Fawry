const { pool } = require("../../config/db");

exports.updateWebhook = async (req, res) => {
  const { webhook_url } = req.body;
  const userId = req.user.id;

  // 1. Validate input
  if (!webhook_url) {
    return res.status(400).json({ message: "webhook_url is required" });
  }

  // 2. Validate URL format
  try {
    new URL(webhook_url);
  } catch {
    return res.status(400).json({ message: "Invalid webhook URL format" });
  }

  // 3. Must be HTTPS in production
  if (process.env.NODE_ENV === "production" && !webhook_url.startsWith("https://")) {
    return res.status(400).json({ message: "Webhook URL must use HTTPS in production" });
  }

  try {
    // 4. Get merchant
    const merchantResult = await pool.query(
      `SELECT id, webhook_url FROM merchants WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    if (merchantResult.rowCount === 0) {
      return res.status(404).json({ message: "Merchant profile not found" });
    }

    const merchant = merchantResult.rows[0];

    // 5. Check if same URL
    if (merchant.webhook_url === webhook_url) {
      return res.status(400).json({ message: "New webhook URL is the same as the current one" });
    }

    // 6. Update webhook URL
    const result = await pool.query(
      `UPDATE merchants
       SET webhook_url = $1
       WHERE user_id   = $2
       RETURNING id, business_name, webhook_url, updated_at`,
      [webhook_url, userId]
    );

    const updated = result.rows[0];

    return res.status(200).json({
      message: "Webhook URL updated successfully",
      merchant: {
        id:            updated.id,
        business_name: updated.business_name,
        webhook_url:   updated.webhook_url,
        updated_at:    updated.updated_at,
      },
      events: [
        "payment.success",
        "payment.failed",
        "payment.refunded",
      ],
      note: "All payment events will be POSTed to your new webhook URL",
    });

  } catch (err) {
    console.error("updateWebhook error:", err);
    return res.status(500).json({ message: "Internal server error" });
  }
};
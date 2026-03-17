const bcrypt = require("bcryptjs");
const { pool } = require("../../config/db");

exports.register = async (req, res) => {
  const { name, email, phone, password, role } = req.body;

  // Basic validation
  if (!name || !email || !phone || !password) {
    return res.status(400).json({ message: "All fields are required" });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // 1. Check if email or phone already exists
    const existing = await client.query(
      "SELECT id FROM users WHERE email = $1 OR phone = $2 LIMIT 1",
      [email, phone]
    );
    if (existing.rowCount > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Email or phone already registered" });
    }

    // 2. Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. Insert the user
    const result = await client.query(
      `INSERT INTO users (name, email, phone, password, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, phone, role, is_verified, created_at`,
      [name, email, phone, hashedPassword, role || "customer"]
    );
    const user = result.rows[0];

    // 4. Create wallet with 0 balance
    await client.query(
      "INSERT INTO wallets (user_id, balance) VALUES ($1, 0.00)",
      [user.id]
    );

    // 5. Generate OTP and insert into DB
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await client.query(
      `INSERT INTO otps (user_id, phone, code, status, expires_at)
       VALUES ($1, $2, $3, 'pending', $4)`,
      [user.id, phone, otpCode, expiresAt]
    );

    await client.query("COMMIT");

    // TODO: replace with real SMS when provider is ready
    console.log(`📱 OTP for ${phone}: ${otpCode}`);

    return res.status(201).json({
      message: "User registered successfully. Check your phone for the OTP.",
      user,
    });

  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    client.release();
  }
};
const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host:     process.env.DB_HOST     || "localhost",
  port:     process.env.DB_PORT     || 5432,
  database: process.env.DB_NAME     || "fawry_db",
  user:     process.env.DB_USER     || "postgres",
  password: process.env.DB_PASSWORD || "159159",
});

// Test the connection when the app starts
const connectDB = async () => {
  try {
    const client = await pool.connect();
    console.log(`✅ PostgreSQL connected — database: ${process.env.DB_NAME}`);
    client.release();
  } catch (err) {
    console.error("❌ Failed to connect to PostgreSQL:", err.message);
    process.exit(1); // stop the app if DB is unreachable
  }
};

module.exports = { pool, connectDB };
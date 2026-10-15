/**
 * Database connection module.
 * Creates a mysql2 connection pool against the XAMPP MySQL/MariaDB server
 * and ensures the `products` table exists (CREATE TABLE IF NOT EXISTS).
 *
 * IMPORTANT: uses parameterized queries everywhere to prevent SQL injection.
 */
"use strict";

const mysql = require("mysql2");
const path = require("path");
const dotenv = require("dotenv");

// Load environment variables from the project root (.env)
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const {
  DB_HOST = "localhost",
  DB_PORT = 3306,
  DB_USER = "root",
  DB_PASSWORD = "",
  DB_NAME = "inventory_db",
  DB_CONNECTION_LIMIT = 10,
} = process.env;

const pool = mysql.createPool({
  host: DB_HOST,
  port: Number(DB_PORT) || 3306,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  connectionLimit: DB_CONNECTION_LIMIT,
  // MariaDB/MySQL default
  namedPlaceholders: true,
  supportBigNumbers: true,
  bigNumberStrings: true,
  dateStrings: true,
});

const promisePool = pool.promise();

/**
 * Initialize schema. Uses CREATE TABLE IF NOT EXISTS so it is safe to run
 * repeatedly. It NEVER drops tables or databases.
 */
const CREATE_PRODUCTS_TABLE = `
  CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
    low_stock_threshold INT NOT NULL DEFAULT 10,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_products_category (category),
    INDEX idx_products_name (name)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

async function initDatabase() {
  // Ensure the database itself exists (create if missing) before pooling.
  // We do NOT drop or alter any other database (lab_db, lap_db, etc.).
  const admin = mysql.createConnection({
    host: DB_HOST,
    port: Number(DB_PORT) || 3306,
    user: DB_USER,
    password: DB_PASSWORD,
  });

  await new Promise((resolve, reject) => {
    admin.connect((err) => err ? reject(err) : resolve());
  });

  await new Promise((resolve, reject) => {
    admin.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
      (err) => err ? reject(err) : resolve()
    );
  });

  admin.end();

  // Now create the table inside the target database.
  const conn = await pool.promise().getConnection();
  try {
    await conn.query(CREATE_PRODUCTS_TABLE);
  } finally {
    conn.release();
  }

  console.log(`[db] Connected to "${DB_NAME}" and ensured products table.`);
}

module.exports = { pool: promisePool, initDatabase };
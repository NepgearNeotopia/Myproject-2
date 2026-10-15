/**
 * Product CRUD logic.
 * All queries use parameterized statements (mysql2 placeholders) to
 * prevent SQL injection. Input is validated and normalized before hitting
 * the database.
 */
"use strict";

const { pool } = require("./db");

const ALLOWED_CATEGORIES = [
  "Electronics",
  "Stationery",
  "Food & Beverage",
  "Clothing",
  "Home & Kitchen",
  "Sports",
  "Other",
];

function normalizeProduct(input = {}) {
  const product_code = (input.product_code || "").toString().trim().slice(0, 50);
  const name = (input.name || "").toString().trim().slice(0, 255);
  const category = (input.category || "").toString().trim().slice(0, 100);
  const quantity = Number(input.quantity);
  const price = Number(input.price);
  const low_stock_threshold = Number(input.low_stock_threshold);

  const errors = {};
  if (!product_code) errors.product_code = "product_code is required";
  if (!name) errors.name = "name is required";
  if (!category) errors.category = "category is required";
  else if (!ALLOWED_CATEGORIES.includes(category)) {
    errors.category = `category must be one of: ${ALLOWED_CATEGORIES.join(", ")}`;
  }
  if (!Number.isFinite(quantity) || quantity < 0 || !Number.isInteger(quantity)) {
    errors.quantity = "quantity must be a non-negative integer";
  }
  if (!Number.isFinite(price) || price < 0) {
    errors.price = "price must be a non-negative number";
  }
  if (!Number.isFinite(low_stock_threshold) || low_stock_threshold < 0 || !Number.isInteger(low_stock_threshold)) {
    errors.low_stock_threshold = "low_stock_threshold must be a non-negative integer";
  }

  return {
    product_code,
    name,
    category,
    quantity,
    price: Number(price.toFixed(2)),
    low_stock_threshold,
    errors,
    valid: Object.keys(errors).length === 0,
  };
}

async function getAll({ search = "", category = "", lowStockOnly = false } = {}) {
  let sql = `SELECT id, product_code, name, category, quantity, price,
                      low_stock_threshold, created_at,
                      (quantity <= low_stock_threshold) AS is_low_stock
               FROM products
               WHERE 1 = 1`;
  const params = {};

  if (search) {
    sql += ` AND (name LIKE :search OR product_code LIKE :search)`;
    params.search = `%${search}%`;
  }
  if (category) {
    sql += ` AND category = :category`;
    params.category = category;
  }
  if (lowStockOnly) {
    sql += ` AND quantity <= low_stock_threshold`;
  }

  sql += ` ORDER BY created_at DESC, id DESC`;

  const [rows] = await pool.execute(sql, params);
  return rows;
}

async function getById(id) {
  const sql = `SELECT id, product_code, name, category, quantity, price,
                      low_stock_threshold, created_at,
                      (quantity <= low_stock_threshold) AS is_low_stock
               FROM products WHERE id = :id LIMIT 1`;
  const [rows] = await pool.execute(sql, { id });
  return rows[0] || null;
}

async function create(product) {
  const sql = `INSERT INTO products (product_code, name, category, quantity, price, low_stock_threshold)
               VALUES (:product_code, :name, :category, :quantity, :price, :low_stock_threshold)`;
  const [result] = await pool.execute(sql, product);
  return result.insertId;
}

async function update(id, product) {
  const sql = `UPDATE products
               SET product_code = :product_code,
                   name = :name,
                   category = :category,
                   quantity = :quantity,
                   price = :price,
                   low_stock_threshold = :low_stock_threshold
               WHERE id = :id`;
  const [result] = await pool.execute(sql, { ...product, id });
  return result.affectedRows;
}

async function remove(id) {
  const sql = `DELETE FROM products WHERE id = :id`;
  const [result] = await pool.execute(sql, { id });
  return result.affectedRows;
}

async function countAll() {
  const [rows] = await pool.execute(`SELECT COUNT(*) AS total FROM products`);
  return rows[0].total;
}

async function countLowStock() {
  const [rows] = await pool.execute(
    `SELECT COUNT(*) AS total FROM products WHERE quantity <= low_stock_threshold`
  );
  return rows[0].total;
}

module.exports = {
  ALLOWED_CATEGORIES,
  normalizeProduct,
  getAll,
  getById,
  create,
  update,
  remove,
  countAll,
  countLowStock,
};
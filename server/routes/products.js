/**
 * REST API routes for products.
 * Endpoints:
 *   GET    /api/products            list products (search, category, lowStockOnly)
 *   GET    /api/products/stats      summary counts (total, low stock)
 *   GET    /api/products/:id        get single product
 *   POST   /api/products            create product
 *   PUT    /api/products/:id        update product
 *   DELETE /api/products/:id        delete product
 */
"use strict";

const express = require("express");
const {
  normalizeProduct,
  getAll,
  getById,
  create,
  update,
  remove,
  countAll,
  countLowStock,
} = require("../products");

const router = express.Router();

function toBool(value) {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return ["true", "1", "yes", "on"].includes(value.toLowerCase());
  return Boolean(value);
}

// GET /api/products
router.get("/", async (req, res, next) => {
  try {
    const { search, category, lowStockOnly } = req.query;
    const products = await getAll({
      search: search ? String(search) : "",
      category: category ? String(category) : "",
      lowStockOnly: toBool(lowStockOnly),
    });
    res.json({ data: products });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/stats
router.get("/stats", async (_req, res, next) => {
  try {
    const [total, lowStock] = await Promise.all([countAll(), countLowStock()]);
    res.json({ data: { total, lowStock } });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:id
router.get("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid product id" });
    }
    const product = await getById(id);
    if (!product) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({ data: product });
  } catch (err) {
    next(err);
  }
});

// POST /api/products
router.post("/", async (req, res, next) => {
  try {
    const normalized = normalizeProduct(req.body || {});
    if (!normalized.valid) {
      return res.status(400).json({ error: "Validation failed", details: normalized.errors });
    }
    const id = await create(normalized);
    const created = await getById(id);
    res.status(201).json({ data: created });
  } catch (err) {
    // Handle duplicate product_code
    if (err && err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "product_code already exists" });
    }
    next(err);
  }
});

// PUT /api/products/:id
router.put("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid product id" });
    }
    const normalized = normalizeProduct(req.body || {});
    if (!normalized.valid) {
      return res.status(400).json({ error: "Validation failed", details: normalized.errors });
    }
    const affected = await update(id, normalized);
    if (affected === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    const updated = await getById(id);
    res.json({ data: updated });
  } catch (err) {
    if (err && err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "product_code already exists" });
    }
    next(err);
  }
});

// DELETE /api/products/:id
router.delete("/:id", async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: "Invalid product id" });
    }
    const affected = await remove(id);
    if (affected === 0) {
      return res.status(404).json({ error: "Product not found" });
    }
    res.json({ data: { deleted: true, id } });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
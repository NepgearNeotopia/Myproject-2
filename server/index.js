/**
 * Express application entry point.
 * - Serves the static frontend from public/
 * - Exposes REST API routes for products
 * - Initializes the database schema on startup
 */
"use strict";

const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const { initDatabase } = require("./db");
const productsRoutes = require("./routes/products");

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend
app.use(express.static(path.join(__dirname, "..", "public")));

// API routes
app.use("/api/products", productsRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// SPA fallback for any other route -> index.html
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "index.html"));
});

// Central error handler
app.use((err, _req, res, _next) => {
  console.error("[server] Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

async function start() {
  try {
    await initDatabase();
    app.listen(PORT, () => {
      console.log(`[server] Inventory app running at http://localhost:${PORT}`);
      console.log(`[server] API base: http://localhost:${PORT}/api/products`);
    });
  } catch (err) {
    console.error("[server] Failed to start:", err.message);
    process.exit(1);
  }
}

start();
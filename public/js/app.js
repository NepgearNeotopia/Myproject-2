/* Inventory Management System - Frontend */
"use strict";

/* ---------- State ---------- */
const state = {
    products: [],
    categories: [],
    filters: { search: "", category: "", lowStockOnly: false },
    editingId: null,
    theme: localStorage.getItem("theme") || "light",
};

/* ---------- DOM helpers ---------- */
const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
};

/* ---------- Theme ---------- */
function applyTheme() {
    document.documentElement.setAttribute("data-theme", state.theme);
    $("themeToggle").textContent = state.theme === "dark" ? "☀️" : "🌙";
    localStorage.setItem("theme", state.theme);
}
$("themeToggle").addEventListener("click", () => {
    state.theme = state.theme === "dark" ? "light" : "dark";
    applyTheme();
});

/* ---------- Toast ---------- */
let toastTimer = null;
function toast(message, type = "success") {
    const t = $("toast");
    t.textContent = message;
    t.className = "toast " + type;
    t.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add("hidden"), 2600);
}

/* ---------- API helpers ---------- */
async function api(path, opts = {}) {
    const res = await fetch("/api/products" + path, {
        headers: { "Content-Type": "application/json" },
        ...opts,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        throw new Error(data.error || (data.details ? JSON.stringify(data.details) : `HTTP ${res.status}`));
    }
    return data;
}

/* ---------- Formatting ---------- */
const fmtDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
};
const fmtMoney = (n) => "฿" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ---------- Stats ---------- */
async function loadStats() {
    try {
        const { data } = await api("/stats");
        $("statTotal").textContent = state.products.length;
        $("statLowStock").textContent = data.lowStock;
        const value = state.products.reduce((s, p) => s + (p.quantity || 0) * (p.price || 0), 0);
        $("statValue").textContent = fmtMoney(value);
    } catch (e) {
        console.warn("stats load failed", e);
    }
}

/* ---------- Load products ---------- */
async function loadProducts() {
    try {
        const { data } = await api("?" + new URLSearchParams({
            search: state.filters.search,
            category: state.filters.category,
            lowStockOnly: state.filters.lowStockOnly ? "true" : "false",
        }));
        state.products = data;
        renderTable();
        await loadStats();
    } catch (e) {
        toast("Failed to load products: " + e.message, "error");
    }
}

/* ---------- Render ---------- */
function renderTable() {
    const body = $("productBody");
    const empty = $("emptyState");
    if (state.products.length === 0) {
        body.innerHTML = `<tr><td colspan="9" class="empty">No products found.</td></tr>`;
        empty.classList.add("hidden");
        return;
    }
    empty.classList.add("hidden");
    body.innerHTML = state.products.map((p) => {
        const low = p.is_low_stock || p.quantity <= p.low_stock_threshold;
        const badge = low
            ? `<span class="badge badge-low">Low Stock</span>`
            : `<span class="badge badge-ok">OK</span>`;
        return `
      <tr>
        <td data-label="Code"><code>${escapeHtml(p.product_code)}</code></td>
        <td data-label="Name">${escapeHtml(p.name)}</td>
        <td data-label="Category">${escapeHtml(p.category)}</td>
        <td data-label="Qty" class="num">${p.quantity}</td>
        <td data-label="Price" class="num">${fmtMoney(p.price)}</td>
        <td data-label="Threshold" class="num">${p.low_stock_threshold}</td>
        <td data-label="Status">${badge}</td>
        <td data-label="Created">${fmtDate(p.created_at)}</td>
        <td data-label="Action" class="num">
          <button class="action-btn edit" data-id="${p.id}" type="button">Edit</button>
          <button class="action-btn delete" data-id="${p.id}" type="button">Delete</button>
        </td>
      </tr>`;
    }).join("");

    body.querySelectorAll(".action-btn.edit").forEach((b) =>
        b.addEventListener("click", () => startEdit(Number(b.dataset.id)))
    );
    body.querySelectorAll(".action-btn.delete").forEach((b) =>
        b.addEventListener("click", () => deleteProduct(Number(b.dataset.id)))
    );
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
    );
}

/* ---------- Category filter options ---------- */
async function loadCategories() {
    try {
        const { data } = await api("");
        const cats = new Set();
        data.forEach((p) => cats.add(p.category));
        state.categories = [...cats].sort();
        const sel = $("categoryFilter");
        const current = sel.value;
        sel.innerHTML = `<option value="">All categories</option>` +
            state.categories.map((c) => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join("");
        sel.value = current;
    } catch (e) {
        console.warn("category load failed", e);
    }
}

function escapeAttr(s) {
    return String(s).replace(/"/g, "&quot;");
}

/* ---------- Toolbar events ---------- */
$("searchInput").addEventListener("input", (e) => {
    state.filters.search = e.target.value.trim();
    loadProducts();
});
$("categoryFilter").addEventListener("change", (e) => {
    state.filters.category = e.target.value;
    loadProducts();
});
$("lowStockFilter").addEventListener("change", (e) => {
    state.filters.lowStockOnly = e.target.checked;
    loadProducts();
});
$("addBtn").addEventListener("click", () => openModal(null));

/* ---------- Table actions ---------- */
function startEdit(id) {
    const p = state.products.find((x) => x.id === id);
    if (!p) return;
    openModal(p);
}

async function deleteProduct(id) {
    const p = state.products.find((x) => x.id === id);
    const name = p ? p.product_code : id;
    if (!confirm(`Delete product "${name}"? This cannot be undone.`)) return;
    try {
        await api("/" + id, { method: "DELETE" });
        toast("Product deleted");
        await loadProducts();
        await loadCategories();
    } catch (e) {
        toast("Delete failed: " + e.message, "error");
    }
}

/* ---------- Modal ---------- */
function openModal(product) {
    const form = $("productForm");
    form.reset();
    $("formError").classList.add("hidden");
    clearFieldErrors();
    if (product) {
        state.editingId = product.id;
        $("modalTitle").textContent = "Edit Product";
        $("productId").value = product.id;
        $("product_code").value = product.product_code;
        $("name").value = product.name;
        $("category").value = product.category;
        $("quantity").value = product.quantity;
        $("price").value = product.price;
        $("low_stock_threshold").value = product.low_stock_threshold;
    } else {
        state.editingId = null;
        $("modalTitle").textContent = "Add Product";
        $("low_stock_threshold").value = 10;
    }
    populateCategoryOptions();
    $("modal").classList.remove("hidden");
}

function closeModal() {
    $("modal").classList.add("hidden");
    state.editingId = null;
}

function populateCategoryOptions() {
    const sel = $("category");
    const current = sel.value;
    const options = [
        "Electronics", "Stationery", "Food & Beverage", "Clothing",
        "Home & Kitchen", "Sports", "Other",
    ];
    sel.innerHTML = options.map((c) => `<option value="${escapeAttr(c)}">${escapeHtml(c)}</option>`).join("");
    if (current && options.includes(current)) sel.value = current;
}

$("closeModal").addEventListener("click", closeModal);
$("cancelBtn").addEventListener("click", closeModal);
$("modal").addEventListener("click", (e) => {
    if (e.target.id === "modal") closeModal();
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("modal").classList.contains("hidden")) closeModal();
});

/* ---------- Form submit ---------- */
$("productForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    clearFieldErrors();
    $("formError").classList.add("hidden");

    const body = {
        product_code: $("product_code").value.trim(),
        name: $("name").value.trim(),
        category: $("category").value.trim(),
        quantity: Number($("quantity").value),
        price: Number($("price").value),
        low_stock_threshold: Number($("low_stock_threshold").value),
    };

    // Client-side validation
    let ok = true;
    if (!body.product_code) { showFieldError("product_code", "Product code is required"); ok = false; }
    if (!body.name) { showFieldError("name", "Name is required"); ok = false; }
    if (!body.category) { showFieldError("category", "Category is required"); ok = false; }
    if (!Number.isInteger(body.quantity) || body.quantity < 0) { showFieldError("quantity", "Quantity must be a non-negative integer"); ok = false; }
    if (!Number.isFinite(body.price) || body.price < 0) { showFieldError("price", "Price must be a non-negative number"); ok = false; }
    if (!Number.isInteger(body.low_stock_threshold) || body.low_stock_threshold < 0) { showFieldError("low_stock_threshold", "Threshold must be a non-negative integer"); ok = false; }
    if (!ok) return;

    try {
        if (state.editingId) {
            await api("/" + state.editingId, { method: "PUT", body: JSON.stringify(body) });
            toast("Product updated");
        } else {
            await api("", { method: "POST", body: JSON.stringify(body) });
            toast("Product created");
        }
        closeModal();
        await loadProducts();
        await loadCategories();
    } catch (err) {
        const msg = err.message;
        if (msg.toLowerCase().includes("already exists")) {
            showFieldError("product_code", "This product code already exists");
        }
        $("formError").textContent = msg;
        $("formError").classList.remove("hidden");
    }
});

function showFieldError(name, msg) {
    const span = document.querySelector(`.field-error[data-for="${name}"]`);
    if (span) span.textContent = msg;
}
function clearFieldErrors() {
    document.querySelectorAll(".field-error").forEach((s) => (s.textContent = ""));
}

/* ---------- Seed sample data ---------- */
$("seedBtn").addEventListener("click", async () => {
    if (!confirm("Add sample products to the inventory? Existing products will not be removed.")) return;
    const samples = [
        { product_code: "ITM-0001", name: "Wireless Mouse", category: "Electronics", quantity: 120, price: 350.00, low_stock_threshold: 20 },
        { product_code: "ITM-0002", name: "A4 Paper 80gsm", category: "Stationery", quantity: 8, price: 45.00, low_stock_threshold: 20 },
        { product_code: "ITM-0003", name: "Green Tea 500g", category: "Food & Beverage", quantity: 45, price: 120.00, low_stock_threshold: 15 },
        { product_code: "ITM-0004", name: "Cotton T-Shirt M", category: "Clothing", quantity: 0, price: 290.00, low_stock_threshold: 10 },
        { product_code: "ITM-0005", name: "Non-Stick Pan 24cm", category: "Home & Kitchen", quantity: 32, price: 550.00, low_stock_threshold: 10 },
        { product_code: "ITM-0006", name: "Yoga Mat", category: "Sports", quantity: 15, price: 420.00, low_stock_threshold: 10 },
        { product_code: "ITM-0007", name: "USB-C Cable 1m", category: "Electronics", quantity: 3, price: 99.00, low_stock_threshold: 25 },
        { product_code: "ITM-0008", name: "Ballpoint Pen Blue", category: "Stationery", quantity: 200, price: 8.00, low_stock_threshold: 50 },
    ];
    let added = 0;
    for (const s of samples) {
        try {
            await api("", { method: "POST", body: JSON.stringify(s) });
            added++;
        } catch (e) {
            if (!e.message.toLowerCase().includes("already exists")) {
                toast("Seed failed: " + e.message, "error");
                break;
            }
        }
    }
    toast(`Seeded ${added} products`);
    await loadProducts();
    await loadCategories();
});

/* ---------- Init ---------- */
async function init() {
    applyTheme();
    await loadCategories();
    await loadProducts();
}
init();
// ==========================================================
// NJ Mart - Config + API Helpers (Expanded Full Version)
// ==========================================================

// 🔗 Google Apps Script Web App URL (backend connector)
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx3fv5CST1x6LSO5PDDOtRCQaQcON99FiKPrNETBLQBQXWmeuI8SXlOKmyLNpDwLqem/exec";

// ===================
// Branding & Settings
// ===================
const APP_NAME = "NJ Mart";
const SUPPORT_PHONE = "+91 70629 18607";
const SUPPORT_EMAIL = "support@njmart.example";

const DELIVERY_CHARGE = 25;
const FREE_DELIVERY_THRESHOLD = 499;
const MIN_ORDER_VALUE = 100;

// ===================
// Helper Functions
// ===================

// GET request
async function apiGet(params = {}) {
  try {
    const url = new URL(SCRIPT_URL);
    Object.keys(params).forEach(k => url.searchParams.append(k, params[k]));
    const res = await fetch(url, { method: "GET" });
    return res.json();
  } catch (err) {
    console.error("GET error:", err);
    return { ok: false, error: err.message };
  }
}

// POST request
async function apiPost(bodyObj = {}) {
  try {
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(bodyObj),
      headers: { "Content-Type": "application/json" }
    });
    return res.json();
  } catch (err) {
    console.error("POST error:", err);
    return { ok: false, error: err.message };
  }
}

// ===================
// API Wrappers
// ===================

// Products
async function getProducts() { return apiGet({ type: "getProducts" }); }
async function updateProductStock(id, stock) {
  return apiPost({ type: "updateProductStock", id, stock });
}

// Customers
async function getCustomers() { return apiGet({ type: "getCustomers" }); }
async function addCustomer(customer) {
  return apiPost({ type: "addCustomer", customer });
}

// Orders
async function getOrders(customerId) {
  return apiGet({ type: "getOrders", customerId });
}
async function addOrder(order) {
  return apiPost({ type: "addOrder", order });
}

// Settings
async function getSettings() { return apiGet({ type: "getSettings" }); }

// ===================
// Local Storage Helpers
// ===================
function loadCart() {
  try { return JSON.parse(localStorage.getItem("nj_cart") || "[]"); }
  catch (e) { return []; }
}
function saveCart(cart) { localStorage.setItem("nj_cart", JSON.stringify(cart)); }
function clearCart() { localStorage.removeItem("nj_cart"); }

function saveCustomerLocal(customer) {
  localStorage.setItem("nj_customer", JSON.stringify(customer));
}
function loadCustomerLocal() {
  try { return JSON.parse(localStorage.getItem("nj_customer") || "{}"); }
  catch (e) { return {}; }
}
function clearCustomerLocal() { localStorage.removeItem("nj_customer"); }

// Checkout data
function saveCheckout(data) {
  localStorage.setItem("nj_checkout", JSON.stringify(data));
}
function loadCheckout() {
  try { return JSON.parse(localStorage.getItem("nj_checkout") || "{}"); }
  catch (e) { return {}; }
}
function clearCheckout() { localStorage.removeItem("nj_checkout"); }

// ===================
// Utility Functions
// ===================
function formatPrice(num) {
  return "₹" + (Number(num) || 0).toFixed(0);
}

function showToast(text, ms = 1500) {
  const t = document.createElement("div");
  t.textContent = text;
  t.style.position = "fixed";
  t.style.left = "50%";
  t.style.top = "20px";
  t.style.transform = "translateX(-50%)";
  t.style.background = "rgba(0,0,0,0.8)";
  t.style.color = "white";
  t.style.padding = "10px 20px";
  t.style.borderRadius = "6px";
  t.style.fontSize = "14px";
  t.style.zIndex = "9999";
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

// ===================
// Export to window
// ===================
window.NJAPI = {
  // products
  getProducts,
  updateProductStock,
  // customers
  getCustomers,
  addCustomer,
  // orders
  getOrders,
  addOrder,
  // settings
  getSettings,
  // local
  loadCart,
  saveCart,
  clearCart,
  saveCustomerLocal,
  loadCustomerLocal,
  clearCustomerLocal,
  saveCheckout,
  loadCheckout,
  clearCheckout,
  // helpers
  formatPrice,
  showToast
};

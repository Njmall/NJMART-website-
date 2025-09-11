/**
 * script-config.js
 * Expanded, production-ready client helper for NJ Mart frontend → Google Apps Script backend
 * 
 * Replace WEBAPP_URL with your deployed Apps Script webapp '/exec' URL (already replaced below)
 * If using a key parameter in webapp, set API_KEY accordingly (else leave empty)
 */

const WEBAPP_URL = "https://script.google.com/macros/s/AKfycbxL4jW3HF4bjBHf4sao6o263Hy1wL6j8rJKF6xgdBx9OSAiF8V0lg545dptJlGynJU7/exec";
const API_KEY = ""; // If your Apps Script expects a key param, set here

/* ====== Utility Helpers ====== */

function buildUrl(action, params = {}) {
  const url = new URL(WEBAPP_URL);
  url.searchParams.set("action", action);
  if (API_KEY) url.searchParams.set("key", API_KEY);
  Object.keys(params).forEach(k => {
    if (params[k] !== undefined && params[k] !== null) {
      url.searchParams.set(k, params[k]);
    }
  });
  return url.toString();
}

function wait(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function fetchWithTimeout(resource, options = {}, timeout = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const resp = await fetch(resource, { signal: controller.signal, ...options });
    clearTimeout(id);
    return resp;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function apiFetch(action, { method = "GET", payload = null, params = {}, retries = 2, timeout = 15000 } = {}) {
  const url = buildUrl(action, params);
  let attempt = 0;
  while (attempt <= retries) {
    try {
      const options = { method, headers: { "Accept": "application/json" } };
      if (method === "POST") {
        options.headers["Content-Type"] = "application/json;charset=utf-8";
        options.body = JSON.stringify(payload || {});
      }
      const resp = await fetchWithTimeout(url, options, timeout);
      if (!resp.ok) {
        const text = await resp.text().catch(()=>"");
        throw new Error(`HTTP ${resp.status}: ${resp.statusText} - ${text}`);
      }
      const text = await resp.text();
      try {
        const data = JSON.parse(text);
        return data;
      } catch (errJson) {
        return text;
      }
    } catch (err) {
      if (attempt < retries) {
        console.warn(`[apiFetch] action=${action} attempt=${attempt} failed: ${err.message}. retrying...`);
        await wait(300 + attempt * 500);
        attempt++;
        continue;
      }
      console.error(`[apiFetch] final failure action=${action}:`, err);
      throw err;
    }
  }
}

/* ====== High-Level API Functions ====== */

async function getProducts({ category = "", q = "", limit = 1000 } = {}) {
  return await apiFetch("getProducts", { method: "GET", params: { category, q, limit } });
}

async function getProductById(id) {
  if (!id) throw new Error("getProductById: id required");
  return await apiFetch("getProduct", { method: "GET", params: { id } });
}

async function addProduct(product) {
  if (!product || !product.id) throw new Error("addProduct: product.id required");
  return await apiFetch("addProduct", { method: "POST", payload: { product } });
}

async function updateProduct(product) {
  if (!product || !product.id) throw new Error("updateProduct: product.id required");
  return await apiFetch("updateProduct", { method: "POST", payload: { product } });
}

async function removeProduct(id) {
  if (!id) throw new Error("removeProduct: id required");
  return await apiFetch("removeProduct", { method: "POST", payload: { id } });
}

async function getCustomers({ q = "", limit = 1000 } = {}) {
  return await apiFetch("getCustomers", { method: "GET", params: { q, limit } });
}

async function getCustomerById(id) {
  if (!id) throw new Error("getCustomerById: id required");
  return await apiFetch("getCustomer", { method: "GET", params: { id } });
}

async function addCustomer(customer) {
  if (!customer || !customer.id) throw new Error("addCustomer: customer.id required");
  return await apiFetch("addCustomer", { method: "POST", payload: { customer } });
}

async function getOrders({ status = "", q = "", limit = 1000 } = {}) {
  return await apiFetch("getOrders", { method: "GET", params: { status, q, limit } });
}

async function getOrderById(orderId) {
  if (!orderId) throw new Error("getOrderById: orderId required");
  return await apiFetch("getOrder", { method: "GET", params: { orderId } });
}

async function addOrder(order) {
  if (!order || !Array.isArray(order.items) || order.items.length === 0) {
    throw new Error("addOrder: order.items required");
  }
  return await apiFetch("addOrder", { method: "POST", payload: { order } });
}

async function updateOrderStatus(orderId, status) {
  if (!orderId) throw new Error("updateOrderStatus: orderId required");
  if (!status) throw new Error("updateOrderStatus: status required");
  return await apiFetch("updateOrderStatus", { method: "POST", payload: { orderId, status } });
}

async function getStaff({ limit = 100 } = {}) {
  return await apiFetch("getStaff", { method: "GET", params: { limit } });
}

async function getCoupons({ q = "", limit = 100 } = {}) {
  return await apiFetch("getCoupons", { method: "GET", params: { q, limit } });
}

async function validateCoupon(code, orderTotal = 0) {
  if (!code) throw new Error("validateCoupon: code required");
  return await apiFetch("validateCoupon", { method: "GET", params: { code, orderTotal } });
}

async function getSettings() {
  return await apiFetch("getSettings", { method: "GET" });
}

async function updateSettings(settingsObj) {
  return await apiFetch("updateSettings", { method: "POST", payload: { settings: settingsObj } });
}

async function getReports({ type = "orders", from = "", to = "" } = {}) {
  return await apiFetch("getReports", { method: "GET", params: { type, from, to } });
}

async function pingBackend() {
  return await apiFetch("ping", { method: "GET" });
}

function friendlyError(err) {
  console.error(err);
  const msg = (err && err.message) ? err.message : String(err);
  return `Server error: ${msg}`;
}

/* ====== Expose to window ====== */
window.NJ_API = {
  // Utilities
  pingBackend,
  getSettings,
  updateSettings,
  getReports,
  
  // Products
  getProducts,
  getProductById,
  addProduct,
  updateProduct,
  removeProduct,
  
  // Customers
  getCustomers,
  getCustomerById,
  addCustomer,
  
  // Orders
  getOrders,
  getOrderById,
  addOrder,
  updateOrderStatus,
  
  // Staff / Coupons
  getStaff,
  getCoupons,
  validateCoupon,
  
  // Lower-level
  apiFetch,
  buildUrl
};

// ========== NJ Mart — script-config.js ==========
// Client-side connector between frontend and Google Apps Script backend
// All API calls, storage helpers, and utilities included
// Backend URL (fixed, do not change)
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbwsG5H7er3nqwGjEbrtokssc5LeGFc9Zog2bG1s0C5bQ-P2b_1S1kisSLpOmdESH7FB/exec";

// ========== Generic API Helpers ==========
async function apiGet(action) {
  try {
    const url = `${BACKEND_URL}?action=${encodeURIComponent(action)}`;
    const res = await fetch(url);
    return await res.json();
  } catch (err) {
    console.error("GET error", err);
    return { ok: false, error: String(err) };
  }
}

async function apiPost(data) {
  try {
    const res = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch (err) {
    console.error("POST error", err);
    return { ok: false, error: String(err) };
  }
}

// ========== Products ==========
async function fetchProducts() {
  const res = await apiGet("products");
  if (res.ok) return res.products || [];
  return [];
}

async function addProduct(product) {
  const payload = { action: "addproduct", ...product };
  return await apiPost(payload);
}

// ========== Customers ==========
async function fetchCustomers() {
  const res = await apiGet("customers");
  if (res.ok) return res.customers || [];
  return [];
}

async function addCustomer(customer) {
  const payload = { action: "addcustomer", ...customer };
  return await apiPost(payload);
}

// ========== Orders ==========
async function fetchOrders() {
  const res = await apiGet("orders");
  if (res.ok) return res.orders || [];
  return [];
}

async function addOrder(order) {
  const payload = { action: "addorder", ...order };
  return await apiPost(payload);
}

// ========== Coupons ==========
async function fetchCoupons() {
  const res = await apiGet("coupons");
  if (res.ok) return res.coupons || [];
  return [];
}

async function validateCoupon(code) {
  const payload = { action: "validatecoupon", code };
  return await apiPost(payload);
}

// ========== Settings ==========
async function fetchSettings() {
  const res = await apiGet("settings");
  if (res.ok) return res.settings || {};
  return {};
}

// ========== Staff ==========
async function fetchStaff() {
  const res = await apiGet("staff");
  if (res.ok) return res.staff || [];
  return [];
}

async function addStaff(staff) {
  const payload = { action: "addstaff", ...staff };
  return await apiPost(payload);
}

// ========== Reports ==========
async function fetchReports() {
  const res = await apiGet("reports");
  if (res.ok) return res.reports || [];
  return [];
}

// ========== LocalStorage Helpers ==========
function saveLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error("saveLocal error", err);
  }
}

function loadLocal(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "null");
  } catch {
    return null;
  }
}

function clearLocal(key) {
  localStorage.removeItem(key);
}

// ========== Cart Helpers ==========
const CART_KEY = "nj_cart";

function getCart() {
  return loadLocal(CART_KEY) || [];
}

function saveCart(cart) {
  saveLocal(CART_KEY, cart);
}

function clearCart() {
  clearLocal(CART_KEY);
}

function addToCart(item) {
  const cart = getCart();
  const idx = cart.findIndex((x) => x.ProductID === item.ProductID);
  if (idx > -1) {
    cart[idx].Quantity += 1;
  } else {
    cart.push({ ...item, Quantity: 1 });
  }
  saveCart(cart);
  return cart;
}

function updateCartItem(id, qty) {
  const cart = getCart();
  const idx = cart.findIndex((x) => x.ProductID === id);
  if (idx > -1) {
    cart[idx].Quantity = qty;
  }
  saveCart(cart);
  return cart;
}

function removeFromCart(id) {
  let cart = getCart();
  cart = cart.filter((x) => x.ProductID !== id);
  saveCart(cart);
  return cart;
}

function calcCartTotals() {
  const cart = getCart();
  let subtotal = 0;
  cart.forEach((i) => {
    subtotal += (Number(i.Price) || 0) * (Number(i.Quantity) || 1);
  });
  const delivery = subtotal >= 499 || subtotal === 0 ? 0 : 20;
  return {
    subtotal,
    delivery,
    total: subtotal + delivery,
  };
}

// ========== Account / Session ==========
const USER_KEY = "nj_user";

function getUser() {
  return loadLocal(USER_KEY);
}

function saveUser(user) {
  saveLocal(USER_KEY, user);
}

function clearUser() {
  clearLocal(USER_KEY);
}

// ========== UI Helpers ==========
function toast(msg, time = 2000) {
  const el = document.createElement("div");
  el.textContent = msg;
  el.style.position = "fixed";
  el.style.bottom = "20px";
  el.style.left = "50%";
  el.style.transform = "translateX(-50%)";
  el.style.background = "#2db34a";
  el.style.color = "#fff";
  el.style.padding = "10px 18px";
  el.style.borderRadius = "8px";
  el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
  el.style.zIndex = 9999;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), time);
}

// ========== Example Usage Bindings ==========
document.addEventListener("DOMContentLoaded", async () => {
  console.log("NJ Mart config loaded");

  // auto-load settings
  const settings = await fetchSettings();
  console.log("Settings:", settings);

  // update header cart count
  const cart = getCart();
  const count = cart.reduce((s, i) => s + (i.Quantity || 0), 0);
  const cartBadge = document.getElementById("headerCartCount");
  if (cartBadge) cartBadge.textContent = count;
});

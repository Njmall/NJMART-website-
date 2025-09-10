/* app.js — NJ Mart full app logic */

/* ---------------- GLOBAL CONFIG ---------------- */
const API_URL = typeof SCRIPT_URL !== "undefined" ? SCRIPT_URL : "";

/* ---------------- UTILITIES ---------------- */
function loadCart() {
  try {
    return JSON.parse(localStorage.getItem("nj_cart")) || [];
  } catch {
    return [];
  }
}
function saveCart(cart) {
  localStorage.setItem("nj_cart", JSON.stringify(cart));
  updateCartCount();
}
function updateCartCount() {
  const cart = loadCart();
  const count = cart.reduce((s, i) => s + i.qty, 0);
  const el = document.getElementById("cartCount");
  if (el) el.textContent = count;
}

/* ---------------- PRODUCTS ---------------- */
async function loadProducts() {
  if (!API_URL) {
    console.warn("⚠️ API_URL missing");
    return;
  }
  try {
    const res = await fetch(API_URL + "?action=getProducts");
    const data = await res.json();
    renderProducts(data);
  } catch (err) {
    console.error("Error loading products:", err);
  }
}

function renderProducts(products) {
  const container = document.getElementById("productList");
  if (!container) return;
  container.innerHTML = "";
  if (!products || products.length === 0) {
    container.innerHTML = `<p style="text-align:center;color:#777;">No products found</p>`;
    return;
  }

  products.forEach(p => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <img src="${p.image}" alt="${p.name}">
      <h3>${p.name}</h3>
      <p>₹${p.price}</p>
      <button onclick="addToCart('${p.id}','${p.name}',${p.price},'${p.image}')">Add to Cart</button>
    `;
    container.appendChild(card);
  });
}

/* ---------------- CART ---------------- */
function addToCart(id, name, price, image) {
  const cart = loadCart();
  const idx = cart.findIndex(x => x.id === id);
  if (idx > -1) {
    cart[idx].qty++;
  } else {
    cart.push({ id, name, price, qty: 1, image });
  }
  saveCart(cart);
  alert("🛒 " + name + " added to cart");
}

function clearCart() {
  if (confirm("Clear all items from cart?")) {
    localStorage.removeItem("nj_cart");
    updateCartCount();
  }
}

/* ---------------- LOGIN ---------------- */
function goLogin() {
  location.href = "login.html";
}

function logout() {
  localStorage.removeItem("nj_user");
  updateUserUI();
  location.href = "index.html";
}

function updateUserUI() {
  const user = JSON.parse(localStorage.getItem("nj_user") || "null");
  const loginBtn = document.getElementById("loginBtn");
  const profileLink = document.getElementById("profileLink");
  const logoutBtn = document.getElementById("logoutBtn");

  if (user) {
    if (loginBtn) loginBtn.style.display = "none";
    if (profileLink) profileLink.style.display = "inline-block";
    if (logoutBtn) logoutBtn.style.display = "inline-block";
  } else {
    if (loginBtn) loginBtn.style.display = "inline-block";
    if (profileLink) profileLink.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "none";
  }
}

/* ---------------- CHECKOUT ---------------- */
function goCheckout() {
  const cart = loadCart();
  if (cart.length === 0) {
    alert("Your cart is empty!");
    return;
  }
  localStorage.setItem("nj_checkout", JSON.stringify(cart));
  location.href = "checkout.html";
}

/* ---------------- ON LOAD ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  updateCartCount();
  updateUserUI();

  // Auto-load products if productList container exists
  if (document.getElementById("productList")) {
    loadProducts();
  }

  // Search filter
  const searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const term = searchInput.value.toLowerCase();
      document.querySelectorAll("#productList .product-card").forEach(card => {
        const name = card.querySelector("h3").textContent.toLowerCase();
        card.style.display = name.includes(term) ? "" : "none";
      });
    });
  }
});

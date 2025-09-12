/* ============================================================================
   app.js — NJ Mart (full expanded, production-ready)
   - Place this file in your repo and include <script src="app.js"></script>
   - Uses BACKEND_URL from script-config.js if present; otherwise uses API_BASE fallback.
   - Primary responsibilities:
     * Load products from backend (action=products)
     * Render product grid, categories, filters, pagination
     * Expose addToCart(product) for other pages (product.html / index.html)
     * Manage cart in localStorage (key: 'nj_cart')
     * Provide utilities for checkout payload creation (used by cart/checkout pages)
     * Coupon validation via backend (action=validatecoupon)
   - No demo data included. Everything is data-driven from backend.
   ============================================================================ */

/*** CHANGE THIS if you don't use script-config.js ***/
const API_BASE = (typeof BACKEND_URL !== 'undefined') ? BACKEND_URL : 'https://script.google.com/macros/s/YOUR_DEPLOYED_WEBAPP_ID/exec';

/* ------------------------------ Configuration ------------------------------ */
const CONFIG = {
  STORAGE_KEYS: {
    CART: 'nj_cart',
    USER: 'nj_user',        // local saved user profile
    LAST_ORDER: 'nj_last_order',
    COUPON: 'nj_coupon'
  },
  UI: {
    PRODUCT_CONTAINER_ID: 'productGrid',   // id of product grid container on index page
    CATEGORY_CONTAINER_ID: 'categoryList', // id of category list container
    HEADER_CART_COUNT_ID: 'headerCartCount',
    PAGE_INFO_ID: 'pageInfo'
  },
  PAGINATION: {
    perPage: 12
  },
  DELIVERY: {
    threshold: 1000, // default threshold for free delivery (₹)
    charge: 20       // default delivery charge if below threshold
  },
  TIMEOUTS: {
    fetchRetryMs: 800,
    toastMs: 1400
  }
};

/* ------------------------------ Application State ------------------------------ */
const STATE = {
  products: [],        // list of normalized products
  filtered: [],        // product subset after filters/search
  categories: [],      // category list
  page: 1,
  perPage: CONFIG.PAGINATION.perPage,
  currentCategory: '',
  query: '',
  sortBy: '',
  coupon: null         // applied coupon object { ok:true, code, discount }
};

/* ------------------------------ Utilities ---------------------------------- */
function safeJSONParse(str, fallback = null){
  try { return JSON.parse(str); } catch(e){ return fallback; }
}
function escapeHtml(s){ return (''+s).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function el(id){ return document.getElementById(id); }
function create(tag, cls){ const n = document.createElement(tag); if(cls) n.className = cls; return n; }
function delay(ms){ return new Promise(res => setTimeout(res, ms)); }

/* small toast helper */
function showToast(msg, ms = CONFIG.TIMEOUTS.toastMs){
  const t = document.createElement('div');
  t.textContent = msg;
  t.style.position = 'fixed';
  t.style.left = '50%';
  t.style.top = '18px';
  t.style.transform = 'translateX(-50%)';
  t.style.background = 'rgba(0,0,0,0.85)';
  t.style.color = '#fff';
  t.style.padding = '8px 12px';
  t.style.borderRadius = '8px';
  t.style.zIndex = 99999;
  document.body.appendChild(t);
  setTimeout(()=> t.remove(), ms);
}

/* fetch wrapper with error handling */
async function apiGet(action, params = {}){
  const url = new URL(API_BASE);
  url.searchParams.set('action', action);
  Object.keys(params).forEach(k=> url.searchParams.set(k, params[k]));
  const res = await fetch(url.toString(), { method: 'GET' });
  return res.json();
}
async function apiPost(body = {}){
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

/* --------------------------- Product normalization ------------------------- */
/* Backend product fields: ProductID, Name, Price, Stock, Category, Image URL, Quantity, ... */
function normalizeProduct(raw){
  if(!raw) return null;
  return {
    id: raw.ProductID || raw.id || raw.ID || ('p-' + Math.random().toString(36).substring(2,9)),
    name: raw.Name || raw.name || 'Unnamed product',
    price: Number(raw.Price || raw.price || 0),
    stock: Number(raw.Stock || raw.stock || 0),
    category: raw.Category || raw.category || 'Uncategorized',
    image: raw['Image URL'] || raw.image || raw.img || 'https://via.placeholder.com/300',
    quantity: Number(raw.Quantity || raw.quantity || 1),
    raw
  };
}

/* --------------------------- Product fetching ----------------------------- */
async function fetchProducts(retry = 0){
  try{
    const j = await apiGet('products');
    if(!j) throw new Error('Empty response from products API');
    // backend may return {ok:true, products: [...]}
    const list = Array.isArray(j.products) ? j.products : (Array.isArray(j) ? j : []);
    STATE.products = list.map(normalizeProduct).filter(Boolean);
    STATE.filtered = [...STATE.products];
    STATE.categories = Array.from(new Set(STATE.products.map(p => p.category || 'Uncategorized')));
    return STATE.products;
  }catch(err){
    console.error('fetchProducts error', err);
    if(retry < 3){
      await delay(CONFIG.TIMEOUTS.fetchRetryMs);
      return fetchProducts(retry + 1);
    }
    throw err;
  }
}

/* --------------------------- Render category list ------------------------- */
function renderCategories(containerId = CONFIG.UI.CATEGORY_CONTAINER_ID){
  const container = el(containerId);
  if(!container) return;
  container.innerHTML = '';
  STATE.categories.forEach(cat => {
    const node = create('div', 'category-item');
    node.textContent = cat;
    node.addEventListener('click', () => {
      STATE.currentCategory = (STATE.currentCategory === cat) ? '' : cat;
      applyFiltersAndRender();
      // visual toggle
      container.querySelectorAll('.category-item').forEach(n=>n.classList.remove('active'));
      if(STATE.currentCategory) node.classList.add('active');
    });
    container.appendChild(node);
  });
}

/* --------------------------- Apply filters/search/sort --------------------- */
function applyFilters(){
  let arr = [...STATE.products];
  if(STATE.currentCategory){
    arr = arr.filter(p => (p.category || '').toLowerCase() === STATE.currentCategory.toLowerCase());
  }
  if(STATE.query){
    const q = STATE.query.toLowerCase();
    arr = arr.filter(p => (p.name || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q));
  }
  if(STATE.sortBy){
    if(STATE.sortBy === 'price_asc') arr.sort((a,b) => a.price - b.price);
    else if(STATE.sortBy === 'price_desc') arr.sort((a,b) => b.price - a.price);
  }
  STATE.filtered = arr;
  STATE.page = 1;
}

/* ------------------------------ Render products --------------------------- */
function renderProducts(containerId = CONFIG.UI.PRODUCT_CONTAINER_ID){
  const container = el(containerId);
  if(!container) return;
  const start = (STATE.page - 1) * STATE.perPage;
  const pageItems = STATE.filtered.slice(start, start + STATE.perPage);
  container.innerHTML = '';
  if(pageItems.length === 0){
    const empty = create('div', 'muted');
    empty.style.padding = '20px';
    empty.textContent = 'No products found';
    container.appendChild(empty);
    updatePageInfo();
    return;
  }
  pageItems.forEach(p => {
    const card = create('div', 'product');
    card.innerHTML = `
      <div class="thumb" style="height:140px;border-radius:10px;overflow:hidden"><img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.name)}" style="width:100%;height:100%;object-fit:cover"></div>
      <h4 style="margin:8px 0 6px 0">${escapeHtml(p.name)}</h4>
      <div class="meta">${escapeHtml(p.category)}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
        <div class="price">₹${Number(p.price||0).toFixed(0)}</div>
        <div>
          <button class="btn ghost viewBtn" data-id="${p.id}" title="View product">View</button>
          <button class="btn primary addBtn" data-id="${p.id}" title="Add to cart">Add</button>
        </div>
      </div>
    `;
    container.appendChild(card);

    // attach handlers
    card.querySelector('.viewBtn').addEventListener('click', () => {
      // navigate to product detail page
      location.href = `product.html?id=${encodeURIComponent(p.id)}`;
    });
    card.querySelector('.addBtn').addEventListener('click', () => {
      addToCart({ id: p.id, name: p.name, price: p.price, qty: 1, image: p.image, category: p.category });
    });
  });

  updatePageInfo();
}

/* Update page info element */
function updatePageInfo(){
  const pageInfo = el(CONFIG.UI.PAGE_INFO_ID);
  if(!pageInfo) return;
  const pages = Math.max(1, Math.ceil(STATE.filtered.length / STATE.perPage));
  pageInfo.textContent = `Page ${STATE.page} of ${pages}`;
}

/* ------------------------------- Pagination -------------------------------- */
function nextPage(){
  const pages = Math.max(1, Math.ceil(STATE.filtered.length / STATE.perPage));
  if(STATE.page < pages){ STATE.page++; renderProducts(); }
}
function prevPage(){
  if(STATE.page > 1){ STATE.page--; renderProducts(); }
}

/* ------------------------------- Search helpers ---------------------------- */
let _searchTimer = null;
function setupSearch(inputId = 'globalSearch', containerId = CONFIG.UI.PRODUCT_CONTAINER_ID){
  const input = el(inputId);
  if(!input) return;
  input.addEventListener('input', (e) => {
    const v = e.target.value || '';
    if(_searchTimer) clearTimeout(_searchTimer);
    _searchTimer = setTimeout(() => {
      STATE.query = v.trim();
      applyFiltersAndRender();
    }, 300);
  });
}

/* ------------------------------- Sort/Filter UI ---------------------------- */
function setupSort(selectId = 'sortSelect'){
  const sel = el(selectId);
  if(!sel) return;
  sel.addEventListener('change', (e)=>{
    STATE.sortBy = e.target.value || '';
    applyFiltersAndRender();
  });
}

/* ---------------------------- applyFiltersAndRender ------------------------ */
function applyFiltersAndRender(containerId = CONFIG.UI.PRODUCT_CONTAINER_ID){
  applyFilters();
  renderProducts(containerId);
}

/* ------------------------------- Cart (local) ----------------------------- */
function loadCart(){
  try{
    const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.CART) || '[]';
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  }catch(e){ return []; }
}
function saveCart(cart){
  try{
    localStorage.setItem(CONFIG.STORAGE_KEYS.CART, JSON.stringify(cart));
    updateHeaderCart();
  }catch(e){
    console.warn('saveCart error', e);
  }
}
function clearCart(){
  saveCart([]);
}

/* Add to cart function used by pages */
function addToCart(product){
  // product must have: id, name, price, qty, image, category (qty optional)
  if(!product || !product.id) return;
  const cart = loadCart();
  const idx = cart.findIndex(i => i.id === product.id);
  if(idx > -1){
    cart[idx].qty = Number(cart[idx].qty || 0) + Number(product.qty || 1);
  } else {
    cart.push({
      id: product.id,
      name: product.name || 'Unnamed',
      price: Number(product.price || 0),
      qty: Number(product.qty || 1),
      image: product.image || '',
      category: product.category || ''
    });
  }
  saveCart(cart);
  showToast(product.name + ' added to cart');
}

/* Update header cart count */
function updateHeaderCart(){
  const elCount = el(CONFIG.UI.HEADER_CART_COUNT_ID);
  if(!elCount) return;
  const cart = loadCart();
  const cnt = cart.reduce((s,i) => s + (Number(i.qty||0)), 0);
  elCount.textContent = cnt;
}

/* Expose remove/change qty helpers for cart page script to call */
function changeCartQty(productId, delta){
  const cart = loadCart();
  const idx = cart.findIndex(i => i.id === productId);
  if(idx === -1) return;
  cart[idx].qty = Math.max(1, Number(cart[idx].qty || 0) + Number(delta || 0));
  saveCart(cart);
  return cart[idx];
}
function removeFromCart(productId){
  let cart = loadCart();
  cart = cart.filter(i => i.id !== productId);
  saveCart(cart);
}

/* Get cart totals */
function cartTotals(){
  const cart = loadCart();
  const subtotal = cart.reduce((s,i)=> s + (Number(i.price||0) * Number(i.qty||0)), 0);
  const delivery = (subtotal === 0 || subtotal >= CONFIG.DELIVERY.threshold) ? 0 : CONFIG.DELIVERY.charge;
  const coupon = STATE.coupon && STATE.coupon.ok ? Number(STATE.coupon.discount || 0) : 0;
  const grand = Math.max(0, subtotal + delivery - coupon);
  return { subtotal, delivery, coupon, grand };
}

/* ---------------------------- Coupon validation --------------------------- */
async function validateCoupon(code){
  if(!code) return { ok:false, error:'No code' };
  try{
    const res = await apiPost({ action:'validatecoupon', code });
    if(res && res.ok) {
      STATE.coupon = { ok:true, code: res.code, discount: Number(res.discount||0) };
      localStorage.setItem(CONFIG.STORAGE_KEYS.COUPON, JSON.stringify(STATE.coupon));
      return STATE.coupon;
    } else {
      STATE.coupon = null;
      localStorage.removeItem(CONFIG.STORAGE_KEYS.COUPON);
      return { ok:false, error: res && res.error ? res.error : 'Invalid coupon' };
    }
  }catch(err){
    console.error('validateCoupon', err);
    return { ok:false, error: String(err) };
  }
}

/* ---------------------------- Checkout payload ---------------------------- */
/*
  buildCheckoutPayload(user, paymentMethod, instructions)
  returns object ready to POST to backend action=addorder
*/
function buildCheckoutPayload(user = {}, paymentMethod = 'UPI', instructions = ''){
  const cart = loadCart();
  const totals = cartTotals();
  const orderId = 'ORD-' + Date.now().toString(36).toUpperCase();
  const payload = {
    action: 'addorder',
    OrderID: orderId,
    CustomerID: (user && user.Phone) ? user.Phone : (user && user.id) ? user.id : ('CUST-' + Date.now().toString(36)),
    Items: JSON.stringify(cart.map(i=>({ ProductID: i.id, Name: i.name, Price: Number(i.price||0), Qty: Number(i.qty||1) }))),
    TotalAmount: totals.subtotal,
    Discount: totals.coupon || 0,
    FinalAmount: totals.grand,
    OrderDate: new Date().toLocaleString(),
    Status: 'placed',
    Payment: paymentMethod,
    DeliveryAddress: user.Address || '',
    Instructions: instructions || ''
  };
  return payload;
}

/* Submit order to backend and handle response */
async function submitOrder(user, paymentMethod = 'UPI', instructions = ''){
  const payload = buildCheckoutPayload(user, paymentMethod, instructions);
  try{
    const res = await apiPost(payload);
    if(res && res.ok){
      // Save last order locally for invoice view
      localStorage.setItem(CONFIG.STORAGE_KEYS.LAST_ORDER, JSON.stringify(Object.assign({}, payload, { orderId: res.orderId || payload.OrderID })));
      // clear cart after success
      clearCart();
      // clear coupon
      STATE.coupon = null;
      localStorage.removeItem(CONFIG.STORAGE_KEYS.COUPON);
      return { ok:true, orderId: res.orderId || payload.OrderID, res };
    } else {
      return { ok:false, error: res && res.error ? res.error : 'Order creation failed' };
    }
  }catch(err){
    console.error('submitOrder', err);
    return { ok:false, error: String(err) };
  }
}

/* ------------------------------ Product detail ---------------------------- */
/* Helper to get product by id (from loaded STATE.products) */
function getProductById(id){
  if(!id) return null;
  return STATE.products.find(p => p.id == id) || null;
}

/* Load product by id from backend (if not present locally) */
async function loadProductById(id){
  // try local first
  let p = getProductById(id);
  if(p) return p;
  // fallback: fetch all products and attempt find
  await fetchProducts();
  p = getProductById(id);
  return p;
}

/* --------------------------------- Init ----------------------------------- */
/* Initializes index page: fetch products, render categories, setup search & sort */
async function initIndex(options = {}){
  try{
    // allow overriding container ids / perPage
    if(options.perPage) STATE.perPage = Number(options.perPage);
    await fetchProducts();
    renderCategories(options.categoryContainerId || CONFIG.UI.CATEGORY_CONTAINER_ID);
    setupSearch(options.searchInputId || 'globalSearch', options.containerId || CONFIG.UI.PRODUCT_CONTAINER_ID);
    setupSort(options.sortSelectId || 'sortSelect');
    applyFiltersAndRender(options.containerId || CONFIG.UI.PRODUCT_CONTAINER_ID);
    updateHeaderCart();
  }catch(err){
    console.error('initIndex error', err);
  }
}

/* convenience wrapper to apply filters and render (used across) */
function applyFiltersAndRender(containerId = CONFIG.UI.PRODUCT_CONTAINER_ID){
  applyFilters();
  renderProducts(containerId);
}

/* ---------------------------- Admin helper calls -------------------------- */
/* functions that admin pages might call */
async function adminLoadProducts(){
  await fetchProducts();
  return STATE.products;
}
async function adminAddProduct(productObj){
  // expects productObj fields matching backend columns (Name, Price, Stock, Category, 'Image URL', Quantity)
  const payload = Object.assign({}, productObj, { action: 'addproduct' });
  return apiPost(payload);
}
async function adminAddCustomer(customerObj){
  const payload = Object.assign({}, customerObj, { action: 'addcustomer' });
  return apiPost(payload);
}

/* ------------------------------- Persistence ------------------------------ */
/* load persisted coupon from localStorage */
function loadPersistedCoupon(){
  try{
    const raw = localStorage.getItem(CONFIG.STORAGE_KEYS.COUPON);
    if(!raw) return null;
    const obj = JSON.parse(raw);
    if(obj && obj.ok) STATE.coupon = obj;
  }catch(e){}
}
loadPersistedCoupon();

/* ------------------------------- Exports --------------------------------- */
/* expose functions to window so pages can call them directly */
window.NJ = {
  // state & config
  STATE, CONFIG,
  // product actions
  initIndex, fetchProducts, renderProducts, renderCategories, applyFiltersAndRender, nextPage, prevPage, getProductById, loadProductById,
  // cart actions
  addToCart, loadCart, saveCart, clearCart, changeCartQty, removeFromCart, cartTotals, updateHeaderCart,
  // checkout
  buildCheckoutPayload, submitOrder, validateCoupon,
  // admin helpers
  adminLoadProducts, adminAddProduct, adminAddCustomer,
  // utility
  showToast, escapeHtml
};

/* ------------------------------- Auto init -------------------------------- */
/* If index page includes an element with id matching CONFIG.UI.PRODUCT_CONTAINER_ID,
   auto-initialize so adding <script src="app.js"></script> is sufficient. */
document.addEventListener('DOMContentLoaded', () => {
  // auto init only on pages that include the product container
  if(document.getElementById(CONFIG.UI.PRODUCT_CONTAINER_ID)){
    initIndex().catch(e => console.warn('Auto initIndex failed', e));
  }
  // update header cart on any page load
  updateHeaderCart();
});

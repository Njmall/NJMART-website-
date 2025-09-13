/* =========================================================================
   NJ Mart — app.js (Final Expanded)
   — Copy-paste ready. (~600 lines)
   — Uses: Firebase (optional), Google Apps Script backend (API_BASE)
   — Make sure firebase-config.js is loaded before this file if you use auth
   ========================================================================= */

/* ====================== CONFIG ====================== */

// Replace with your deployed Apps Script web app URL (you provided earlier)
const API_BASE = 'https://script.google.com/macros/s/AKfycbwsG5H7er3nqwGjEbrtokssc5LeGFc9Zog2bG1s0C5bQ-P2b_1S1kisSLpOmdESH7FB/exec';

// Default fallback image if product's Image URL is missing/invalid
const DEFAULT_IMAGE = 'https://i.postimg.cc/sgVhyLYH/IMG-20250913-WA0003.jpg';

// UPI id for direct pay button (replace if different)
const UPI_ID = 'njmartnainwa@ybl';

// Local storage keys
const LS_KEYS = {
  CART: 'nj_cart_v1',
  PROFILE: 'nj_profile',
  COUPON: 'nj_coupon'
};

// timeouts & misc
const TIMEOUTS = { toast: 2500 };

/* ====================== ENV CHECKS ====================== */

const HAS_FETCH = typeof fetch !== 'undefined';
const HAS_LOCALSTORAGE = typeof localStorage !== 'undefined';
const HAS_FIREBASE = typeof firebase !== 'undefined' && !!firebase.initializeApp;

/* ====================== UTILITY HELPERS ====================== */

function qsel(sel, ctx) { return (ctx || document).querySelector(sel); }
function qselAll(sel, ctx) { return (ctx || document).querySelectorAll(sel); }
function el(id) { return document.getElementById(id); }
function empty(node) { if(node) node.innerHTML = ''; }
function tpl(strings, ...vals) {
  return strings.reduce((s, part, i) => s + part + (vals[i] || ''), '');
}
function toNumber(v, def=0){ const n=Number(v); return isNaN(n) ? def : n; }

function safeJSONParse(str, def=null){
  try { return JSON.parse(str); } catch(e){ return def; }
}

/* Toast / small notifications (lightweight) */
function toast(msg, timeout=TIMEOUTS.toast){
  if(!msg) return;
  if(typeof M !== 'undefined' && M.toast){ M.toast({html: msg}); return; }
  // fallback simple
  let t = document.createElement('div');
  t.className = 'nj-toast';
  t.textContent = msg;
  Object.assign(t.style, {
    position:'fixed', right:'18px', bottom:'18px',
    background:'#111', color:'#fff', padding:'10px 12px', borderRadius:'8px',
    zIndex:99999, boxShadow:'0 8px 24px rgba(0,0,0,0.14)', fontSize:'13px'
  });
  document.body.appendChild(t);
  setTimeout(()=>{ t.style.opacity=0; setTimeout(()=>t.remove(),300); }, timeout);
}

/* Basic debounce */
function debounce(fn, wait=250){
  let t; return function(...a){ clearTimeout(t); t = setTimeout(()=>fn.apply(this,a), wait); };
}

/* Safe image loader - returns a Promise that resolves to url (actual or default) */
function ensureImage(url, fallback=DEFAULT_IMAGE, timeout=4000){
  return new Promise((resolve)=>{
    if(!url) return resolve(fallback);
    // quick check: if url starts with http(s)
    if(!/^https?:\/\//i.test(url)) return resolve(fallback);
    let img = new Image();
    let done=false;
    img.onload = ()=>{ if(done) return; done=true; resolve(url); };
    img.onerror = ()=>{ if(done) return; done=true; resolve(fallback); };
    img.src = url;
    // fallback to timeout
    setTimeout(()=>{ if(done) return; done=true; resolve(fallback); }, timeout);
  });
}

/* ====================== Storage (Cart + Profile) ====================== */

function saveToLS(key, obj){
  if(!HAS_LOCALSTORAGE) return false;
  try{ localStorage.setItem(key, JSON.stringify(obj)); return true; }catch(e){ return false; }
}
function loadFromLS(key, def=null){
  if(!HAS_LOCALSTORAGE) return def;
  const raw = localStorage.getItem(key);
  return raw ? safeJSONParse(raw, def) : def;
}
function clearLSKey(key){ if(HAS_LOCALSTORAGE) localStorage.removeItem(key); }

/* Cart model */
function defaultCart(){ return { items: [], meta:{ subtotal:0, discount:0, final:0 } }; }

function getCart(){
  let c = loadFromLS(LS_KEYS.CART, null);
  if(!c) { c = defaultCart(); saveToLS(LS_KEYS.CART, c); }
  return c;
}
function setCart(cart){
  if(!cart) cart = defaultCart();
  // recalc meta
  try{
    let sub = 0;
    for(const it of cart.items){
      const qty = toNumber(it.quantity, 1);
      const price = toNumber(it.price, 0);
      sub += price * qty;
    }
    cart.meta = cart.meta || {};
    cart.meta.subtotal = sub;
    cart.meta.final = Math.max(0, sub - (cart.meta.discount || 0));
  }catch(e){}
  saveToLS(LS_KEYS.CART, cart);
}
function clearCart(){ const c = defaultCart(); setCart(c); return c; }

/* Profile model */
function getProfile(){ return loadFromLS(LS_KEYS.PROFILE, null); }
function setProfile(p){ if(!p) return; saveToLS(LS_KEYS.PROFILE, p); }

/* Coupon store */
function setLocalCoupon(code){ if(!code) clearLSKey(LS_KEYS.COUPON); else saveToLS(LS_KEYS.COUPON, {code, ts:Date.now()}); }
function getLocalCoupon(){ return loadFromLS(LS_KEYS.COUPON, null); }

/* ====================== Backend API helpers ====================== */

/*
  API usage:
  GET -> API_BASE?action=products (etc)
  POST -> API_BASE (body JSON) with { action: 'addorder' ... }
*/

async function apiGet(params={}){
  if(!HAS_FETCH) return { ok:false, error: 'No fetch available' };
  try{
    const url = new URL(API_BASE);
    Object.keys(params || {}).forEach(k => url.searchParams.set(k, params[k]));
    const res = await fetch(url.toString(), { method:'GET', cache:'no-store' });
    const json = await res.json();
    return json;
  }catch(err){
    console.error('apiGet error', err);
    return { ok:false, error: String(err) };
  }
}

async function apiPost(body){
  if(!HAS_FETCH) return { ok:false, error: 'No fetch available' };
  try{
    const res = await fetch(API_BASE, {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify(body)
    });
    const json = await res.json();
    return json;
  }catch(err){
    console.error('apiPost error', err);
    return { ok:false, error: String(err) };
  }
}

/* ====================== PRODUCTS (load + render) ====================== */

/*
 expected product object keys (from sheet):
 ProductID, Name, Price, Stock, Category, Image URL, Quantity
*/

// normalize product object (map missing headers)
function normalizeProduct(raw){
  if(!raw) return null;
  // handle both object with header names and array positions
  const p = {};
  p.productId = (raw.ProductID || raw.productid || raw['Product ID'] || raw['productId'] || raw['id'] || '').toString();
  p.name = (raw.Name || raw.name || raw['Product Name'] || '').toString() || 'Unnamed product';
  p.price = toNumber(raw.Price || raw.price || raw['MRP'] || raw['Amount'], 0);
  p.stock = toNumber(raw.Stock || raw.stock || raw['Qty'] || raw.QuantityInStock, 0);
  p.category = (raw.Category || raw.category || raw['Cat'] || '').toString() || 'Uncategorized';
  p.image = (raw['Image URL'] || raw.image || raw['Image'] || raw.img || '').toString() || '';
  // optional quantity default value for pack-size etc.
  p.quantityUnit = (raw['Quantity'] || raw.quantity || raw['Pack'] || '').toString() || '';
  // raw map for reference
  p._raw = raw;
  return p;
}

let PRODUCTS_CACHE = [];    // normalized products
let PRODUCTS_BY_ID = {};    // map

async function loadProducts(){
  const res = await apiGet({ action: 'products' });
  if(!res || !res.ok){ console.warn('loadProducts failed', res); PRODUCTS_CACHE = []; PRODUCTS_BY_ID={}; return []; }
  const rawList = res.products || [];
  PRODUCTS_CACHE = rawList.map(normalizeProduct).filter(Boolean);
  PRODUCTS_BY_ID = {};
  for(const p of PRODUCTS_CACHE) PRODUCTS_BY_ID[p.productId || p.name] = p;
  return PRODUCTS_CACHE;
}

/* Render product list into a container
   containerId: id of DOM node where to render
   options: { page, perPage, showAddToCart, showFilters }
*/
async function renderProducts(containerId, options={}){
  const cont = el(containerId);
  if(!cont) { console.warn('renderProducts: container not found', containerId); return; }
  empty(cont);

  const opt = Object.assign({ page:1, perPage:12, showAddToCart:true }, options);
  const list = PRODUCTS_CACHE.slice();

  // TODO: add filtering/sorting here if needed
  const start = (opt.page - 1) * opt.perPage;
  const pageItems = list.slice(start, start + opt.perPage);

  // build nodes
  for(const prod of pageItems){
    const card = document.createElement('div');
    card.className = 'nj-product-card';
    card.style = 'display:flex;gap:12px;padding:12px;border-radius:12px;background:#fff;margin-bottom:10px;align-items:center;';
    // image (async validation)
    const imgWrap = document.createElement('div');
    imgWrap.style = 'width:120px;height:90px;flex:0 0 auto;border-radius:8px;overflow:hidden;background:#f6f6f6;display:flex;align-items:center;justify-content:center';
    const imgEl = document.createElement('img');
    imgEl.alt = prod.name || 'product';
    imgEl.style = 'width:100%;height:100%;object-fit:cover;display:block';
    imgWrap.appendChild(imgEl);
    card.appendChild(imgWrap);

    // details
    const info = document.createElement('div');
    info.style = 'flex:1';
    const title = document.createElement('div');
    title.style = 'font-weight:800;margin-bottom:6px';
    title.textContent = prod.name + (prod.quantityUnit ? (' • ' + prod.quantityUnit) : '');
    const priceRow = document.createElement('div');
    priceRow.style = 'display:flex;justify-content:space-between;align-items:center';
    const priceText = document.createElement('div');
    priceText.innerHTML = `<span style="font-weight:800">₹${(prod.price||0).toFixed(0)}</span> <span style="color:#777;margin-left:6px;">${prod.category}</span>`;
    const stockText = document.createElement('div');
    stockText.style = 'font-size:13px;color:#666';
    stockText.textContent = prod.stock > 0 ? 'In stock' : 'Out of stock';

    priceRow.appendChild(priceText);
    priceRow.appendChild(stockText);

    const actions = document.createElement('div');
    actions.style = 'margin-top:8px;display:flex;gap:8px;align-items:center';
    // qty input
    const qty = document.createElement('input');
    qty.type = 'number';
    qty.min = '1';
    qty.value = '1';
    qty.style = 'width:72px;padding:8px;border-radius:8px;border:1px solid #e7e7e7';
    actions.appendChild(qty);

    // add to cart button
    const addBtn = document.createElement('button');
    addBtn.className = 'nj-btn nj-btn-primary';
    addBtn.textContent = 'Add';
    addBtn.style = 'padding:8px 12px;border-radius:10px;border:0;background:#2db34a;color:#fff;font-weight:700;cursor:pointer';
    if(!opt.showAddToCart) addBtn.style.display = 'none';

    addBtn.addEventListener('click', async ()=>{
      const q = toNumber(qty.value, 1);
      if(q <=0){ toast('Enter quantity'); return; }
      await addToCart(prod, q);
      toast('Added to cart');
      renderCartMini('cartMiniContainer'); // optional
    });

    actions.appendChild(addBtn);

    info.appendChild(title);
    info.appendChild(priceRow);
    info.appendChild(actions);

    card.appendChild(info);

    // set image (async)
    (async ()=>{
      const url = await ensureImage(prod.image, DEFAULT_IMAGE);
      imgEl.src = url;
    })();

    cont.appendChild(card);
  }

  // pagination (simple)
  const totalPages = Math.max(1, Math.ceil(list.length / opt.perPage));
  const pager = document.createElement('div');
  pager.style = 'display:flex;gap:8px;align-items:center;justify-content:center;margin-top:12px';
  for(let p=1; p<=totalPages; p++){
    const b = document.createElement('button');
    b.textContent = p;
    b.style = `padding:6px 9px;border-radius:6px;border:1px solid #e7e7e7;background:${p===opt.page ? '#2db34a':'#fff'};color:${p===opt.page ? '#fff':'#111'};cursor:pointer`;
    ((pnum)=>{
      b.addEventListener('click', ()=> renderProducts(containerId, Object.assign({},opt,{page:pnum})));
    })(p);
    pager.appendChild(b);
  }
  cont.appendChild(pager);
}

/* ====================== CART FUNCTIONS ====================== */

async function addToCart(prod, qty=1){
  const cart = getCart();
  const pid = prod.productId || prod.name;
  let found = cart.items.find(i => i.productId === pid);
  if(found){
    found.quantity = toNumber(found.quantity,1) + toNumber(qty,1);
  } else {
    cart.items.push({
      productId: pid,
      name: prod.name,
      price: toNumber(prod.price, 0),
      quantity: toNumber(qty,1),
      image: prod.image || DEFAULT_IMAGE,
      stock: toNumber(prod.stock,0),
      category: prod.category || ''
    });
  }
  setCart(cart);
  return cart;
}

function updateCartItem(productId, quantity){
  const cart = getCart();
  const idx = cart.items.findIndex(i=>i.productId === productId);
  if(idx === -1) return cart;
  if(quantity <= 0) cart.items.splice(idx,1);
  else cart.items[idx].quantity = toNumber(quantity,1);
  setCart(cart);
  return cart;
}

function removeFromCart(productId){
  const cart = getCart();
  cart.items = cart.items.filter(i => i.productId !== productId);
  setCart(cart);
  return cart;
}

/* Render cart mini/checkout (basic) */
function renderCartMini(containerId){
  const cont = el(containerId);
  if(!cont) return;
  const cart = getCart();
  empty(cont);
  if(!cart.items || cart.items.length === 0){
    cont.innerHTML = '<div style="padding:12px;color:#666">Your cart is empty</div>';
    return;
  }
  cart.items.forEach(it=>{
    const row = document.createElement('div');
    row.style = 'display:flex;align-items:center;gap:10px;padding:8px;border-bottom:1px solid #f3f3f3';
    row.innerHTML = `
      <img src="${it.image || DEFAULT_IMAGE}" style="width:48px;height:48px;object-fit:cover;border-radius:6px">
      <div style="flex:1">
        <div style="font-weight:700">${it.name}</div>
        <div style="color:#777;font-size:13px">₹${(it.price||0).toFixed(0)} x ${it.quantity}</div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:800">₹${((it.price||0)*(it.quantity||1)).toFixed(0)}</div>
        <button class="nj-remove" data-id="${it.productId}" style="background:none;border:0;color:#d00;cursor:pointer;margin-top:6px">Remove</button>
      </div>
    `;
    cont.appendChild(row);
  });

  // totals
  const footer = document.createElement('div');
  footer.style = 'padding:12px;display:flex;justify-content:space-between;align-items:center';
  const cartObj = getCart();
  footer.innerHTML = `<div style="font-weight:700">Subtotal</div><div style="font-weight:900">₹${(cartObj.meta.subtotal||0).toFixed(0)}</div>`;
  cont.appendChild(footer);

  // wire remove handlers
  qselAll('.nj-remove', cont).forEach(btn=>{
    btn.addEventListener('click', (e)=>{
      const id = e.currentTarget.dataset.id;
      removeFromCart(id);
      renderCartMini(containerId);
      toast('Removed from cart');
    });
  });
}

/* ====================== COUPONS ====================== */

async function applyCoupon(code){
  if(!code) { toast('Enter coupon'); return {ok:false, error:'no-code'}; }
  // try backend validate
  const res = await apiPost({ action:'validatecoupon', code: code });
  if(!res || !res.ok){ toast(res && res.error ? res.error : 'Invalid coupon'); return {ok:false, error:res && res.error}; }
  // apply discount to cart
  const cart = getCart();
  const discountAmount = toNumber(res.discount || 0, 0);
  cart.meta.discount = discountAmount;
  cart.meta.final = Math.max(0, cart.meta.subtotal - discountAmount);
  setCart(cart);
  setLocalCoupon(code);
  toast('Coupon applied');
  return {ok:true, discount: discountAmount};
}

/* ====================== CHECKOUT / ORDERS ====================== */

/*
  Checkout flow:
   - get cart
   - require profile (phone & name)
   - choose payment method (UPI/chosen id => open UPI link OR COD)
   - create order object and send to backend via action=addorder
   - backend will append order row(s) to sheet and add report row
*/

function generateOrderPayload(cart, profile, opts={}){
  const items = cart.items.map(i=>({
    productId: i.productId,
    name: i.name,
    price: i.price,
    quantity: i.quantity
  }));
  const totalAmount = cart.meta.subtotal || 0;
  const discount = cart.meta.discount || 0;
  const finalAmount = cart.meta.final || (totalAmount - discount);
  const payload = {
    action: 'addorder',
    CustomerID: profile && (profile.CustomerID || profile.Phone || profile.Email) || '',
    Items: JSON.stringify(items),
    TotalAmount: totalAmount,
    Discount: discount,
    FinalAmount: finalAmount,
    OrderDate: opts.OrderDate || new Date().toLocaleString(),
    Status: opts.Status || 'placed',
    Payment: opts.Payment || 'unknown',
    DeliveryAddress: profile && profile.Address || ''
  };
  return payload;
}

/* UPI Payment link builder (opens UPI intent or deep link) */
function buildUPIURL({payee=UPI_ID, name='NJ Mart', amount=0, note='Order payment'}){
  // using UPI deep link format
  const params = new URLSearchParams({
    pa: payee,
    pn: name,
    am: (amount || 0).toFixed(2),
    tn: note,
    cu: 'INR'
  });
  // Intent uri (android) or pay url
  return 'upi://pay?' + params.toString();
}

/* checkout handler
   method: 'upi' or 'cod'
   upiOpen: if true open link (for web fallback user will copy)
*/
async function doCheckout(method='cod', upiOpen=true){
  const cart = getCart();
  if(!cart || !cart.items || cart.items.length ===0){ toast('Cart empty'); return {ok:false, error:'cart-empty'}; }

  const profile = getProfile();
  if(!profile || !profile.Phone || !profile.Name){
    toast('Please sign in or enter profile before checkout');
    // optionally open profile page/modal
    return {ok:false, error:'no-profile'};
  }

  // if coupon apply persisted, ensure cart meta updated (already done earlier)
  setCart(cart);

  if(method === 'upi'){
    // Build UPI deep link and open
    const amount = cart.meta.final || cart.meta.subtotal || 0;
    const upiUrl = buildUPIURL({ amount, note: `Order from ${profile.Name||profile.Phone}` });
    // open using window.location or anchor
    if(upiOpen){
      // open in new tab (some browsers may block)
      window.open(upiUrl, '_blank');
    } else {
      // return the link for UI to show
      return {ok:true, upiUrl};
    }
  }

  // Now create order record on backend (we mark payment method accordingly)
  const paymentMethod = (method === 'upi') ? 'upi' : 'cod';

  const payload = generateOrderPayload(cart, profile, { Payment: paymentMethod, Status: 'placed' });

  // send to backend
  const res = await apiPost(payload);
  if(!res || !res.ok){ toast('Order failed: ' + (res && res.error || 'unknown')); return {ok:false, error:res && res.error}; }

  // clear cart locally
  clearCart();
  setLocalCoupon(null);
  toast('Order placed successfully');
  return {ok:true, orderId: res.orderId || res.id || ''};
}

/* ====================== ORDERS UI (admin/customer) ====================== */

async function loadOrdersForUI(){
  const r = await apiGet({ action: 'orders' });
  if(!r || !r.ok) { return []; }
  return r.orders || [];
}

/* ====================== AUTH (firebase optional) ====================== */

/*
  Note: we assume firebase is initialized via firebase-config.js included before this file.
  These functions check for firebase presence and fallback gracefully.
*/

async function signInWithGoogle(){
  if(!HAS_FIREBASE){ toast('Firebase not initialized'); return null; }
  const provider = new firebase.auth.GoogleAuthProvider();
  try{
    const result = await firebase.auth().signInWithPopup(provider);
    const user = result.user;
    const profile = { Name: user.displayName, Email: user.email, Phone: user.phoneNumber || '', PhotoURL: user.photoURL || '' };
    setProfile(profile);
    toast('Signed in as ' + (profile.Name || profile.Email));
    return profile;
  }catch(e){
    console.error('google signin error', e);
    toast('Sign-in failed');
    return null;
  }
}

/* phone auth (requires firebase phone auth configured + reCAPTCHA container)
   You need to include a <div id="recaptcha-container"></div> if using phone sign-in
*/
async function signInWithPhone(phoneNumber, recaptchaContainerId='recaptcha-container'){
  if(!HAS_FIREBASE) { toast('Firebase not initialized'); return null; }
  try{
    // set up recaptcha verifier
    const verifier = new firebase.auth.RecaptchaVerifier(recaptchaContainerId, { size:'invisible' });
    const confirmationResult = await firebase.auth().signInWithPhoneNumber(phoneNumber, verifier);
    // confirmationResult can be used to prompt user for OTP
    return confirmationResult;
  }catch(e){
    console.error('phone auth error', e);
    toast('Phone sign-in error');
    return null;
  }
}

/* ====================== ADMIN / STAFF HELPERS (stubs) ====================== */

async function adminAddProduct(productObj){
  // productObj: { ProductID, Name, Price, Stock, Category, 'Image URL', Quantity }
  // Use backend action addproduct
  const payload = Object.assign({ action: 'addproduct' }, productObj);
  const res = await apiPost(payload);
  if(!res || !res.ok) { toast('Add product failed'); return res; }
  // reload products
  await loadProducts();
  toast('Product added');
  return res;
}

async function adminUpdateProduct(productId, updates){
  // No built-in backend update in provided Apps Script — needs sheet edit function.
  // Placeholder: implement server-side editing or use admin to re-upload sheet
  toast('Update product: requires server side update function (not implemented)');
  return { ok:false, error:'server-update-required' };
}

/* ====================== INITIALIZE (load => render) ====================== */

async function initApp(){
  // load products & other basic data
  await loadProducts();
  // initial renders: adjust container ids to your html
  // common container ids used in templates:
  // - 'productsContainer' -> main listing
  // - 'cartMiniContainer' -> small cart widget
  // - 'ordersContainer' -> admin/customer orders
  if(el('productsContainer')) renderProducts('productsContainer', { page:1, perPage:12 });
  if(el('cartMiniContainer')) renderCartMini('cartMiniContainer');

  // wire checkout buttons if exist
  const btnCheckoutUPI = el('btnCheckoutUPI'); // button to pay via UPI
  const btnCheckoutCOD = el('btnCheckoutCOD'); // button for COD
  if(btnCheckoutUPI){
    btnCheckoutUPI.addEventListener('click', async ()=>{
      const result = await doCheckout('upi', true);
      if(result && result.ok){ toast('Order placed — open UPI app to complete payment'); }
    });
  }
  if(btnCheckoutCOD){
    btnCheckoutCOD.addEventListener('click', async ()=>{
      const result = await doCheckout('cod', false);
      if(result && result.ok){ toast('Order placed (COD). Thanks!'); }
    });
  }

  // coupon apply
  const btnApplyCoupon = el('btnApplyCoupon');
  if(btnApplyCoupon){
    btnApplyCoupon.addEventListener('click', async ()=>{
      const inp = el('couponInput');
      if(!inp) return;
      await applyCoupon(inp.value.trim());
      // update UI totals (if any)
      if(el('cartMiniContainer')) renderCartMini('cartMiniContainer');
    });
  }

  // profile save button
  const btnSaveProfile = el('btnSaveProfile');
  if(btnSaveProfile){
    btnSaveProfile.addEventListener('click', async ()=>{
      const name = (el('profileName') && el('profileName').value) || '';
      const phone = (el('profilePhone') && el('profilePhone').value) || '';
      const address = (el('profileAddress') && el('profileAddress').value) || '';
      if(!name || !phone){ toast('Name and phone required'); return; }
      const profile = { Name: name, Phone: phone, Address: address };
      setProfile(profile);
      toast('Profile updated');
    });
  }

  // login button
  const btnGoogleLogin = el('btnGoogleLogin');
  if(btnGoogleLogin){
    btnGoogleLogin.addEventListener('click', async ()=>{
      await signInWithGoogle();
    });
  }

  // refresh products button (admin)
  const btnReloadProducts = el('btnReloadProducts');
  if(btnReloadProducts){
    btnReloadProducts.addEventListener('click', async ()=>{
      await loadProducts();
      if(el('productsContainer')) renderProducts('productsContainer', { page:1, perPage:12 });
      toast('Products reloaded');
    });
  }
}

/* ====================== EXPORT / window hooks ====================== */

window.NJ = window.NJ || {};
window.NJ.app = {
  init: initApp,
  loadProducts,
  renderProducts,
  getCart,
  addToCart,
  removeFromCart,
  updateCartItem,
  clearCart,
  doCheckout,
  applyCoupon,
  apiGet,
  apiPost,
  setProfile,
  getProfile,
  signInWithGoogle,
  signInWithPhone,
  adminAddProduct,
  adminUpdateProduct
};

/* auto-init on DOM ready */
document.addEventListener('DOMContentLoaded', function(){
  try{ initApp(); }catch(e){ console.error('initApp error', e); }
});

/* ====================== Extra lightweight styles for toasts & basic widgets ====================== */
(function injectSmallStyles(){
  const css = `
  .nj-product-card img{ transition:opacity .2s ease; }
  .nj-toast{ transition:opacity .3s ease; }
  .nj-btn{ font-weight:700; border-radius:8px; padding:8px 10px; cursor:pointer; }
  .nj-btn-primary{ background:#2db34a;color:#fff;border:0 }
  .nj-btn-ghost{ background:#fff;border:1px solid #e6eef0;color:#333 }
  `;
  const s = document.createElement('style'); s.appendChild(document.createTextNode(css)); document.head.appendChild(s);
})();

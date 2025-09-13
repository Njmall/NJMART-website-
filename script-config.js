/* =========================================================================
   script-config.js  —  NJ Mart client API helpers (Part 1 / 3)
   - Final expanded version (copy-paste ready)
   - Purpose: provide robust GET/POST helpers and entity helpers for
     Products / Orders / Customers / Coupons / Staff / Settings / Reports.
   - Usage: include AFTER firebase-config.js (which may set window.BACKEND_URL)
   - This file intentionally uses window.NJ_API / window.NJ_CONFIG namespace
     to avoid duplicate declarations and global name collisions.
   ========================================================================= */

/* ===========================
   Basic runtime checks & config
   =========================== */
(function () {
  'use strict';

  // ---- default values (safe to override) ----
  if (!window.NJ_CONFIG) window.NJ_CONFIG = {};
  const NJ = window.NJ_CONFIG;

  // If BACKEND_URL not already set (e.g. in firebase-config.js), set it here.
  // Replace the placeholder below with your Apps Script webapp URL if you want
  // this file to be fully standalone. If firebase-config.js already sets it,
  // that value will be used.
  if (!window.BACKEND_URL) {
    // default: use the Apps Script URL you provided earlier;
    // update if you deploy different webapp version.
    window.BACKEND_URL = "https://script.google.com/macros/s/AKfycbwsG5H7er3nqwGjEbrtokssc5LeGFc9Zog2bG1s0C5bQ-P2b_1S1kisSLpOmdESH7FB/exec";
  }

  // Developer options (toggle for verbose logs)
  NJ.DEBUG = NJ.DEBUG === undefined ? true : !!NJ.DEBUG;
  NJ.REQUEST_TIMEOUT_MS = NJ.REQUEST_TIMEOUT_MS || 25000; // 25s default
  NJ.RETRY_COUNT = NJ.RETRY_COUNT || 1; // retry once on network hiccup

  // safe logger
  function log(...args) {
    if (NJ.DEBUG) console.log('[NJ_API]', ...args);
  }
  function warn(...args) {
    if (NJ.DEBUG) console.warn('[NJ_API]', ...args);
  }
  function error(...args) {
    if (NJ.DEBUG) console.error('[NJ_API]', ...args);
  }

  /* ===========================
     Low-level fetch helpers
     - apiGet: GET with query params + timeout + retries
     - apiPost: POST (application/json) with timeout + retries
     =========================== */

  // build URL with params safely
  function buildUrl(base, params) {
    try {
      const u = new URL(base);
      if (params && typeof params === 'object') {
        Object.keys(params).forEach(k => {
          if (params[k] !== undefined && params[k] !== null) {
            u.searchParams.set(k, String(params[k]));
          }
        });
      }
      return u.toString();
    } catch (e) {
      // fallback: naive concat
      let qs = '';
      if (params && typeof params === 'object') {
        qs = Object.keys(params).map(k => encodeURIComponent(k) + '=' + encodeURIComponent(String(params[k]||''))).join('&');
      }
      return base + (qs ? ('?' + qs) : '');
    }
  }

  // fetch with timeout using AbortController
  async function fetchWithTimeout(url, opts = {}, timeout = NJ.REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    opts.signal = controller.signal;
    try {
      const res = await fetch(url, opts);
      clearTimeout(id);
      return res;
    } catch (err) {
      clearTimeout(id);
      throw err;
    }
  }

  // parse JSON safely
  async function safeJson(res) {
    if (!res) return { ok: false, error: 'no-response' };
    const text = await res.text().catch(() => null);
    if (!text) return { ok: false, error: 'empty-response', status: res.status };
    try {
      const json = JSON.parse(text);
      return json;
    } catch (e) {
      // not JSON — return raw text
      return { ok: false, error: 'invalid-json', status: res.status, text };
    }
  }

  // generic GET
  async function apiGet(params = {}, opts = {}) {
    const base = window.BACKEND_URL;
    const url = buildUrl(base, params);
    let attempt = 0;
    while (attempt <= NJ.RETRY_COUNT) {
      try {
        log('GET', url);
        const res = await fetchWithTimeout(url, { method: 'GET', credentials: 'omit', headers: { 'Accept': 'application/json' } }, NJ.REQUEST_TIMEOUT_MS);
        if (!res.ok) {
          // HTTP-level failure
          const json = await safeJson(res);
          warn('GET not ok', res.status, json);
          return { ok: false, status: res.status, error: json && json.error ? json.error : 'http_error' };
        }
        const json = await safeJson(res);
        if (json && json.ok === false) {
          // backend responded with ok:false
          warn('GET backend returned ok:false', json);
          return json;
        }
        return json;
      } catch (err) {
        warn('GET attempt', attempt, 'failed', err && err.name ? err.name : err);
        attempt++;
        if (attempt > NJ.RETRY_COUNT) {
          return { ok: false, error: String(err) };
        }
        // small backoff
        await new Promise(r => setTimeout(r, 400));
      }
    }
  }

  // generic POST JSON
  async function apiPost(payload = {}, opts = {}) {
    const base = window.BACKEND_URL;
    let attempt = 0;
    const fetchOpts = {
      method: 'POST',
      credentials: 'omit',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    };
    while (attempt <= NJ.RETRY_COUNT) {
      try {
        log('POST', base, payload);
        const res = await fetchWithTimeout(base, fetchOpts, NJ.REQUEST_TIMEOUT_MS);
        if (!res.ok) {
          const json = await safeJson(res);
          warn('POST not ok', res.status, json);
          return { ok: false, status: res.status, error: json && json.error ? json.error : 'http_error' };
        }
        const json = await safeJson(res);
        if (json && json.ok === false) {
          warn('POST backend returned ok:false', json);
          return json;
        }
        return json;
      } catch (err) {
        warn('POST attempt', attempt, 'failed', err && err.name ? err.name : err);
        attempt++;
        if (attempt > NJ.RETRY_COUNT) return { ok: false, error: String(err) };
        await new Promise(r => setTimeout(r, 400));
      }
    }
  }

  /* ===========================
     Common response normalizer / error helper
     =========================== */
  function normalizeResponse(resp) {
    if (!resp) return { ok: false, error: 'no_response' };
    // if already normalized by safeJson
    if (typeof resp === 'object' && resp.ok !== undefined) return resp;
    // fallback
    return { ok: true, data: resp };
  }

  /* ===========================
     Local cache helpers (in-memory + localStorage)
     - cache is useful to avoid refetching products repeatedly
     =========================== */

  const LOCAL_PREFIX = 'nj_';
  function cacheSet(key, value, ttlSeconds = 300) {
    try {
      const payload = { v: value, e: Date.now() + (ttlSeconds * 1000) };
      localStorage.setItem(LOCAL_PREFIX + key, JSON.stringify(payload));
    } catch (e) {
      warn('cacheSet failed', e);
    }
  }
  function cacheGet(key) {
    try {
      const raw = localStorage.getItem(LOCAL_PREFIX + key);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.e) return null;
      if (Date.now() > parsed.e) {
        localStorage.removeItem(LOCAL_PREFIX + key);
        return null;
      }
      return parsed.v;
    } catch (e) {
      return null;
    }
  }
  function cacheRemove(key) {
    try { localStorage.removeItem(LOCAL_PREFIX + key); } catch (e) { /* ignore */ }
  }

  /* ===========================
     High-level entity helpers
     Each function calls the Apps Script webapp with a specific
     `action` parameter, matching typical Apps Script handlers:
       - action=products     => list products
       - action=product&id=.. => single product
       - action=addproduct    => create product (POST)
       - action=orders        => list orders
       - action=addorder      => create order (POST)
       - action=customers     => list customers
       - action=addcustomer   => create customer (POST)
       - action=coupons       => list coupons
       - action=validatecoupon => validate coupon (POST or GET)
       - action=settings     => list settings
       - action=reports      => list reports
     If your Apps Script uses different parameter names, adjust these helpers.
     =========================== */

  // ---------- PRODUCTS ----------
  async function getProducts({ useCache = true, forceRefresh = false, limit = 1000 } = {}) {
    const cacheKey = 'products';
    if (useCache && !forceRefresh) {
      const cached = cacheGet(cacheKey);
      if (cached) {
        log('getProducts -> returning cached', cached.length || 0);
        return { ok: true, products: cached, cached: true };
      }
    }

    const res = await apiGet({ action: 'products', limit });
    const normalized = normalizeResponse(res);
    if (normalized.ok && normalized.products) {
      cacheSet(cacheKey, normalized.products, 180); // cache 3 minutes
    }
    return normalized;
  }

  async function getProductById(productId) {
    if (!productId) return { ok: false, error: 'missing_productId' };
    const res = await apiGet({ action: 'product', id: productId });
    return normalizeResponse(res);
  }

  // Add / update product (POST)
  async function addProduct(productObj) {
    if (!productObj) return { ok: false, error: 'missing_product' };
    const payload = Object.assign({ action: 'addproduct' }, productObj);
    const res = await apiPost(payload);
    // invalidate product cache
    cacheRemove('products');
    return normalizeResponse(res);
  }

  async function updateProduct(productId, patch) {
    if (!productId || !patch) return { ok: false, error: 'missing_params' };
    const payload = Object.assign({ action: 'updateproduct', id: productId }, patch);
    const res = await apiPost(payload);
    cacheRemove('products');
    return normalizeResponse(res);
  }

  async function deleteProduct(productId) {
    if (!productId) return { ok: false, error: 'missing_productId' };
    const payload = { action: 'deleteproduct', id: productId };
    const res = await apiPost(payload);
    cacheRemove('products');
    return normalizeResponse(res);
  }

  // ---------- ORDERS ----------
  async function getOrders({ useCache = false, filter = {} } = {}) {
    // Orders often dynamic; default: no cache
    const params = Object.assign({ action: 'orders' }, filter || {});
    const res = await apiGet(params);
    return normalizeResponse(res);
  }

  async function addOrder(orderObj) {
    if (!orderObj) return { ok: false, error: 'missing_order' };
    const payload = Object.assign({ action: 'addorder' }, orderObj);
    const res = await apiPost(payload);
    // optionally push to reports if backend doesn't
    if (res && res.ok) {
      cacheRemove('orders');
      cacheRemove('reports');
    }
    return normalizeResponse(res);
  }

  async function updateOrder(orderId, patch) {
    if (!orderId || !patch) return { ok: false, error: 'missing_params' };
    const payload = Object.assign({ action: 'updateorder', id: orderId }, patch);
    const res = await apiPost(payload);
    cacheRemove('orders');
    return normalizeResponse(res);
  }

  async function deleteOrder(orderId) {
    if (!orderId) return { ok: false, error: 'missing_orderId' };
    const payload = { action: 'deleteorder', id: orderId };
    const res = await apiPost(payload);
    cacheRemove('orders');
    return normalizeResponse(res);
  }

  // ---------- CUSTOMERS ----------
  async function getCustomers({ useCache = true } = {}) {
    const cacheKey = 'customers';
    if (useCache) {
      const cached = cacheGet(cacheKey);
      if (cached) return { ok: true, customers: cached, cached: true };
    }
    const res = await apiGet({ action: 'customers' });
    const normalized = normalizeResponse(res);
    if (normalized.ok && normalized.customers) cacheSet(cacheKey, normalized.customers, 180);
    return normalized;
  }

  async function addCustomer(customerObj) {
    if (!customerObj) return { ok: false, error: 'missing_customer' };
    const payload = Object.assign({ action: 'addcustomer' }, customerObj);
    const res = await apiPost(payload);
    cacheRemove('customers');
    return normalizeResponse(res);
  }

  async function updateCustomer(customerId, patch) {
    if (!customerId || !patch) return { ok: false, error: 'missing_params' };
    const payload = Object.assign({ action: 'updatecustomer', id: customerId }, patch);
    const res = await apiPost(payload);
    cacheRemove('customers');
    return normalizeResponse(res);
  }

  // ---------- COUPONS ----------
  async function getCoupons({ useCache = true } = {}) {
    const cacheKey = 'coupons';
    if (useCache) {
      const cached = cacheGet(cacheKey);
      if (cached) return { ok: true, coupons: cached, cached: true };
    }
    const res = await apiGet({ action: 'coupons' });
    const normalized = normalizeResponse(res);
    if (normalized.ok && normalized.coupons) cacheSet(cacheKey, normalized.coupons, 120);
    return normalized;
  }

  async function validateCoupon(code) {
    if (!code) return { ok: false, error: 'missing_code' };
    // Some backends expect POST; try POST then GET fallback
    try {
      const post = await apiPost({ action: 'validatecoupon', code });
      if (post && post.ok) return normalizeResponse(post);
    } catch (e) { warn('validateCoupon POST failed, trying GET', e); }
    // fallback to GET
    const get = await apiGet({ action: 'validatecoupon', code });
    return normalizeResponse(get);
  }

  async function addCoupon(couponObj) {
    if (!couponObj) return { ok: false, error: 'missing_coupon' };
    const payload = Object.assign({ action: 'addcoupon' }, couponObj);
    const res = await apiPost(payload);
    cacheRemove('coupons');
    return normalizeResponse(res);
  }

  // ---------- SETTINGS ----------
  async function getSettings({ useCache = true } = {}) {
    const cacheKey = 'settings';
    if (useCache) {
      const cached = cacheGet(cacheKey);
      if (cached) return { ok: true, settings: cached, cached: true };
    }
    const res = await apiGet({ action: 'settings' });
    const normalized = normalizeResponse(res);
    if (normalized && normalized.ok && normalized.settings) {
      cacheSet(cacheKey, normalized.settings, 600); // cache 10 minutes
    }
    return normalized;
  }

  async function setSetting(key, value) {
    if (!key) return { ok: false, error: 'missing_key' };
    const payload = { action: 'setsetting', key: key, value: value };
    const res = await apiPost(payload);
    cacheRemove('settings');
    return normalizeResponse(res);
  }

  // ---------- REPORTS ----------
  async function getReports({ from, to, type } = {}) {
    const params = { action: 'reports' };
    if (from) params.from = from;
    if (to) params.to = to;
    if (type) params.type = type;
    const res = await apiGet(params);
    return normalizeResponse(res);
  }

  /* ===========================
     Export API onto window.NJ_API
     - This object is the single place to call from UI code.
     =========================== */

  const NJ_API = {
    // low-level
    get: apiGet,
    post: apiPost,
    // entities
    products: {
      list: getProducts,
      getById: getProductById,
      add: addProduct,
      update: updateProduct,
      delete: deleteProduct
    },
    orders: {
      list: getOrders,
      add: addOrder,
      update: updateOrder,
      delete: deleteOrder
    },
    customers: {
      list: getCustomers,
      add: addCustomer,
      update: updateCustomer
    },
    coupons: {
      list: getCoupons,
      validate: validateCoupon,
      add: addCoupon
    },
    settings: {
      get: getSettings,
      set: setSetting
    },
    reports: {
      list: getReports
    },
    // cache helpers
    _cache: { get: cacheGet, set: cacheSet, remove: cacheRemove },
    // config
    _config: NJ
  };

  // Avoid overwriting if library loaded twice — preserve existing and merge safely
  if (!window.NJ_API) {
    window.NJ_API = NJ_API;
  } else {
    // merge functions into existing object (non-destructive)
    Object.keys(NJ_API).forEach(k => {
      if (!window.NJ_API[k]) window.NJ_API[k] = NJ_API[k];
    });
  }

  log('script-config.js loaded. BACKEND_URL=', window.BACKEND_URL);
  // End of IIFE
})();
/* =========================================================================
   script-config.js — Part 2 / Advanced helpers
   - Bulk import/export (CSV/JSON)
   - Image upload helpers (Firebase Storage + PostImages fallback)
   - Staff management helpers
   - Delivery link generator for delivery boy (maps + order token)
   - Utility: export JSON, download file, generate invoice (basic)
   - Designed to extend window.NJ_API created in Part 1
   ========================================================================= */

(function(){
  'use strict';
  // Ensure base API exists
  if(!window.NJ_API) {
    console.warn('window.NJ_API not found — include Part 1 before Part 2');
    window.NJ_API = {};
  }

  const NJ = (window.NJ_CONFIG = window.NJ_CONFIG || {});
  const log = (...args)=> { if(NJ.DEBUG) console.log('[NJ_API-ADV]',...args); };
  const warn = (...args)=> { if(NJ.DEBUG) console.warn('[NJ_API-ADV]',...args); };

  /* ============================
     Helpers: file download & CSV parse
     ============================ */
  function downloadFile(filename, content, mime='application/json') {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 5000);
  }

  function csvToArray(csvText, delimiter=',') {
    // Basic CSV parser — returns array of objects assuming header row present
    // Handles quoted values simply
    const lines = csvText.split(/\r\n|\n/).filter(l => l.trim() !== '');
    if(lines.length === 0) return [];
    const headers = lines[0].split(delimiter).map(h => h.trim().replace(/^"|"$/g,''));
    const rows = lines.slice(1);
    const out = rows.map(r => {
      const cols = r.split(delimiter).map(c => c.trim().replace(/^"|"$/g,''));
      const obj = {};
      headers.forEach((h,i) => obj[h || `col${i}`] = cols[i] !== undefined ? cols[i] : '');
      return obj;
    });
    return out;
  }

  /* ============================
     Image upload helpers
     - uploadToFirebase(file|dataURL) -> returns download URL (requires firebase storage configured)
     - uploadByUrlToPostimages(imageUrl) -> attempts to use PostImages anonymous upload via their API (CORS may block)
     - uploadImageGeneric({file|dataUrl|url}) will try Firebase storage first, fallback to PostImages
     ============================ */

  async function uploadToFirebase({ file, dataUrl, pathPrefix='products' } = {}) {
    if(!window.NJ_FIREBASE || !window.NJ_FIREBASE.storage) {
      return { ok:false, error:'firebase_storage_not_configured' };
    }
    try {
      const storage = window.NJ_FIREBASE.storage;
      // normalize to blob
      let blob = null;
      if(file) {
        blob = file;
      } else if(dataUrl) {
        // convert dataURL to blob
        const res = await (await fetch(dataUrl)).blob();
        blob = res;
      } else {
        return { ok:false, error:'missing_file_or_dataUrl' };
      }
      const filename = `${pathPrefix}/${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
      const storageRef = storage.ref().child(filename);
      const snapshot = await storageRef.put(blob);
      const downloadURL = await snapshot.ref.getDownloadURL();
      return { ok:true, url: downloadURL, path: filename };
    } catch (err) {
      warn('uploadToFirebase error', err);
      return { ok:false, error: String(err) };
    }
  }

  async function uploadByUrlToPostImages(imageUrl) {
    // NOTE: PostImages public API often requires server-side proxy or CORS allowance.
    // This function attempts a HEAD fetch and returns the original URL if allowed.
    try {
      // try quick HEAD to validate URL
      const res = await fetch(imageUrl, { method:'HEAD' });
      if(res.ok) {
        // if HEAD allowed, we assume remote URL is usable directly
        return { ok:true, url: imageUrl, source: 'remote' };
      }
      // fallback - cannot upload client-side to PostImages reliably (CORS)
      return { ok:false, error:'head_fail' };
    } catch(err) {
      return { ok:false, error: String(err) };
    }
  }

  // Generic uploader: prefer Firebase, fallback to remote-url
  async function uploadImageGeneric({ file, dataUrl, url, pathPrefix='products' } = {}) {
    // 1) If Firebase configured -> upload
    if(window.NJ_FIREBASE && window.NJ_FIREBASE.storage) {
      const fbRes = await uploadToFirebase({ file, dataUrl, pathPrefix });
      if(fbRes && fbRes.ok) return fbRes;
      // else fallback continue
    }
    // 2) if URL provided, test and return as-is
    if(url) {
      const remote = await uploadByUrlToPostImages(url);
      if(remote && remote.ok) return remote;
    }
    return { ok:false, error: 'no_upload_method_available' };
  }

  /* ============================
     Bulk import/export helpers
     - importProductsFromCSV(csvText)
     - exportProductsToJSON(): downloads JSON
     - bulkAddProducts(arrayOfObjects) -> posts in batches to backend
     ============================ */

  async function importProductsFromCSV(csvText, options={}) {
    if(!csvText) return { ok:false, error: 'missing_csv' };
    const arr = csvToArray(csvText, options.delimiter || ',');
    // Map CSV columns to expected product fields (best-effort)
    const products = arr.map(row => ({
      action: 'addproduct',
      ProductID: row['ProductID'] || row['Product Id'] || row['SKU'] || '',
      Name: row['Name'] || row['Product Name'] || row['Title'] || '',
      Price: Number(row['Price'] || row['MRP'] || 0) || 0,
      Stock: Number(row['Stock'] || row['Quantity'] || row['Qty'] || 0) || 0,
      Category: row['Category'] || row['Type'] || '',
      'Image URL': row['Image URL'] || row['Image'] || row['Photo'] || '',
      Quantity: row['Quantity'] || row['Qty'] || ''
    }));
    return await bulkAddProducts(products, { batchSize: options.batchSize || 20 });
  }

  async function exportProductsToJSON(filename='products-export.json') {
    try {
      const r = await window.NJ_API.products.list({ useCache:false });
      if(!r || !r.ok) return { ok:false, error: r && r.error ? r.error : 'failed_fetch' };
      const json = JSON.stringify(r.products || r.data || [], null, 2);
      downloadFile(filename, json, 'application/json');
      return { ok:true, count: (r.products || r.data || []).length };
    } catch (err) {
      return { ok:false, error: String(err) };
    }
  }

  async function bulkAddProducts(productsArray = [], opts = {}) {
    if(!Array.isArray(productsArray) || productsArray.length === 0) return { ok:false, error:'no_products' };
    const batchSize = opts.batchSize || 20;
    const results = [];
    for(let i=0;i<productsArray.length;i+=batchSize){
      const batch = productsArray.slice(i, i+batchSize);
      // Post each product sequentially (Apps Script may not accept large batch)
      for(const p of batch){
        try {
          // use addProduct helper from Part 1 if available
          if(window.NJ_API && window.NJ_API.products && window.NJ_API.products.add) {
            const res = await window.NJ_API.products.add(p);
            results.push(res);
          } else {
            const res = await window.NJ_API.post(Object.assign({ action:'addproduct' }, p));
            results.push(res);
          }
        } catch(e) {
          results.push({ ok:false, error:String(e) });
        }
      }
      // small pause to avoid rate-limits
      await new Promise(r => setTimeout(r, 300));
    }
    return { ok:true, results };
  }

  /* ============================
     Staff management helpers
     - addStaff, updateStaff, listStaff, removeStaff
     - Expects Apps Script backend to support these actions (addstaff, updatestaff, staff)
     ============================ */

  async function listStaff() {
    const res = await window.NJ_API.get({ action: 'staff' });
    return (res && res.ok) ? { ok:true, staff: res.staff || res.data || [] } : { ok:false, error: res && res.error ? res.error : 'failed' };
  }

  async function addStaff(staffObj) {
    if(!staffObj) return { ok:false, error:'missing_staff' };
    const payload = Object.assign({ action: 'addstaff' }, staffObj);
    const res = await window.NJ_API.post(payload);
    return (res && res.ok) ? res : { ok:false, error: res && res.error ? res.error : 'failed' };
  }

  async function updateStaff(staffId, patch) {
    if(!staffId || !patch) return { ok:false, error:'missing_params' };
    const payload = Object.assign({ action: 'updatestaff', id: staffId }, patch);
    const res = await window.NJ_API.post(payload);
    return (res && res.ok) ? res : { ok:false, error: res && res.error ? res.error : 'failed' };
  }

  async function removeStaff(staffId) {
    if(!staffId) return { ok:false, error:'missing_staffId' };
    const res = await window.NJ_API.post({ action:'removestaff', id: staffId });
    return (res && res.ok) ? res : { ok:false, error: res && res.error ? res.error : 'failed' };
  }

  /* ============================
     Delivery helpers
     - generateDeliveryLink(orderId, lat, lng) -> returns a google maps direction link
     - generateDeliveryToken(orderObj) -> short token that can be appended for driver verification
     - createDeliveryUrlForDriver(orderId, phone, lat, lng) -> returns a full link with order info
     ============================ */

  function generateDeliveryLink(lat, lng) {
    if(!lat || !lng) return '';
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(lat + ',' + lng)}&travelmode=driving`;
  }

  function generateDeliveryToken(orderId) {
    // simple tokenization (not secure) — for driver link convenience only
    const t = (orderId || '') + '-' + Date.now().toString(36).slice(-6);
    return btoa(t).replace(/=+$/,'');
  }

  function createDeliveryUrlForDriver({ orderId, phone, lat, lng, driverToken } = {}) {
    const base = window.location.origin || '';
    const token = driverToken || generateDeliveryToken(orderId);
    const map = (lat && lng) ? generateDeliveryLink(lat, lng) : '';
    // produce a short redirect page (you can make a special driver.html in your site)
    // Example: https://your-site/driver.html?order=XXX&token=YYY&phone=ZZZ&map=...
    const url = `${base}/driver.html?order=${encodeURIComponent(orderId||'')}&token=${encodeURIComponent(token)}&phone=${encodeURIComponent(phone||'')}` + (map ? `&map=${encodeURIComponent(map)}` : '');
    return { url, token, map };
  }

  /* ============================
     Invoice & notification helpers
     - simpleInvoiceHtml(orderObj) => returns HTML string for invoice (client-side)
     - sendInvoiceToCustomer(orderObj, via='sms'|'email') => attempts to call backend to trigger SMS/email
     ============================ */

  function simpleInvoiceHtml(order) {
    const items = order.items || order.Items || order.Item || [];
    const rows = (Array.isArray(items) ? items : (typeof items === 'string' ? JSON.parse(items || '[]') : []));

    const itemsHtml = rows.map(it => `
      <tr>
        <td style="padding:8px;border:1px solid #eee">${escapeHtml(it.name || it.Name || '')}</td>
        <td style="padding:8px;border:1px solid #eee;text-align:center">${escapeHtml(String(it.qty || it.quantity || 1))}</td>
        <td style="padding:8px;border:1px solid #eee;text-align:right">₹${Number(it.price || it.Price || 0).toFixed(0)}</td>
      </tr>
    `).join('');

    const total = Number(order.finalAmount || order.FinalAmount || order.TotalAmount || 0);

    const html = `
      <div style="font-family:Inter,system-ui,Arial">
        <h2>NJ Mart — Invoice</h2>
        <div>Order: ${escapeHtml(order.OrderID || order.orderId || '')}</div>
        <div>Date: ${escapeHtml(order.OrderDate || new Date().toLocaleString())}</div>
        <table style="width:100%;border-collapse:collapse;margin-top:12px">
          <thead>
            <tr><th style="text-align:left;padding:8px;border:1px solid #eee">Item</th><th style="padding:8px;border:1px solid #eee">Qty</th><th style="padding:8px;border:1px solid #eee">Amount</th></tr>
          </thead>
          <tbody>
            ${itemsHtml}
            <tr><td colspan="2" style="padding:8px;border:1px solid #eee;text-align:right"><strong>Total</strong></td><td style="padding:8px;border:1px solid #eee;text-align:right"><strong>₹${total.toFixed(0)}</strong></td></tr>
          </tbody>
        </table>
      </div>
    `;
    return html;
  }

  async function sendInvoiceToCustomer(orderObj, method='sms') {
    // This will call backend endpoint which should implement actual SMS/email sending
    if(!orderObj) return { ok:false, error:'missing_order' };
    const payload = { action: 'sendinvoice', method, order: orderObj };
    const res = await window.NJ_API.post(payload);
    return res;
  }

  /* ============================
     Small utility: safe escapeHtml (same as used in UI)
     ============================ */
  function escapeHtml(s){
    if(!s && s !== 0) return '';
    return (''+s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  }

  /* ============================
     Attach advanced helpers to window.NJ_API.adv
     ============================ */
  const adv = {
    // file/csv
    downloadFile,
    csvToArray,
    // images
    uploadToFirebase,
    uploadByUrlToPostImages,
    uploadImageGeneric,
    // bulk import/export
    importProductsFromCSV,
    exportProductsToJSON,
    bulkAddProducts,
    // staff
    listStaff,
    addStaff,
    updateStaff,
    removeStaff,
    // delivery
    generateDeliveryLink,
    generateDeliveryToken,
    createDeliveryUrlForDriver,
    // invoice
    simpleInvoiceHtml,
    sendInvoiceToCustomer,
    // utils
    escapeHtml
  };

  // merge into NJ_API
  if(!window.NJ_API.adv) window.NJ_API.adv = adv;
  else Object.assign(window.NJ_API.adv, adv);

  log('script-config (Part 2) loaded - advanced helpers ready');
})();
/* =========================================================================
   script-config.js — Part 3 / Admin UI + Driver + Payments
   - Admin UI helpers (render tables for products/customers/orders)
   - Driver HTML page auto integration
   - Checkout payments: UPI deep link + COD handler
   ========================================================================= */

(function(){
  'use strict';

  if(!window.NJ_API) {
    console.warn('NJ_API missing, Part 1+2 required before Part 3');
    return;
  }

  const log = (...a)=>{ if(window.NJ_CONFIG.DEBUG) console.log('[NJ_API-UI]',...a); };

  /* ============================
     ADMIN UI HELPERS
     ============================ */

  // render a generic table from array of objects
  function renderTable(container, data=[], opts={}) {
    if(!container) return;
    container.innerHTML = '';
    if(!data || data.length===0){
      container.innerHTML = '<div class="muted">No data</div>';
      return;
    }
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.innerHTML = `
      <thead>
        <tr>${Object.keys(data[0]).map(h=>`<th style="border:1px solid #eee;padding:6px;text-align:left">${escapeHtml(h)}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${data.map(row=>`
          <tr>${Object.keys(data[0]).map(h=>`<td style="border:1px solid #eee;padding:6px">${escapeHtml(row[h])}</td>`).join('')}</tr>
        `).join('')}
      </tbody>
    `;
    container.appendChild(table);
  }

  async function adminLoadProducts(containerId){
    const el = document.getElementById(containerId);
    const r = await window.NJ_API.products.list();
    if(!r.ok){ el.textContent = 'Error: '+r.error; return; }
    renderTable(el, r.products || []);
  }

  async function adminLoadCustomers(containerId){
    const el = document.getElementById(containerId);
    const r = await window.NJ_API.get({ action:'customers' });
    if(!r.ok){ el.textContent = 'Error: '+r.error; return; }
    renderTable(el, r.customers || []);
  }

  async function adminLoadOrders(containerId){
    const el = document.getElementById(containerId);
    const r = await window.NJ_API.get({ action:'orders' });
    if(!r.ok){ el.textContent = 'Error: '+r.error; return; }
    renderTable(el, r.orders || []);
  }

  /* ============================
     DRIVER PAGE HELPERS
     ============================ */
  function driverInit(){
    const params = new URLSearchParams(window.location.search);
    const order = params.get('order');
    const token = params.get('token');
    const phone = params.get('phone');
    const map = params.get('map');
    const box = document.getElementById('driverBox');
    if(!box) return;
    box.innerHTML = `
      <h2>Delivery Assignment</h2>
      <div><b>Order:</b> ${escapeHtml(order||'')}</div>
      <div><b>Token:</b> ${escapeHtml(token||'')}</div>
      <div><b>Customer Phone:</b> ${escapeHtml(phone||'')}</div>
      ${map ? `<div style="margin-top:10px"><a href="${map}" target="_blank" class="btn primary">Open Directions</a></div>` : ''}
    `;
  }

  /* ============================
     CHECKOUT PAYMENT HELPERS
     ============================ */

  function buildUpiUrl({ payee, name, amount, note }) {
    return `upi://pay?pa=${encodeURIComponent(payee)}&pn=${encodeURIComponent(name)}&am=${encodeURIComponent(amount)}&cu=INR&tn=${encodeURIComponent(note||'NJ Mart Order')}`;
  }

  function attachCheckoutHandlers({ upiId, businessName }){
    const btnUpi = document.getElementById('payUPI');
    const btnCod = document.getElementById('payCOD');
    if(btnUpi){
      btnUpi.addEventListener('click', ()=>{
        const amt = document.getElementById('finalAmount').textContent.replace(/[^\d.]/g,'') || '0';
        const url = buildUpiUrl({ payee: upiId, name: businessName||'NJ Mart', amount: amt });
        window.location.href = url;
      });
    }
    if(btnCod){
      btnCod.addEventListener('click', ()=>{
        alert('Cash on Delivery selected. Your order will be placed.');
      });
    }
  }

  /* ============================
     UTIL (reuse from Part 2)
     ============================ */
  function escapeHtml(s){
    if(!s && s!==0) return '';
    return (''+s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
  }

  /* ============================
     EXPOSE TO NJ_API.ui
     ============================ */
  window.NJ_API.ui = {
    renderTable,
    adminLoadProducts,
    adminLoadCustomers,
    adminLoadOrders,
    driverInit,
    buildUpiUrl,
    attachCheckoutHandlers
  };

  log('script-config (Part 3) loaded - UI helpers ready');
})();

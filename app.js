// app.js (ES module)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, getDocs, doc, getDoc, setDoc, addDoc, query, where, serverTimestamp, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// === Firebase config (your config) ===
const firebaseConfig = {
  apiKey: "AIzaSyCbf19k8pLFh-9UQz8sQRim2rPYTlqaEL8",
  authDomain: "njmartonline.firebaseapp.com",
  projectId: "njmartonline",
  storageBucket: "njmartonline.appspot.com",
  messagingSenderId: "594505763627",
  appId: "1:594505763627:web:a13b0d3ef40e620f9b936e"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// small helpers
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const fmt = n => (n||0).toLocaleString('en-IN');

// CART in localStorage (client-side)
function getCart(){ try{return JSON.parse(localStorage.getItem('nj_cart')||'[]')}catch(e){return []} }
function saveCart(c){ localStorage.setItem('nj_cart', JSON.stringify(c)) }
function addToCartItem(p, qty=1){
  const c = getCart(); const ix = c.findIndex(x=>x.productId==p.productId);
  if(ix>-1) c[ix].qty += qty; else c.push({...p, qty});
  saveCart(c);
}

// AUTH state update for header links
onAuthStateChanged(auth, user=>{
  const link = document.getElementById('loginLink');
  if(link){
    if(user){ link.textContent='Logout'; link.onclick = async (e)=>{ e.preventDefault(); await signOut(auth); window.location.reload(); } }
    else { link.textContent='Login'; link.href='login.html'; }
  }
});

// ---------- PRODUCTS page ----------
export async function renderProductsPage(){
  const grid = document.getElementById('productsGrid');
  const searchInput = document.getElementById('productSearch');
  const catSelect = document.getElementById('categoryFilter');
  if(!grid) return;

  // load products from Firestore
  const snap = await getDocs(collection(db,'Products'));
  const all = snap.docs.map(d => d.data()).sort((a,b)=> (a.name||'').localeCompare(b.name||''));
  const cats = Array.from(new Set(all.map(x=>x.category||''))).filter(Boolean).sort();
  // fill categories
  if(catSelect){
    catSelect.innerHTML = '<option value="">All categories</option>'+cats.map(c=>`<option value="${c}">${c}</option>`).join('');
  }

  function draw(list){
    grid.innerHTML = '';
    if(!list.length) { grid.innerHTML = '<p class="muted">No products found.</p>'; return; }
    list.forEach(p=>{
      const el = document.createElement('div'); el.className='product';
      el.innerHTML = `
        <img src="${p.imageUrl || 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=1200&auto=format&fit=crop'}" />
        <div class="pbody">
          <div><b>${p.name}</b></div>
          <div class="muted">${p.category||''}</div>
          <div class="price">₹ ${fmt(p.price)}</div>
          <div class="qty">
            <input type="number" id="qty-${p.productId}" value="1" min="1" />
            <button class="btn" data-id="${p.productId}">Add to Cart</button>
          </div>
        </div>`;
      grid.appendChild(el);
    });
  }

  // live filter
  function applyFilter(){
    const s = (searchInput?.value||'').toLowerCase();
    const cat = (catSelect?.value||'').toLowerCase();
    const filtered = all.filter(p => ((p.name||'').toLowerCase().includes(s) || (p.category||'').toLowerCase().includes(s)) && (cat? (p.category||'').toLowerCase()===cat : true));
    draw(filtered);
  }

  searchInput?.addEventListener('input', applyFilter);
  catSelect?.addEventListener('change', applyFilter);

  grid.addEventListener('click', (ev)=>{
    const btn = ev.target.closest('button[data-id]');
    if(!btn) return;
    const id = btn.getAttribute('data-id');
    const p = all.find(x=>String(x.productId)===String(id));
    const qty = parseInt(document.getElementById('qty-'+id).value||'1',10);
    addToCartItem(p, qty);
    alert('Added to cart');
  });

  // prefill from ?q=
  const qparam = (new URL(location.href)).searchParams.get('q') || '';
  if(qparam && searchInput) searchInput.value = decodeURIComponent(qparam);
  applyFilter();
}

// ---------- CART page ----------
export function renderCartPage(){
  const wrap = document.getElementById('cartItems'); if(!wrap) return;
  const items = getCart();
  wrap.innerHTML = items.map(it=>`<div class="card"><b>${it.name}</b><div class="muted">₹ ${fmt(it.price)} × ${it.qty}</div></div>`).join('');
  const subtotal = items.reduce((a,c)=>a + (c.price||0)*c.qty, 0);
  const delivery = subtotal < 1000 && subtotal>0 ? 20 : 0;
  const coupon = JSON.parse(localStorage.getItem('nj_coupon')||'null');
  const discount = coupon?.amount||0;
  $('#subtotal')?.textContent = fmt(subtotal);
  $('#deliveryFee')?.textContent = fmt(delivery);
  $('#discount')?.textContent = fmt(discount);
  $('#total')?.textContent = fmt(Math.max(0, subtotal + delivery - discount));
}

// apply coupon
window.applyCoupon = async function(){
  const code = (document.getElementById('couponCode')?.value||'').trim().toUpperCase();
  if(!code) return alert('Enter coupon');
  const qSnap = await getDocs(query(collection(db,'Coupons'), where('code','==',code), where('active','==',true)));
  if(qSnap.empty) return alert('Invalid/expired coupon');
  const c = qSnap.docs[0].data();
  localStorage.setItem('nj_coupon', JSON.stringify({code:c.code, amount:c.amount}));
  alert('Coupon applied: -₹'+c.amount);
  renderCartPage();
}

// geolocation for delivery
let lastCoords = null;
window.useMyLocation = function(){
  const status = document.getElementById('locStatus');
  if(!navigator.geolocation) return alert('Geolocation not supported');
  status.textContent = 'Getting location...';
  navigator.geolocation.getCurrentPosition(p=>{
    lastCoords = p.coords;
    status.textContent = `Location set (${p.coords.latitude.toFixed(4)},${p.coords.longitude.toFixed(4)})`;
  }, err=>{
    status.textContent = 'Location failed';
    alert('Location error: '+err.message);
  }, {timeout:10000});
}

// place order
window.placeOrder = async function(){
  const items = getCart();
  if(!items.length) return alert('Cart empty');
  const name = $('#custName')?.value?.trim();
  const phone = $('#custPhone')?.value?.trim();
  const email = $('#custEmail')?.value?.trim();
  const address = $('#custAddress')?.value?.trim();
  if(!name || !phone || !address) return alert('Fill name, phone, address');

  const subtotal = items.reduce((a,c)=>a + (c.price||0)*c.qty, 0);
  const delivery = subtotal < 1000 ? 20:0;
  const coupon = JSON.parse(localStorage.getItem('nj_coupon')||'null');
  const discount = coupon?.amount||0;
  const total = Math.max(0, subtotal + delivery - discount);

  const order = {
    orderId: 'ORD-'+Date.now(),
    items, subtotal, delivery, discount, total,
    customerName: name, customerPhone: phone, customerEmail: email||null,
    address, coords: lastCoords ? {lat:lastCoords.latitude, lng:lastCoords.longitude}:null,
    status: 'pending', orderDate: serverTimestamp()
  };

  const ref = await addDoc(collection(db,'Orders'), order);
  // clear cart
  localStorage.removeItem('nj_cart');
  localStorage.removeItem('nj_coupon');
  alert('Order placed — ID: ' + order.orderId);

  // send invoice links: open SMS (mobile) and email (mailto)
  const invoice = invoiceText(order, ref.id);
  // SMS link (prefill) — opens SMS app on mobile
  const sms = `sms:${phone}?body=${encodeURIComponent(invoice)}`;
  const mailto = `mailto:${email}?subject=${encodeURIComponent('Your NJ Mart Invoice - '+order.orderId)}&body=${encodeURIComponent(invoice)}`;

  // show options
  if(confirm('Send invoice via SMS? Click OK to open SMS app (mobile)')) {
    window.location.href = sms;
  }
  if(email && confirm('Send invoice via Email? Click OK to open your email client')) {
    window.location.href = mailto;
  }

  // redirect to orders page
  window.location.href = 'orders.html';
}

function invoiceText(order, docId){
  let s = `NJ Mart — Invoice\\nOrder: ${order.orderId}\\nItems:\\n`;
  order.items.forEach(it=> s += `${it.name} x${it.qty} — ₹${it.price*it.qty}\\n`);
  s += `Subtotal: ₹${order.subtotal}\\nDelivery: ₹${order.delivery}\\nDiscount: -₹${order.discount}\\nTotal: ₹${order.total}\\nAddress: ${order.address}\\nThanks for ordering!`;
  return s;
}

// ---------- ORDERS page ----------
export async function renderOrdersPage(){
  const box = document.getElementById('ordersList'); if(!box) return;
  const user = auth.currentUser;
  if(!user){ box.innerHTML = '<p class="muted">Please login to see your orders.</p>'; return; }
  const qSnap = await getDocs(query(collection(db,'Orders'), where('customerPhone','==', user.phoneNumber), orderBy('orderDate','desc')));
  if(qSnap.empty) { box.innerHTML = '<p class="muted">No orders yet.</p>'; return; }
  box.innerHTML = '';
  qSnap.forEach(d=>{
    const o = d.data();
    const div = document.createElement('div'); div.className='card';
    div.innerHTML = `<div><b>${o.orderId}</b> • ${o.status}</div><div class="muted">₹ ${fmt(o.total)} • ${o.items.length} items</div>`;
    box.appendChild(div);
  });
}

// ---------- ADMIN STATS ----------
export async function renderAdminStats(){
  const p = document.getElementById('statP'); const o = document.getElementById('statO'); const c = document.getElementById('statC');
  if(!p) return;
  const ps = await getDocs(collection(db,'Products'));
  const os = await getDocs(collection(db,'Orders'));
  const cs = await getDocs(collection(db,'Customers'));
  p.textContent = ps.size; o.textContent = os.size; c.textContent = cs.size;
}

// ---------- LOGIN (OTP) ----------
export function setupOtpFlow(){
  if(!document.getElementById('phone')) return;
  window.recaptchaVerifier = new RecaptchaVerifier('recaptcha-container', {size:'normal'}, auth);
  let confirmationResult = null;
  $('#sendOtpBtn').addEventListener('click', async ()=>{
    const phone = $('#phone').value.trim();
    if(!phone.startsWith('+')) return alert('Use full international format: +91XXXXXXXXXX');
    try{ confirmationResult = await signInWithPhoneNumber(auth, phone, window.recaptchaVerifier); $('#authStatus').textContent='OTP sent'; }
    catch(e){ console.error(e); alert('OTP send failed: '+e.message); }
  });
  $('#verifyOtpBtn').addEventListener('click', async ()=>{
    try{ const cred = await confirmationResult.confirm($('#otp').value.trim()); $('#authStatus').textContent='Login success'; setTimeout(()=>location.href='index.html',800); }
    catch(e){ console.error(e); alert('Invalid OTP'); }
  });
}

// ---------- BOOT / ROUTER ----------
document.addEventListener('DOMContentLoaded', ()=>{
  // call page-specific renderers
  renderProductsPage().catch(()=>{/* ignore */});
  renderCartPage();
  renderOrdersPage().catch(()=>{/* ignore */});
  renderAdminStats().catch(()=>{/* ignore */});
  setupOtpFlow();
  // wire up cart buttons
  $('#applyCouponBtn')?.addEventListener('click', applyCoupon);
  $('#placeOrderBtn')?.addEventListener('click', placeOrder);
  $('#locBtn')?.addEventListener('click', useMyLocation);
});

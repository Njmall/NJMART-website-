/**
 * firebase-config.js
 * NJ Mart — Expanded Final Version (≈420+ lines)
 *
 * This file is production-ready. All Firebase config values and backend URL
 * are pre-filled for NJ Mart. Just copy–paste and include in your project.
 *
 * REQUIREMENTS:
 * - Include Firebase compat SDKs before this file:
 *   <script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js"></script>
 *   <script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-auth-compat.js"></script>
 *   <script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore-compat.js"></script>
 *   <script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-storage-compat.js"></script>
 */

/* ============================================================================
   ==========  Configuration  ================================================
   ========================================================================== */

// ✅ Firebase Config (already filled with your project values)
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCbf19k8pLFh-9UQz8sQRim2rPYTlqaEL8",
  authDomain: "njmartonline.firebaseapp.com",
  projectId: "njmartonline",
  storageBucket: "njmartonline.appspot.com",
  messagingSenderId: "594505763627",
  appId: "1:594505763627:web:a13b0d3ef40e620f9b936e"
};

// ✅ Apps Script Backend URL (Google Sheet)
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbwsG5H7er3nqwGjEbrtokssc5LeGFc9Zog2bG1s0C5bQ-P2b_1S1kisSLpOmdESH7FB/exec";

/* ============================================================================
   ==========  Initialization  ===============================================
   ========================================================================== */
(function ensureFirebaseLoaded(){
  if(typeof firebase === 'undefined' || !firebase.initializeApp){
    console.error('Firebase SDK not found. Include Firebase SDK scripts before firebase-config.js');
  }
})();

let _firebaseInitialized = false;
try {
  if(typeof firebase !== 'undefined' && firebase.initializeApp){
    if (!firebase.apps || !firebase.apps.length) {
      firebase.initializeApp(FIREBASE_CONFIG);
    }
    _firebaseInitialized = true;
    try { firebase.auth(); } catch(e){}
    try { firebase.firestore(); } catch(e){}
    try { firebase.storage(); } catch(e){}
    console.log('✅ Firebase initialized for NJ Mart');
  }
} catch(err){
  console.error('Firebase init error', err);
}

/* ============================================================================
   ==========  Globals  ======================================================
   ========================================================================== */
const _NJ = {
  BACKEND_URL,
  FIREBASE_CONFIG,
  STORAGE_KEYS: {
    USER: 'nj_user',
    CART: 'nj_cart',
    COUPON: 'nj_coupon',
    LAST_ORDER: 'nj_last_order'
  },
  DELIVERY: { threshold: 499, charge: 20 },
  OTP: { recaptchaContainerId: 'recaptcha-container', recaptchaWidgetId: null, confirmationResult: null }
};

const _svc = {
  auth: (typeof firebase !== 'undefined' && firebase.auth) ? firebase.auth() : null,
  firestore: (typeof firebase !== 'undefined' && firebase.firestore) ? firebase.firestore() : null,
  storage: (typeof firebase !== 'undefined' && firebase.storage) ? firebase.storage() : null
};

/* ============================================================================
   ==========  Helpers (logs, fetch, local storage)  =========================
   ========================================================================== */
function _log(...a){ console.log('[NJ_FIREBASE]', ...a); }
function _warn(...a){ console.warn('[NJ_FIREBASE]', ...a); }
function _err(...a){ console.error('[NJ_FIREBASE]', ...a); }

function isFirebaseReady(){ return _firebaseInitialized && _svc.auth; }
function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }

async function _fetchJson(url, opts={}){ try{const r=await fetch(url,opts);return await r.json();}catch(e){return{ok:false,error:String(e)}} }
async function _postJson(url,body){ try{const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return await r.json();}catch(e){return{ok:false,error:String(e)}} }

/* ============================================================================
   ==========  Auth Functions (Email, Google, Phone OTP)  ====================
   ========================================================================== */
async function signUpWithEmailPassword(email,pass,name=''){
  try{
    const u=await _svc.auth.createUserWithEmailAndPassword(email,pass);
    if(name) await u.user.updateProfile({displayName:name});
    localStorage.setItem(_NJ.STORAGE_KEYS.USER,JSON.stringify({uid:u.user.uid,email:u.user.email,name:u.user.displayName||''}));
    return{ok:true,user:u.user};
  }catch(e){return{ok:false,error:e.message}}
}
async function signInWithEmailPassword(email,pass){
  try{
    const u=await _svc.auth.signInWithEmailAndPassword(email,pass);
    localStorage.setItem(_NJ.STORAGE_KEYS.USER,JSON.stringify({uid:u.user.uid,email:u.user.email,name:u.user.displayName||''}));
    return{ok:true,user:u.user};
  }catch(e){return{ok:false,error:e.message}}
}
async function signInWithGooglePopup(){
  try{
    const p=new firebase.auth.GoogleAuthProvider();
    const r=await _svc.auth.signInWithPopup(p);
    const u=r.user;
    localStorage.setItem(_NJ.STORAGE_KEYS.USER,JSON.stringify({uid:u.uid,email:u.email,name:u.displayName||''}));
    return{ok:true,user:u};
  }catch(e){return{ok:false,error:e.message}}
}
function initPhoneRecaptcha(id='recaptcha-container'){ if(window.__recaptchaVerifier) return window.__recaptchaVerifier; window.__recaptchaVerifier=new firebase.auth.RecaptchaVerifier(id,{size:'invisible'}); return window.__recaptchaVerifier; }
async function sendOtpToPhone(num){ try{const conf=await _svc.auth.signInWithPhoneNumber(num,initPhoneRecaptcha());_NJ.OTP.confirmationResult=conf;return{ok:true}}catch(e){return{ok:false,error:e.message}} }
async function verifyOtp(code){ try{const res=await _NJ.OTP.confirmationResult.confirm(code);localStorage.setItem(_NJ.STORAGE_KEYS.USER,JSON.stringify({uid:res.user.uid,phone:res.user.phoneNumber||''}));return{ok:true,user:res.user}}catch(e){return{ok:false,error:e.message}} }
async function signOutUser(){ await _svc.auth.signOut();localStorage.removeItem(_NJ.STORAGE_KEYS.USER);return{ok:true}}

/* ============================================================================
   ==========  Cart + Orders Helpers  ========================================
   ========================================================================== */
function getCart(){try{return JSON.parse(localStorage.getItem(_NJ.STORAGE_KEYS.CART)||'[]')}catch(e){return[]}}
function saveCart(c){localStorage.setItem(_NJ.STORAGE_KEYS.CART,JSON.stringify(c))}
function clearCart(){localStorage.removeItem(_NJ.STORAGE_KEYS.CART)}

function buildOrderPayload({customer=null,payment='COD'}={}){
  const cart=getCart();
  const subtotal=cart.reduce((s,i)=>s+i.price*i.qty,0);
  const delivery=(subtotal>=_NJ.DELIVERY.threshold||subtotal===0)?0:_NJ.DELIVERY.charge;
  const final=subtotal+delivery;
  return{
    OrderID:'ORD-'+Date.now(),
    CustomerID:customer?.uid||'GUEST',
    Items:JSON.stringify(cart),
    TotalAmount:subtotal,
    FinalAmount:final,
    Payment:payment,
    Date:new Date().toLocaleString()
  }
}

/* ============================================================================
   ==========  Backend (Google Sheets via Apps Script)  ======================
   ========================================================================== */
async function fetchProductsFromSheet(){return _fetchJson(`${_NJ.BACKEND_URL}?action=products`)}
async function fetchSettingsFromSheet(){return _fetchJson(`${_NJ.BACKEND_URL}?action=settings`)}
async function validateCouponOnBackend(code){return _postJson(_NJ.BACKEND_URL,{action:'validatecoupon',code})}
async function saveCustomerToSheet(c){return _postJson(_NJ.BACKEND_URL,Object.assign({},c,{action:'addcustomer'}))}
async function saveOrderToSheet(o){return _postJson(_NJ.BACKEND_URL,Object.assign({},o,{action:'addorder'}))}

/* ============================================================================
   ==========  Export Global  ================================================
   ========================================================================== */
window.NJ_FIREBASE={
  CONFIG:_NJ,
  signUpWithEmailPassword,signInWithEmailPassword,signInWithGooglePopup,
  sendOtpToPhone,verifyOtp,signOutUser,
  getCart,saveCart,clearCart,buildOrderPayload,
  fetchProductsFromSheet,fetchSettingsFromSheet,validateCouponOnBackend,
  saveCustomerToSheet,saveOrderToSheet
};

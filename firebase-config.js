// firebase-config.js
// Full expanded version with your Firebase config + helper functions

/////////////////////////////////////////
// Imports - Firebase modular SDK v9+
/////////////////////////////////////////
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut as fbSignOut,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  setDoc,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

import {
  getStorage,
  ref as storageRef,
  uploadBytesResumable,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js";

/////////////////////////////////////////
// 1) तुमारा Firebase config
/////////////////////////////////////////
const firebaseConfig = {
  apiKey: "AIzaSyCbf19k8pLFh-9UQz8sQRim2rPYTlqaEL8",
  authDomain: "njmartonline.firebaseapp.com",
  projectId: "njmartonline",
  storageBucket: "njmartonline.firebasestorage.app",
  messagingSenderId: "594505763627",
  appId: "1:594505763627:web:a13b0d3ef40e620f9b936e"
};

/////////////////////////////////////////
// 2) Initialize Firebase
/////////////////////////////////////////
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

/////////////////////////////////////////
// 3) Auth helpers
/////////////////////////////////////////
export async function signInWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    return { ok: true, result };
  } catch (err) {
    console.error("signInWithGoogle error:", err);
    return { ok: false, error: err.message || err };
  }
}

export async function signOutUser() {
  try {
    await fbSignOut(auth);
    return { ok: true };
  } catch (err) {
    console.error("signOut error:", err);
    return { ok: false, error: err.message || err };
  }
}

export function setupRecaptcha(containerId = 'recaptcha-container', size = 'invisible') {
  try {
    const verifier = new RecaptchaVerifier(containerId, { size }, auth);
    verifier.render();
    return verifier;
  } catch (err) {
    console.warn("setupRecaptcha failed:", err);
    return null;
  }
}

export async function sendOtp(phoneNumber, recaptchaVerifier) {
  try {
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
    return { ok: true, confirmationResult };
  } catch (err) {
    console.error("sendOtp error:", err);
    return { ok: false, error: err.message || err };
  }
}

export async function verifyOtpAndSignIn(confirmationResult, code) {
  try {
    const credential = await confirmationResult.confirm(code);
    return { ok: true, credential, user: credential.user };
  } catch (err) {
    console.error("verifyOtp error:", err);
    return { ok: false, error: err.message || err };
  }
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

/////////////////////////////////////////
// 4) Firestore helpers
/////////////////////////////////////////
export async function createOrUpdateCustomer(customer) {
  try {
    const id = customer.id || (`c_${Date.now()}`);
    const ref = doc(db, "customers", id);
    await setDoc(ref, {
      uid: id,
      name: customer.name || "",
      email: customer.email || "",
      phone: customer.phone || "",
      address: customer.address || "",
      lat: customer.lat || "",
      lng: customer.lng || "",
      updatedAt: serverTimestamp()
    }, { merge: true });
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: err.message || err };
  }
}

export async function addProduct(product) {
  try {
    const coll = collection(db, "products");
    const docRef = await addDoc(coll, {
      name: product.name || "",
      price: Number(product.price || 0),
      stock: Number(product.stock || 0),
      category: product.category || "",
      image: product.image || "",
      createdAt: serverTimestamp()
    });
    return { ok: true, id: docRef.id };
  } catch (err) {
    return { ok: false, error: err.message || err };
  }
}

export async function getProducts(limitCount = 200) {
  try {
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"), limit(limitCount));
    const snap = await getDocs(q);
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    return { ok: true, data: items };
  } catch (err) {
    return { ok: false, error: err.message || err };
  }
}

export async function addOrder(order) {
  try {
    const coll = collection(db, "orders");
    const docRef = await addDoc(coll, {
      orderId: order.id || ('ORD_' + Date.now()),
      userId: order.userId || "",
      items: order.items || [],
      subtotal: Number(order.subtotal || 0),
      deliveryCharge: Number(order.deliveryCharge || 0),
      total: Number(order.total || 0),
      status: order.status || "placed",
      createdAt: serverTimestamp()
    });
    return { ok: true, id: docRef.id };
  } catch (err) {
    return { ok: false, error: err.message || err };
  }
}

export async function getOrdersForUser(userId) {
  try {
    const q = query(collection(db, "orders"), where("userId", "==", userId), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    const items = [];
    snap.forEach(d => items.push({ id: d.id, ...d.data() }));
    return { ok: true, data: items };
  } catch (err) {
    return { ok: false, error: err.message || err };
  }
}

/////////////////////////////////////////
// 5) Storage helpers
/////////////////////////////////////////
export async function uploadFile(file, path) {
  try {
    const sRef = storageRef(storage, path);
    const uploadTask = uploadBytesResumable(sRef, file);
    const url = await new Promise((resolve, reject) => {
      uploadTask.on("state_changed", null, reject, async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        resolve(downloadURL);
      });
    });
    return { ok: true, url };
  } catch (err) {
    return { ok: false, error: err.message || err };
  }
}

/////////////////////////////////////////
// 6) Utilities
/////////////////////////////////////////
export async function safeGetDoc(collectionName, docId) {
  try {
    const d = await getDoc(doc(db, collectionName, docId));
    if (!d.exists()) return { ok: false, error: "Not found" };
    return { ok: true, data: { id: d.id, ...d.data() } };
  } catch (err) {
    return { ok: false, error: err.message || err };
  }
}

export function formatTS(ts) {
  try {
    const d = (ts.toDate) ? ts.toDate() : new Date(ts);
    return d.toLocaleString();
  } catch (e) {
    return "";
  }
}

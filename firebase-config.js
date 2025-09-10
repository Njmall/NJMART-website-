// firebase-config.js
// Place in web root. Import in html pages with: <script type="module" src="/firebase-config.js"></script>
// Uses modular Firebase v9+.
//
// IMPORTANT:
// - Replace firebaseConfig below with your project's config from Firebase console if different.
// - This file exports `auth`, `db`, and helper functions for convenience.

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  setDoc,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

// ----- REPLACE this config with yours if needed -----
const firebaseConfig = {
  apiKey: "AIzaSyCbf19k8pLFh-9UQz8sQRim2rPYTlqaEL8",
  authDomain: "njmartonline.firebaseapp.com",
  projectId: "njmartonline",
  storageBucket: "njmartonline.firebasestorage.app",
  messagingSenderId: "594505763627",
  appId: "1:594505763627:web:a13b0d3ef40e620f9b936e"
};
// ---------------------------------------------------

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// convenience helpers
export function onAuth(cb) { onAuthStateChanged(auth, cb); }
export function signOutUser() { return signOut(auth); }
export { signInWithPhoneNumber, RecaptchaVerifier, GoogleAuthProvider, signInWithPopup };

// small caching helper for products (optional)
export async function loadProductsOnce(limitCount = 200) {
  const col = collection(db, "products");
  const q = query(col, orderBy("name"), limit(limitCount));
  const snap = await getDocs(q);
  const arr = [];
  snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
  return arr;
}

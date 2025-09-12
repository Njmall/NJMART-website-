const firebaseConfig = {
  apiKey: "AIzaSyXXXXXX-YourKey",
  authDomain: "njmartonline.firebaseapp.com",
  projectId: "njmartonline",
  storageBucket: "njmartonline.appspot.com",
  messagingSenderId: "594505763627",
  appId: "1:594505763627:web:a13b0d3ef40e620f9b936e"
};

// ========== INITIALIZE APP ==========
firebase.initializeApp(firebaseConfig);

// ========== FIREBASE SERVICES ==========
const auth = firebase.auth();
const db   = firebase.firestore();
const storage = firebase.storage();

// ========== GOOGLE SHEET BACKEND ==========
const BACKEND_URL = "https://script.google.com/macros/s/AKfycbwsG5H7er3nqwGjEbrtokssc5LeGFc9Zog2bG1s0C5bQ-P2b_1S1kisSLpOmdESH7FB/exec";

// ========== UTILITIES ==========
function toast(msg, ms=2000){
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.position = "fixed";
  t.style.left = "50%";
  t.style.top = "18px";
  t.style.transform = "translateX(-50%)";
  t.style.background = "rgba(0,0,0,0.8)";
  t.style.color = "#fff";
  t.style.padding = "8px 12px";
  t.style.borderRadius = "8px";
  t.style.zIndex = "9999";
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), ms);
}

// ========== AUTH STATE LISTENER ==========
auth.onAuthStateChanged(user=>{
  if(user){
    console.log("✅ User signed in:", user.email);
    localStorage.setItem("nj_user", JSON.stringify({
      uid: user.uid,
      name: user.displayName || "",
      email: user.email,
      phone: user.phoneNumber || ""
    }));
    updateAccountUI(true);
  } else {
    console.log("ℹ️ User signed out");
    localStorage.removeItem("nj_user");
    updateAccountUI(false);
  }
});

// ========== UPDATE ACCOUNT BUTTON ==========
function updateAccountUI(isLogged){
  const label = document.getElementById("accountLabel");
  if(!label) return;
  label.textContent = isLogged ? "My Account" : "Login";
}

// ========== SIGN UP WITH GOOGLE ==========
async function signInWithGoogle(){
  try{
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await auth.signInWithPopup(provider);
    const user = result.user;
    console.log("Google Sign-In:", user.email);

    // Sync to backend
    await saveCustomerToSheet(user);

    toast("Welcome " + (user.displayName || user.email));
  }catch(err){
    console.error("Google sign-in error", err);
    toast("Login failed: " + err.message);
  }
}

// ========== SIGN OUT ==========
async function signOut(){
  try{
    await auth.signOut();
    toast("Signed out");
  }catch(err){
    console.error("Sign out error", err);
    toast("Error signing out: " + err.message);
  }
}

// ========== SAVE CUSTOMER TO GOOGLE SHEET ==========
async function saveCustomerToSheet(user){
  try{
    const payload = {
      action: "addcustomer",
      CustomerID: user.uid,
      Name: user.displayName || "",
      Email: user.email || "",
      Phone: user.phoneNumber || "",
      Address: "",   // update later from profile.html
      "Total order": 0
    };
    await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
    console.log("Customer synced:", user.email);
  }catch(err){
    console.error("Customer sync error", err);
  }
}

// ========== GET PRODUCTS FROM SHEET ==========
async function fetchProducts(){
  try{
    const url = BACKEND_URL + "?action=products";
    const res = await fetch(url);
    const data = await res.json();
    if(data.ok){
      return data.products;
    }else{
      throw new Error(data.error || "Unknown error");
    }
  }catch(err){
    console.error("Fetch products error", err);
    toast("Failed to load products");
    return [];
  }
}

// ========== SAVE ORDER TO SHEET ==========
async function saveOrder(order){
  try{
    const payload = Object.assign({}, order, { action:"addorder" });
    const res = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type":"application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if(!data.ok) throw new Error(data.error);
    console.log("Order saved:", data);
    return data;
  }catch(err){
    console.error("Save order error", err);
    toast("Order save failed");
    return null;
  }
}

// ========== UPLOAD IMAGE TO FIREBASE STORAGE ==========
async function uploadImage(file, path){
  try{
    const ref = storage.ref().child(path);
    await ref.put(file);
    const url = await ref.getDownloadURL();
    return url;
  }catch(err){
    console.error("Image upload error", err);
    toast("Upload failed");
    return "";
  }
}

// ========== LISTEN TO PRODUCTS IN FIRESTORE ==========
function listenProductsRealtime(callback){
  return db.collection("products").onSnapshot(snapshot=>{
    const arr = [];
    snapshot.forEach(doc=>{
      arr.push(Object.assign({id:doc.id}, doc.data()));
    });
    callback(arr);
  });
}

// ========== FIRESTORE SAVE PRODUCT ==========
async function saveProductToFirestore(prod){
  try{
    if(prod.id){
      await db.collection("products").doc(prod.id).set(prod, { merge:true });
    } else {
      await db.collection("products").add(prod);
    }
    console.log("Product saved to Firestore");
  }catch(err){
    console.error("Product save error", err);
  }
}

// ========== FIRESTORE DELETE PRODUCT ==========
async function deleteProductFromFirestore(id){
  try{
    await db.collection("products").doc(id).delete();
    console.log("Product deleted from Firestore");
  }catch(err){
    console.error("Delete error", err);
  }
}

// ========== SYNC FIRESTORE TO SHEET ==========
async function syncProductsToSheet(){
  try{
    const snapshot = await db.collection("products").get();
    const arr = [];
    snapshot.forEach(doc=> arr.push(doc.data()));
    // Batch upload to sheet if needed
    for(const p of arr){
      await fetch(BACKEND_URL, {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body: JSON.stringify(Object.assign({action:"addproduct"}, p))
      });
    }
    console.log("Products synced to Sheet");
  }catch(err){
    console.error("Sync error", err);
  }
}

// ========== HELPER: CURRENT USER ==========
function getCurrentUser(){
  try{
    return JSON.parse(localStorage.getItem("nj_user")||"null");
  }catch(e){
    return null;
  }
}

// ========== EXPORT ==========
window.NJ_FIREBASE = {
  auth,
  db,
  storage,
  signInWithGoogle,
  signOut,
  saveCustomerToSheet,
  fetchProducts,
  saveOrder,
  uploadImage,
  listenProductsRealtime,
  saveProductToFirestore,
  deleteProductFromFirestore,
  syncProductsToSheet,
  getCurrentUser
};

/*******************************************************
 * END OF FILE
 *******************************************************/

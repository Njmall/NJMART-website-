/**************************************************************
 *  NJ Mart - Firebase Config & Initialization
 *  Complete Setup for Firebase SDKs using CDN (Netlify friendly)
 *  Includes: Authentication, Firestore Database, Storage
 **************************************************************/

// ------------------------- Firebase SDK -------------------------
/*
  Important: Make sure in your HTML (login.html, index.html, admin.html etc.)
  you add these BEFORE this firebase-config.js

  <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.23.0/firebase-storage.js"></script>
*/

console.log("[NJ_FIREBASE] Loading firebase-config.js ...");

// ------------------------- Config -------------------------
const firebaseConfig = {
    apiKey: "AIzaSyCbf19k8pLFh-9UQz8sQRim2PYT1qaEL8",
    authDomain: "njmartonline.firebaseapp.com",
    projectId: "njmartonline",
    storageBucket: "njmartonline.appspot.com",
    messagingSenderId: "594505763627",
    appId: "1:594505763627:web:a13b0d3ef40e620f9b936e"
};

// ------------------------- Initialization -------------------------
let app, auth, db, storage;

try {
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    storage = firebase.storage();
    console.log("[NJ_FIREBASE] Firebase initialized successfully for NJ Mart");
} catch (err) {
    console.error("[NJ_FIREBASE] Error initializing Firebase: ", err);
}

// ------------------------- Authentication Helpers -------------------------

/**
 * Sign up with email & password
 */
async function njSignup(email, password) {
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        console.log("[NJ_FIREBASE] User signed up:", userCredential.user.uid);
        return userCredential.user;
    } catch (error) {
        console.error("[NJ_FIREBASE] Signup Error:", error.message);
        throw error;
    }
}

/**
 * Sign in with email & password
 */
async function njLogin(email, password) {
    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        console.log("[NJ_FIREBASE] User logged in:", userCredential.user.uid);
        return userCredential.user;
    } catch (error) {
        console.error("[NJ_FIREBASE] Login Error:", error.message);
        throw error;
    }
}

/**
 * Logout
 */
async function njLogout() {
    try {
        await auth.signOut();
        console.log("[NJ_FIREBASE] User logged out");
    } catch (error) {
        console.error("[NJ_FIREBASE] Logout Error:", error.message);
    }
}

/**
 * Auth state listener
 */
auth.onAuthStateChanged(user => {
    if (user) {
        console.log("[NJ_FIREBASE] Auth state: Logged in as", user.email);
    } else {
        console.log("[NJ_FIREBASE] Auth state: No user logged in");
    }
});
/**************************************************************
 *  NJ Mart - Firestore Database Helpers
 *  Collections: Products, Orders, Customers
 **************************************************************/

// ------------------------- Products -------------------------

/**
 * Add a new product
 */
async function addProduct(product) {
    try {
        const docRef = await db.collection("products").add(product);
        console.log("[NJ_FIREBASE] Product added with ID: ", docRef.id);
        return docRef.id;
    } catch (error) {
        console.error("[NJ_FIREBASE] Error adding product: ", error.message);
        throw error;
    }
}

/**
 * Get all products
 */
async function getProducts() {
    try {
        const snapshot = await db.collection("products").get();
        let products = [];
        snapshot.forEach(doc => {
            products.push({ id: doc.id, ...doc.data() });
        });
        console.log("[NJ_FIREBASE] Products loaded:", products.length);
        return products;
    } catch (error) {
        console.error("[NJ_FIREBASE] Error fetching products:", error.message);
        throw error;
    }
}

/**
 * Update product by ID
 */
async function updateProduct(productId, data) {
    try {
        await db.collection("products").doc(productId).update(data);
        console.log("[NJ_FIREBASE] Product updated:", productId);
    } catch (error) {
        console.error("[NJ_FIREBASE] Error updating product:", error.message);
        throw error;
    }
}

/**
 * Delete product by ID
 */
async function deleteProduct(productId) {
    try {
        await db.collection("products").doc(productId).delete();
        console.log("[NJ_FIREBASE] Product deleted:", productId);
    } catch (error) {
        console.error("[NJ_FIREBASE] Error deleting product:", error.message);
        throw error;
    }
}

// ------------------------- Orders -------------------------

/**
 * Place a new order
 */
async function addOrder(order) {
    try {
        const docRef = await db.collection("orders").add(order);
        console.log("[NJ_FIREBASE] Order placed with ID:", docRef.id);
        return docRef.id;
    } catch (error) {
        console.error("[NJ_FIREBASE] Error placing order:", error.message);
        throw error;
    }
}

/**
 * Get all orders
 */
async function getOrders() {
    try {
        const snapshot = await db.collection("orders").get();
        let orders = [];
        snapshot.forEach(doc => {
            orders.push({ id: doc.id, ...doc.data() });
        });
        console.log("[NJ_FIREBASE] Orders loaded:", orders.length);
        return orders;
    } catch (error) {
        console.error("[NJ_FIREBASE] Error fetching orders:", error.message);
        throw error;
    }
}

/**
 * Update order status
 */
async function updateOrder(orderId, data) {
    try {
        await db.collection("orders").doc(orderId).update(data);
        console.log("[NJ_FIREBASE] Order updated:", orderId);
    } catch (error) {
        console.error("[NJ_FIREBASE] Error updating order:", error.message);
        throw error;
    }
}

// ------------------------- Customers -------------------------

/**
 * Add new customer
 */
async function addCustomer(customer) {
    try {
        const docRef = await db.collection("customers").add(customer);
        console.log("[NJ_FIREBASE] Customer added with ID:", docRef.id);
        return docRef.id;
    } catch (error) {
        console.error("[NJ_FIREBASE] Error adding customer:", error.message);
        throw error;
    }
}

/**
 * Get all customers
 */
async function getCustomers() {
    try {
        const snapshot = await db.collection("customers").get();
        let customers = [];
        snapshot.forEach(doc => {
            customers.push({ id: doc.id, ...doc.data() });
        });
        console.log("[NJ_FIREBASE] Customers loaded:", customers.length);
        return customers;
    } catch (error) {
        console.error("[NJ_FIREBASE] Error fetching customers:", error.message);
        throw error;
    }
}
/**************************************************************
 *  NJ Mart - Firebase Storage + Admin Utilities
 **************************************************************/

// ------------------------- Storage -------------------------

/**
 * Upload image to Firebase Storage
 * @param {File} file - image file
 * @param {String} path - storage folder path (e.g., "products/")
 */
async function uploadImage(file, path = "uploads/") {
    try {
        const storageRef = storage.ref(`${path}${Date.now()}_${file.name}`);
        await storageRef.put(file);
        const url = await storageRef.getDownloadURL();
        console.log("[NJ_FIREBASE] Image uploaded:", url);
        return url;
    } catch (error) {
        console.error("[NJ_FIREBASE] Error uploading image:", error.message);
        throw error;
    }
}

/**
 * Delete image from Firebase Storage
 * @param {String} fileUrl - full image URL
 */
async function deleteImage(fileUrl) {
    try {
        const fileRef = storage.refFromURL(fileUrl);
        await fileRef.delete();
        console.log("[NJ_FIREBASE] Image deleted:", fileUrl);
    } catch (error) {
        console.error("[NJ_FIREBASE] Error deleting image:", error.message);
        throw error;
    }
}

// ------------------------- Admin Utilities -------------------------

/**
 * Add new admin
 */
async function addAdmin(email) {
    try {
        const docRef = await db.collection("admins").add({ email });
        console.log("[NJ_FIREBASE] Admin added:", email);
        return docRef.id;
    } catch (error) {
        console.error("[NJ_FIREBASE] Error adding admin:", error.message);
        throw error;
    }
}

/**
 * Get all admins
 */
async function getAdmins() {
    try {
        const snapshot = await db.collection("admins").get();
        let admins = [];
        snapshot.forEach(doc => {
            admins.push({ id: doc.id, ...doc.data() });
        });
        console.log("[NJ_FIREBASE] Admins loaded:", admins.length);
        return admins;
    } catch (error) {
        console.error("[NJ_FIREBASE] Error fetching admins:", error.message);
        throw error;
    }
}

/**
 * Delete admin
 */
async function deleteAdmin(adminId) {
    try {
        await db.collection("admins").doc(adminId).delete();
        console.log("[NJ_FIREBASE] Admin deleted:", adminId);
    } catch (error) {
        console.error("[NJ_FIREBASE] Error deleting admin:", error.message);
        throw error;
    }
}

// ------------------------- Utility Functions -------------------------

/**
 * Generic Error Logger
 */
function logError(error, context = "") {
    console.error(`[NJ_FIREBASE] ERROR in ${context}:`, error.message);
    // Optional: push error logs to Firestore
    db.collection("logs").add({
        context,
        error: error.message,
        time: new Date().toISOString()
    });
}

/**
 * Health Check - Ensure Firebase connected
 */
async function healthCheck() {
    try {
        await db.collection("health").doc("status").set({
            updatedAt: new Date().toISOString(),
            status: "OK"
        });
        console.log("[NJ_FIREBASE] Health check OK");
    } catch (error) {
        logError(error, "healthCheck");
    }
}

/**************************************************************
 *  NJ Mart Firebase Config - Completed
 *  Part 1: Auth + Config
 *  Part 2: Firestore (Products, Orders, Customers)
 *  Part 3: Storage + Admin Utilities + Error Handling
 **************************************************************/
console.log("[NJ_FIREBASE] Firebase Config fully loaded ✅");

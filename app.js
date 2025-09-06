// 🛒 Sample Products (later replace with Firestore fetch)
const products = [
  { id: 1, name: "Fresh Tomatoes", price: 40, img: "assets/tomato.jpg", category: "Vegetables" },
  { id: 2, name: "Milk (1L)", price: 55, img: "assets/milk.jpg", category: "Dairy" },
  { id: 3, name: "Apples (1kg)", price: 120, img: "assets/apple.jpg", category: "Fruits" },
  { id: 4, name: "Cold Drink", price: 35, img: "assets/coke.jpg", category: "Beverages" },
  { id: 5, name: "Chips", price: 20, img: "assets/chips.jpg", category: "Snacks" }
];

let cart = [];

// 📦 Load Products
function loadProducts() {
  const grid = document.getElementById("productGrid");
  if (!grid) return;
  grid.innerHTML = "";
  products.forEach(p => {
    let card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <img src="${p.img}" alt="${p.name}">
      <h3>${p.name}</h3>
      <div class="price">₹${p.price}</div>
      <button onclick="addToCart(${p.id})">Add to Cart</button>
    `;
    grid.appendChild(card);
  });
}

// 🛒 Add to Cart
function addToCart(id) {
  const item = products.find(p => p.id === id);
  const existing = cart.find(p => p.id === id);
  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ ...item, qty: 1 });
  }
  updateCart();
}

// 🛒 Update Cart UI
function updateCart() {
  document.getElementById("cartCount").innerText = cart.reduce((a,c)=>a+c.qty,0);
  const list = document.getElementById("cartList");
  list.innerHTML = "";
  let subtotal = 0;
  cart.forEach(item => {
    subtotal += item.price * item.qty;
    let row = document.createElement("div");
    row.innerHTML = `
      ${item.name} x ${item.qty} = ₹${item.price * item.qty}
      <button onclick="removeFromCart(${item.id})">❌</button>
    `;
    list.appendChild(row);
  });

  let delivery = subtotal < 1000 && subtotal > 0 ? 20 : 0;
  document.getElementById("sub").innerText = subtotal;
  document.getElementById("del").innerText = delivery;
  document.getElementById("totalAmt").innerText = subtotal + delivery;
}

// ❌ Remove from Cart
function removeFromCart(id) {
  cart = cart.filter(p => p.id !== id);
  updateCart();
}

// 🔍 Global Search
const search = document.getElementById("globalSearch");
if (search) {
  search.addEventListener("input", e => {
    const val = e.target.value.toLowerCase();
    const grid = document.getElementById("productGrid");
    grid.innerHTML = "";
    products
      .filter(p => p.name.toLowerCase().includes(val))
      .forEach(p => {
        let card = document.createElement("div");
        card.className = "product-card";
        card.innerHTML = `
          <img src="${p.img}" alt="${p.name}">
          <h3>${p.name}</h3>
          <div class="price">₹${p.price}</div>
          <button onclick="addToCart(${p.id})">Add to Cart</button>
        `;
        grid.appendChild(card);
      });
  });
}

// 🛒 Cart Panel Toggle
const cartBtn = document.getElementById("cartBtn");
const cartPanel = document.getElementById("cartPanel");
if (cartBtn && cartPanel) {
  cartBtn.addEventListener("click", () => {
    cartPanel.classList.toggle("active");
  });
}

// 🚀 Init
loadProducts();

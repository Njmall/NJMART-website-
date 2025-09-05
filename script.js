document.getElementById('searchInput').addEventListener('keyup', function() {
  let filter = this.value.toLowerCase();
  let products = document.querySelectorAll('.product-card');
  
  products.forEach(product => {
    let name = product.getAttribute('data-name').toLowerCase();
    let category = product.getAttribute('data-category').toLowerCase();
    if (name.includes(filter) || category.includes(filter)) {
      product.style.display = 'block';
    } else {
      product.style.display = 'none';
    }
  });
});

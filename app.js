/* ========================================
   CV LUXURY SHOP - Application Logic
   ======================================== */

// ── Product Data (shared from data.js) ──
const products = PRODUCTS;

// ── Application State ──
const state = {
  cart: JSON.parse(localStorage.getItem('cv_cart') || '[]'),
  wishlist: JSON.parse(localStorage.getItem('cv_wishlist') || '[]'),
  modalProduct: null,
  modalQty: 1,
  selectedSize: null
};

// ── DOM Elements ──
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

// ── Initialize App ──
document.addEventListener('DOMContentLoaded', async () => {
  updateCartUI();
  updateWishlistUI();
  initEventListeners();
  await loadCatalogue();
  renderProducts();
  initScrollEffects();
});

// ── Render Products ──
function renderProducts() {
  const readyStock = products.filter(p => p.badge === 'in-stock');
  const newArrivals = products.filter(p => p.badge === 'new' || p.badge === 'sale');
  const bestSellers = [products[0], products[3], products[5], products[9]].filter(Boolean);

  renderProductGrid('readyStockGrid', readyStock.slice(0, 8));
  renderProductGrid('newArrivalsGrid', [...newArrivals, ...readyStock.slice(0, 2)].slice(0, 8));
  renderProductGrid('bestSellersGrid', bestSellers);
}

function renderProductGrid(containerId, items) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = items.map(product => {
    const discount = Math.round((1 - product.price / product.originalPrice) * 100);
    const isWished = state.wishlist.includes(product.id);
    const outOfStock = productOutOfStock(product);
    let badgeClass = product.badge === 'in-stock' ? 'stock' : product.badge === 'sale' ? 'sale' : 'new';
    let badgeText = product.badge === 'in-stock' ? 'IN-STOCK' : product.badge === 'sale' ? `${discount}% OFF` : 'NEW';
    if (outOfStock) { badgeClass = 'sale'; badgeText = 'OUT OF STOCK'; }

    return `
      <div class="product-card" data-id="${product.id}">
        <span class="product-card__badge product-card__badge--${badgeClass}">${badgeText}</span>
        <button class="product-card__wishlist ${isWished ? 'active' : ''}" data-id="${product.id}" aria-label="Add to wishlist">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="${isWished ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
        </button>
        <a href="product.html?id=${product.id}" class="product-card__image">
          <img src="${product.image}" alt="${product.name}" loading="lazy" width="500" height="500">
          <div class="product-card__quick-view">
            <button onclick="event.preventDefault(); event.stopPropagation(); openProductModal(${product.id})">Quick View</button>
          </div>
        </a>
        <div class="product-card__info">
          <h3 class="product-card__title">
            <a href="product.html?id=${product.id}">${product.name}</a>
          </h3>
          <div class="product-card__price">
            <span class="current">${product.price.toLocaleString()}৳</span>
            <span class="original">${product.originalPrice.toLocaleString()}৳</span>
            <span class="discount">-${discount}%</span>
          </div>
        </div>
        <div class="product-card__colors">
          ${product.colors.map((c, i) => `<span class="color-dot ${i === 0 ? 'active' : ''}" style="background:${c.color}"></span>`).join('')}
        </div>
        <div class="product-card__actions">
          <button class="product-card__add-to-cart" onclick="addToCart(${product.id})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            Add to Cart
          </button>
          <button class="product-card__buy-now" onclick="buyNow(${product.id})">Buy Now</button>
        </div>
      </div>
    `;
  }).join('');
}

// ── Cart Functions ──
function addToCart(productId, qty = 1) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  if (productOutOfStock(product)) {
    showToast(`${product.name} is out of stock`);
    return;
  }

  const line = { id: productId, qty, size: state.selectedSize || firstAvailableSize(product), color: null };
  const existingItem = state.cart.find(item => variantKey(item) === variantKey(line));
  if (existingItem) {
    existingItem.qty += qty;
  } else {
    state.cart.push(line);
  }

  saveCart();
  updateCartUI();
  showToast(`${product.name} added to cart!`);
}

function buyNow(productId) {
  addToCart(productId);
  window.location.href = 'checkout.html';
}

function removeFromCart(key) {
  state.cart = state.cart.filter(item => variantKey(item) !== key);
  saveCart();
  updateCartUI();
  renderCartItems();
}

function updateCartItemQty(key, delta) {
  const item = state.cart.find(i => variantKey(i) === key);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) {
    removeFromCart(key);
    return;
  }
  saveCart();
  updateCartUI();
  renderCartItems();
}

function saveCart() {
  localStorage.setItem('cv_cart', JSON.stringify(state.cart));
}

function updateCartUI() {
  const count = state.cart.reduce((sum, item) => sum + item.qty, 0);
  const total = state.cart.reduce((sum, item) => {
    const product = products.find(p => p.id === item.id);
    return sum + (product ? product.price * item.qty : 0);
  }, 0);

  const cartCountEl = document.getElementById('cartCount');
  const cartTotalEl = document.getElementById('cartTotal');
  if (cartCountEl) {
    const prev = Number(cartCountEl.textContent) || 0;
    cartCountEl.textContent = count;
    if (count !== prev) {
      cartCountEl.classList.remove('pop');
      void cartCountEl.offsetWidth; // restart animation
      cartCountEl.classList.add('pop');
    }
  }
  if (cartTotalEl) cartTotalEl.textContent = `${total.toLocaleString()}৳`;
}

function renderCartItems() {
  const container = document.getElementById('cartItems');
  if (!container) return;

  if (state.cart.length === 0) {
    container.innerHTML = `
      <div class="cart-drawer__empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
        <p>Your cart is empty</p>
      </div>
    `;
    return;
  }

  container.innerHTML = state.cart.map(item => {
    const product = products.find(p => p.id === item.id);
    if (!product) return '';
    const key = variantKey(item);
    const meta = [item.size ? 'Size: ' + item.size : '', item.color ? 'Color: ' + item.color : ''].filter(Boolean).join(' · ');
    return `
      <div class="cart-item">
        <div class="cart-item__image">
          <img src="${product.image}" alt="${product.name}" width="70" height="70">
        </div>
        <div class="cart-item__info">
          <div class="cart-item__title">${product.name}</div>
          ${meta ? `<div class="cart-item__meta">${meta}</div>` : ''}
          <div class="cart-item__price">${product.price.toLocaleString()}৳</div>
          <div class="cart-item__qty">
            <button onclick="updateCartItemQty('${key}', -1)">−</button>
            <span>${item.qty}</span>
            <button onclick="updateCartItemQty('${key}', 1)">+</button>
          </div>
        </div>
        <button class="cart-item__remove" onclick="removeFromCart('${key}')" aria-label="Remove">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    `;
  }).join('');
}

// ── Wishlist Functions ──
function toggleWishlist(productId) {
  const index = state.wishlist.indexOf(productId);
  if (index > -1) {
    state.wishlist.splice(index, 1);
    showToast('Removed from wishlist');
  } else {
    state.wishlist.push(productId);
    showToast('Added to wishlist ❤️');
  }
  localStorage.setItem('cv_wishlist', JSON.stringify(state.wishlist));
  updateWishlistUI();
  // Update heart icons in place (no full re-render, so cards don't re-animate)
  const active = state.wishlist.includes(productId);
  $$(`.product-card__wishlist[data-id="${productId}"]`).forEach(btn => {
    btn.classList.toggle('active', active);
    const svg = btn.querySelector('svg');
    if (svg) svg.setAttribute('fill', active ? 'currentColor' : 'none');
  });
}

function updateWishlistUI() {
  const countEl = document.getElementById('wishlistCount');
  if (countEl) countEl.textContent = state.wishlist.length;
}

// ── Product Modal ──
function openProductModal(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  state.modalProduct = product;
  state.modalQty = 1;
  state.selectedSize = firstAvailableSize(product);

  document.getElementById('modalImage').src = product.image;
  document.getElementById('modalImage').alt = product.name;
  document.getElementById('modalTitle').textContent = product.name;
  document.getElementById('modalPrice').textContent = `${product.price.toLocaleString()}৳`;
  document.getElementById('modalOriginalPrice').textContent = `${product.originalPrice.toLocaleString()}৳`;
  document.getElementById('modalDesc').textContent = product.description;
  document.getElementById('modalQty').textContent = '1';

  const sizesContainer = document.getElementById('modalSizes');
  sizesContainer.innerHTML = product.sizes.map((s) => {
    const out = (s.stock === 0);
    const active = (s.size === state.selectedSize);
    return `<button class="size-btn ${active ? 'active' : ''} ${out ? 'out' : ''}" ${out ? 'disabled' : ''} onclick="selectSize('${s.size}', this)">${s.size}</button>`;
  }).join('');

  document.getElementById('productModalOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeProductModal() {
  document.getElementById('productModalOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

function selectSize(size, btn) {
  state.selectedSize = size;
  $$('#modalSizes .size-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// ── Cart Drawer ──
function openCart() {
  renderCartItems();
  document.getElementById('cartDrawer').classList.add('active');
  document.getElementById('cartOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  document.getElementById('cartDrawer').classList.remove('active');
  document.getElementById('cartOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

// ── Mobile Nav ──
function openMobileNav() {
  document.getElementById('mobileNav').classList.add('active');
  document.getElementById('mobileNavOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeMobileNav() {
  document.getElementById('mobileNav').classList.remove('active');
  document.getElementById('mobileNavOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

// ── Toast ──
function showToast(message) {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toastMessage');
  msgEl.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ── Event Listeners ──
function initEventListeners() {
  // Cart toggle
  document.getElementById('cartToggle').addEventListener('click', openCart);
  document.getElementById('cartClose').addEventListener('click', closeCart);
  document.getElementById('cartOverlay').addEventListener('click', closeCart);

  // Mobile nav
  document.getElementById('mobileMenuToggle').addEventListener('click', openMobileNav);
  document.getElementById('mobileNavClose').addEventListener('click', closeMobileNav);
  document.getElementById('mobileNavOverlay').addEventListener('click', closeMobileNav);

  // Mobile nav links
  $$('.mobile-nav__links a').forEach(link => {
    link.addEventListener('click', closeMobileNav);
  });

  // Product modal
  document.getElementById('modalClose').addEventListener('click', closeProductModal);
  document.getElementById('productModalOverlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeProductModal();
  });

  // Modal qty
  document.getElementById('modalQtyMinus').addEventListener('click', () => {
    if (state.modalQty > 1) {
      state.modalQty--;
      document.getElementById('modalQty').textContent = state.modalQty;
    }
  });

  document.getElementById('modalQtyPlus').addEventListener('click', () => {
    state.modalQty++;
    document.getElementById('modalQty').textContent = state.modalQty;
  });

  // Modal add to cart
  document.getElementById('modalAddToCart').addEventListener('click', () => {
    if (state.modalProduct) {
      addToCart(state.modalProduct.id, state.modalQty);
      closeProductModal();
    }
  });

  // Category dropdown
  document.getElementById('categoryTrigger').addEventListener('click', () => {
    document.getElementById('categoryDropdown').classList.toggle('open');
  });

  // Close category dropdown on outside click
  document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('categoryDropdown');
    if (!dropdown.contains(e.target)) {
      dropdown.classList.remove('open');
    }
  });

  // Wishlist buttons (delegated)
  document.addEventListener('click', (e) => {
    const wishBtn = e.target.closest('.product-card__wishlist');
    if (wishBtn) {
      e.preventDefault();
      e.stopPropagation();
      const id = parseInt(wishBtn.dataset.id);
      toggleWishlist(id);
    }
  });

  // Newsletter
  const newsletterForm = document.getElementById('newsletterForm');
  if (newsletterForm) {
    newsletterForm.addEventListener('submit', (e) => {
      e.preventDefault();
      showToast('Thank you for subscribing! 🎉');
      newsletterForm.reset();
    });
  }

  // Back to top
  document.getElementById('backToTop').addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Checkout
  document.getElementById('checkoutBtn').addEventListener('click', () => {
    if (state.cart.length === 0) {
      showToast('Your cart is empty!');
      return;
    }
    window.location.href = 'checkout.html';
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeCart();
      closeMobileNav();
      closeProductModal();
    }
  });

  // Search functionality
  const searchHandler = (inputId) => {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') {
        const query = input.value.trim().toLowerCase();
        if (query) {
          const results = products.filter(p =>
            p.name.toLowerCase().includes(query) ||
            p.code.toLowerCase().includes(query) ||
            p.category.toLowerCase().includes(query)
          );
          if (results.length > 0) {
            renderProductGrid('readyStockGrid', results);
            document.getElementById('shop').scrollIntoView({ behavior: 'smooth' });
            showToast(`Found ${results.length} product(s)`);
          } else {
            showToast('No products found');
          }
        }
      }
    });
  };

  searchHandler('headerSearchInput');
  searchHandler('catSearchInput');
}

// ── Scroll Effects ──
function initScrollEffects() {
  const header = document.getElementById('header');
  const backToTop = document.getElementById('backToTop');

  let lastScrollY = 0;

  window.addEventListener('scroll', () => {
    const scrollY = window.scrollY;

    // Header shadow
    if (scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }

    // Back to top button
    if (scrollY > 500) {
      backToTop.classList.add('visible');
    } else {
      backToTop.classList.remove('visible');
    }

    lastScrollY = scrollY;
  }, { passive: true });

  // Entrance animations are now pure CSS (see style.css) so cards can never
  // get stuck invisible — nothing to do here anymore.
}

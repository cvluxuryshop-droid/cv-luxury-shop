/* ========================================
   CV LUXURY SHOP - Product Detail Page
   ======================================== */

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

let current = null;
let selectedSize = null;
let selectedColor = 0;
let qty = 1;

document.addEventListener('DOMContentLoaded', () => {
  const id = Number(new URLSearchParams(location.search).get('id'));
  current = getProduct(id);

  if (!current) {
    $('#pdpMain').innerHTML = `
      <div class="pdp__notfound">
        <h2>Product not found</h2>
        <p>The product you are looking for does not exist.</p>
        <a href="index.html" class="btn-primary">Back to Shop</a>
      </div>`;
    $('#pdpTabs').style.display = 'none';
    updateCartUI();
    initCartDrawer();
    return;
  }

  selectedSize = current.sizes[0];
  document.title = `${current.name} - CV Luxury Shop`;
  $('#breadcrumbName').textContent = current.name;

  renderMain();
  renderTabs();
  renderRelated();
  updateCartUI();
  initCartDrawer();
});

// ── Main product block ──
function renderMain() {
  const p = current;
  const discount = Math.round((1 - p.price / p.originalPrice) * 100);
  const rating = getRating(p.id);

  $('#pdpMain').innerHTML = `
    <div class="pdp__gallery">
      <div class="pdp__image">
        <span class="pdp__badge">-${discount}%</span>
        <img src="${p.image}" alt="${p.name}" id="pdpMainImg">
      </div>
    </div>
    <div class="pdp__info">
      <div class="pdp__code">Code: ${p.code}</div>
      <h1 class="pdp__title">${p.name}</h1>
      <div class="pdp__rating">
        <span class="stars">${starsHTML(rating.avg)}</span>
        <span class="pdp__rating-text">${rating.avg} (${rating.count} reviews)</span>
        <span class="pdp__instock">● In Stock</span>
      </div>
      <div class="pdp__price">
        <span class="current">${fmtBDT(p.price)}</span>
        <span class="original">${fmtBDT(p.originalPrice)}</span>
        <span class="save">Save ${fmtBDT(p.originalPrice - p.price)}</span>
      </div>
      <p class="pdp__shortdesc">${p.description}</p>

      <div class="pdp__option">
        <label>Color</label>
        <div class="pdp__colors" id="pdpColors">
          ${p.colors.map((c, i) => `<span class="color-dot ${i === 0 ? 'active' : ''}" data-i="${i}" style="background:${c}"></span>`).join('')}
        </div>
      </div>

      <div class="pdp__option">
        <label>Size</label>
        <div class="pdp__sizes" id="pdpSizes">
          ${p.sizes.map((s, i) => `<button class="size-btn ${i === 0 ? 'active' : ''}" data-size="${s}">${s}</button>`).join('')}
        </div>
      </div>

      <div class="pdp__buy">
        <div class="qty-control">
          <button id="qtyMinus">−</button>
          <span id="qtyVal">1</span>
          <button id="qtyPlus">+</button>
        </div>
        <button class="btn-primary pdp__addcart" id="addCartBtn">Add to Cart</button>
        <button class="btn-buy pdp__buynow" id="buyNowBtn">Buy Now</button>
      </div>

      <ul class="pdp__assure">
        <li>✓ 100% Authentic Guaranteed</li>
        <li>✓ Cash on Delivery Available</li>
        <li>✓ 7-Day Easy Return</li>
      </ul>
    </div>
  `;

  // Color select
  $$('#pdpColors .color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      $$('#pdpColors .color-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      selectedColor = Number(dot.dataset.i);
    });
  });

  // Size select
  $$('#pdpSizes .size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('#pdpSizes .size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedSize = btn.dataset.size;
    });
  });

  // Qty
  $('#qtyMinus').addEventListener('click', () => { if (qty > 1) { qty--; $('#qtyVal').textContent = qty; } });
  $('#qtyPlus').addEventListener('click', () => { qty++; $('#qtyVal').textContent = qty; });

  // Add to cart
  $('#addCartBtn').addEventListener('click', () => {
    addToCartShared(current.id, qty, selectedSize);
    updateCartUI();
    showToast(`${current.name} added to cart!`);
    openCart();
  });

  // Buy now → straight to checkout
  $('#buyNowBtn').addEventListener('click', () => {
    addToCartShared(current.id, qty, selectedSize);
    window.location.href = 'checkout.html';
  });
}

// ── Tabs ──
function renderTabs() {
  const p = current;
  const rating = getRating(p.id);
  const reviews = getReviews(p.id);

  $('#reviewTabCount').textContent = `(${rating.count})`;

  // Description
  $('#tab-desc').innerHTML = `
    <p>${p.description}</p>
    <h4>Highlights</h4>
    <ul class="pdp__highlights">
      ${(p.highlights || []).map(h => `<li>${h}</li>`).join('')}
    </ul>
    <table class="pdp__spec">
      <tr><th>Product Code</th><td>${p.code}</td></tr>
      <tr><th>Category</th><td>${p.category.replace('-', ' ')}</td></tr>
      <tr><th>Available Sizes</th><td>${p.sizes.join(', ')}</td></tr>
      <tr><th>Warranty</th><td>Authenticity guaranteed</td></tr>
    </table>
  `;

  // Reviews
  $('#tab-reviews').innerHTML = `
    <div class="reviews__summary">
      <div class="reviews__score">
        <div class="big">${rating.avg}</div>
        <div class="stars">${starsHTML(rating.avg)}</div>
        <div class="muted">${rating.count} reviews</div>
      </div>
      <div class="reviews__note">Based on verified customer purchases.</div>
    </div>
    <div class="reviews__list">
      ${reviews.map(r => `
        <div class="review">
          <div class="review__head">
            <span class="review__avatar">${r.name.charAt(0)}</span>
            <div>
              <div class="review__name">${r.name} <span class="review__verified">✓ Verified</span></div>
              <div class="review__stars">${starsHTML(r.rating)}</div>
            </div>
            <span class="review__date">${r.date}</span>
          </div>
          <p class="review__text">${r.text}</p>
        </div>
      `).join('')}
    </div>
  `;

  // FAQ
  $('#tab-faq').innerHTML = `
    <div class="faq-list">
      ${FAQS.map((f, i) => `
        <div class="faq-item" data-i="${i}">
          <button class="faq-q">
            <span>${f.q}</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="faq-a"><p>${f.a}</p></div>
        </div>
      `).join('')}
    </div>
  `;

  // Tab switching
  $$('.pdp__tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.pdp__tab').forEach(t => t.classList.remove('active'));
      $$('.pdp__tabpanel').forEach(pnl => pnl.classList.remove('active'));
      tab.classList.add('active');
      $('#tab-' + tab.dataset.tab).classList.add('active');
    });
  });

  // FAQ accordion
  $$('.faq-item').forEach(item => {
    item.querySelector('.faq-q').addEventListener('click', () => {
      item.classList.toggle('open');
    });
  });
}

// ── Related products ──
function renderRelated() {
  const related = PRODUCTS.filter(p => p.category === current.category && p.id !== current.id).slice(0, 4);
  const fill = PRODUCTS.filter(p => p.id !== current.id && !related.includes(p));
  while (related.length < 4 && fill.length) related.push(fill.shift());

  $('#relatedGrid').innerHTML = related.map(p => {
    const discount = Math.round((1 - p.price / p.originalPrice) * 100);
    return `
      <div class="product-card">
        <span class="product-card__badge product-card__badge--new">-${discount}%</span>
        <a href="product.html?id=${p.id}" class="product-card__image">
          <img src="${p.image}" alt="${p.name}" loading="lazy" width="500" height="500">
        </a>
        <div class="product-card__info">
          <h3 class="product-card__title"><a href="product.html?id=${p.id}">${p.name}</a></h3>
          <div class="product-card__price">
            <span class="current">${fmtBDT(p.price)}</span>
            <span class="original">${fmtBDT(p.originalPrice)}</span>
          </div>
        </div>
        <div class="product-card__actions">
          <button class="product-card__add-to-cart" onclick="quickAdd(${p.id})">Add to Cart</button>
          <button class="product-card__buy-now" onclick="buyNow(${p.id})">Buy Now</button>
        </div>
      </div>`;
  }).join('');
}

function quickAdd(id) {
  addToCartShared(id, 1);
  updateCartUI();
  const p = getProduct(id);
  showToast(`${p.name} added to cart!`);
}

function buyNow(id) {
  addToCartShared(id, 1);
  window.location.href = 'checkout.html';
}

// ── Cart UI (shared drawer) ──
function updateCartUI() {
  const cc = $('#cartCount'); if (cc) cc.textContent = cartCount();
  const ct = $('#cartTotal'); if (ct) ct.textContent = fmtBDT(cartTotal());
}

function renderCartItems() {
  const container = $('#cartItems');
  const cart = getCart();
  if (!cart.length) {
    container.innerHTML = `<div class="cart-drawer__empty">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
      <p>Your cart is empty</p></div>`;
    return;
  }
  container.innerHTML = cart.map(item => {
    const p = getProduct(item.id);
    if (!p) return '';
    return `
      <div class="cart-item">
        <div class="cart-item__image"><img src="${p.image}" alt="${p.name}" width="70" height="70"></div>
        <div class="cart-item__info">
          <div class="cart-item__title">${p.name}</div>
          <div class="cart-item__price">${fmtBDT(p.price)}</div>
          <div class="cart-item__qty">
            <button onclick="changeQty(${p.id}, -1)">−</button>
            <span>${item.qty}</span>
            <button onclick="changeQty(${p.id}, 1)">+</button>
          </div>
        </div>
        <button class="cart-item__remove" onclick="removeItem(${p.id})" aria-label="Remove">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`;
  }).join('');
}

function changeQty(id, delta) {
  const cart = getCart();
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) { removeItem(id); return; }
  setCart(cart);
  updateCartUI();
  renderCartItems();
}

function removeItem(id) {
  setCart(getCart().filter(i => i.id !== id));
  updateCartUI();
  renderCartItems();
}

function openCart() {
  renderCartItems();
  $('#cartDrawer').classList.add('active');
  $('#cartOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeCart() {
  $('#cartDrawer').classList.remove('active');
  $('#cartOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

function initCartDrawer() {
  $('#cartToggle').addEventListener('click', openCart);
  $('#cartClose').addEventListener('click', closeCart);
  $('#cartOverlay').addEventListener('click', closeCart);
  $('#checkoutBtn').addEventListener('click', () => {
    if (!getCart().length) { showToast('Your cart is empty!'); return; }
    window.location.href = 'checkout.html';
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCart(); });

  const search = $('#headerSearchInput');
  if (search) search.addEventListener('keyup', (e) => {
    if (e.key === 'Enter' && search.value.trim()) {
      window.location.href = 'index.html#shop';
    }
  });
}

// ── Toast ──
function showToast(msg) {
  const toast = $('#toast');
  $('#toastMessage').textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

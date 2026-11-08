/* ========================================
   CV LUXURY SHOP - Product Detail Page
   ======================================== */

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

let current = null;
let selectedSize = null;
let selectedColor = 0;
let qty = 1;

document.addEventListener('DOMContentLoaded', async () => {
  const id = Number(new URLSearchParams(location.search).get('id'));
  // Fetch the full single product (with colors + images); fall back to the light list
  try {
    current = await dbGetProduct(id);
  } catch (e) {
    await loadCatalogue();
    current = getProduct(id);
  }

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

  trackPixel('ViewContent', { content_ids: [String(current.id)], content_name: current.name, content_type: 'product', value: current.price, currency: 'BDT' });
  selectedSize = firstAvailableSize(current);
  document.title = `${current.name} - CV Luxury Shop`;
  $('#breadcrumbName').textContent = current.name;

  renderMain();
  renderTabs();
  updateCartUI();
  initCartDrawer();

  // Related products need the light catalogue list (load in background)
  if (!PRODUCTS.length) await loadCatalogue();
  renderRelated();
});

// ── Main product block ──
function renderMain() {
  const p = current;
  const discount = Math.round((1 - p.price / p.originalPrice) * 100);
  const rating = getRating(p.id);

  slides = buildSlides(p);
  const multi = slides.length > 1;

  $('#pdpMain').innerHTML = `
    <div class="pdp__gallery">
      <div class="pdp__image pdp__slider" id="pdpSlider">
        <span class="pdp__badge">-${discount}%</span>
        <div class="pdp__track" id="pdpTrack">
          ${slides.map((s, i) => `<img src="${s.src}" alt="${p.name}" ${i ? 'loading="lazy"' : ''} draggable="false">`).join('')}
        </div>
        ${multi ? `
          <button class="pdp__nav pdp__nav--prev" id="slidePrev" aria-label="Previous image">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <button class="pdp__nav pdp__nav--next" id="slideNext" aria-label="Next image">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <div class="pdp__dots" id="pdpDots">
            ${slides.map((_, i) => `<button class="pdp__dot ${i === 0 ? 'active' : ''}" data-i="${i}" aria-label="Image ${i + 1}"></button>`).join('')}
          </div>` : ''}
      </div>
      ${multi ? `
        <div class="pdp__thumbs" id="pdpThumbs">
          ${slides.map((s, i) => `<button class="pdp__thumb ${i === 0 ? 'active' : ''}" data-i="${i}"><img src="${s.src}" alt="" loading="lazy"></button>`).join('')}
        </div>` : ''}
    </div>
    <div class="pdp__info">
      <div class="pdp__code">Code: ${p.code}</div>
      <h1 class="pdp__title">${p.name}</h1>
      <div class="pdp__rating">
        <span class="stars">${starsHTML(rating.avg)}</span>
        <span class="pdp__rating-text">${rating.avg} (${rating.count} reviews)</span>
        <span class="pdp__instock">${productOutOfStock(p) ? '● Out of Stock' : '● In Stock'}</span>
      </div>
      <div class="pdp__price">
        <span class="current">${fmtBDT(p.price)}</span>
        <span class="original">${fmtBDT(p.originalPrice)}</span>
        <span class="save">Save ${fmtBDT(p.originalPrice - p.price)}</span>
      </div>

      <div class="pdp__option">
        <label>Color</label>
        <div class="pdp__colors" id="pdpColors">
          ${p.colors.map((c, i) => `<span class="color-dot ${i === 0 ? 'active' : ''}" data-i="${i}" data-img="${c.image || ''}" style="background:${c.color}"></span>`).join('')}
        </div>
      </div>

      <div class="pdp__option">
        <label>Size</label>
        <div class="pdp__sizes" id="pdpSizes">
          ${p.sizes.map(s => {
            const out = (s.stock === 0);
            const active = (s.size === selectedSize);
            return `<button class="size-btn ${active ? 'active' : ''} ${out ? 'out' : ''}" data-size="${s.size}" ${out ? 'disabled' : ''}>${s.size}</button>`;
          }).join('')}
        </div>
        <div class="pdp__stock-note" id="stockNote"></div>
      </div>

      <div class="pdp__buy">
        <div class="pdp__buy-row">
          <div class="qty-control">
            <button id="qtyMinus" aria-label="Decrease quantity">−</button>
            <span id="qtyVal">1</span>
            <button id="qtyPlus" aria-label="Increase quantity">+</button>
          </div>
          <button class="pdp__addcart" id="addCartBtn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            <span>Add to Cart</span>
          </button>
        </div>
        <button class="btn-primary pdp__buynow" id="buyNowBtn">Buy Now</button>
      </div>

      <ul class="pdp__assure">
        <li>✓ 100% Authentic Guaranteed</li>
        <li>✓ Cash on Delivery Available</li>
        <li>✓ 7-Day Easy Return</li>
      </ul>
    </div>
  `;

  // Color select (also jumps the slideshow to that color's photo)
  $$('#pdpColors .color-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      setColor(Number(dot.dataset.i));
      const idx = slides.findIndex(s => s.color === selectedColor);
      if (idx >= 0) { stopAutoplay(); goToSlide(idx); }
    });
  });

  initSlider();

  // Size select
  $$('#pdpSizes .size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      $$('#pdpSizes .size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedSize = btn.dataset.size;
      updateStockNote();
    });
  });
  updateStockNote();

  // Qty (respect stock limit)
  $('#qtyMinus').addEventListener('click', () => { if (qty > 1) { qty--; $('#qtyVal').textContent = qty; } });
  $('#qtyPlus').addEventListener('click', () => {
    const max = selectedStock();
    if (max !== null && qty >= max) { showToast(`Only ${max} left in size ${selectedSize}`); return; }
    qty++; $('#qtyVal').textContent = qty;
  });

  // Add to cart
  $('#addCartBtn').addEventListener('click', () => {
    if (!canAddSelected()) return;
    addToCartShared(current.id, qty, selectedSize, selectedColorValue());
    updateCartUI();
    showToast(`${current.name} added to cart!`);
    openCart();
  });

  // Buy now → straight to checkout
  $('#buyNowBtn').addEventListener('click', () => {
    if (!canAddSelected()) return;
    addToCartShared(current.id, qty, selectedSize, selectedColorValue());
    window.location.href = 'checkout.html';
  });

  // reflect out-of-stock on action buttons
  if (productOutOfStock(current)) {
    $('#addCartBtn').disabled = true;
    $('#buyNowBtn').disabled = true;
    $('#addCartBtn').textContent = 'Out of Stock';
  }
}

// ── Image slideshow (one slide per color photo + the main image) ──
let slides = [];
let slideIdx = 0;
let autoTimer = null;

function buildSlides(p) {
  const out = [];
  (p.colors || []).forEach((c, i) => {
    if (c.image && !out.some(s => s.src === c.image)) out.push({ src: c.image, color: i });
  });
  if (p.image && !out.some(s => s.src === p.image)) out.push({ src: p.image, color: null });
  return out.length ? out : [{ src: p.image, color: null }];
}

function setColor(i) {
  selectedColor = i;
  $$('#pdpColors .color-dot').forEach(d => d.classList.toggle('active', Number(d.dataset.i) === i));
}

function goToSlide(i, fromUser) {
  if (!slides.length) return;
  slideIdx = (i + slides.length) % slides.length;
  const track = $('#pdpTrack');
  if (track) track.style.transform = `translateX(-${slideIdx * 100}%)`;
  $$('#pdpDots .pdp__dot').forEach((d, n) => d.classList.toggle('active', n === slideIdx));
  $$('#pdpThumbs .pdp__thumb').forEach((t, n) => t.classList.toggle('active', n === slideIdx));
  // a photo the shopper picks themselves also selects its color
  if (fromUser && slides[slideIdx].color !== null) setColor(slides[slideIdx].color);
}

function startAutoplay() {
  if (slides.length < 2 || autoTimer) return;
  autoTimer = setInterval(() => goToSlide(slideIdx + 1), 3500);
}
function stopAutoplay() { clearInterval(autoTimer); autoTimer = null; }

function initSlider() {
  slideIdx = 0;
  if (slides.length < 2) return;
  let userPicked = false; // once the shopper navigates, stop rotating for good
  const userGo = (i) => { userPicked = true; stopAutoplay(); goToSlide(i, true); };
  $('#slidePrev').addEventListener('click', () => userGo(slideIdx - 1));
  $('#slideNext').addEventListener('click', () => userGo(slideIdx + 1));
  $$('#pdpDots .pdp__dot').forEach(d => d.addEventListener('click', () => userGo(Number(d.dataset.i))));
  $$('#pdpThumbs .pdp__thumb').forEach(t => t.addEventListener('click', () => userGo(Number(t.dataset.i))));

  // swipe on phones
  const slider = $('#pdpSlider');
  let startX = null;
  slider.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
  slider.addEventListener('touchend', (e) => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 40) userGo(slideIdx + (dx < 0 ? 1 : -1));
    startX = null;
  });

  // pause while the pointer is over the photo
  slider.addEventListener('mouseenter', stopAutoplay);
  slider.addEventListener('mouseleave', () => { if (!userPicked) startAutoplay(); });
  startAutoplay();
}

// value (hex/name) of the currently selected colour, or null
function selectedColorValue() {
  const c = (current.colors || [])[selectedColor];
  return c ? c.color : null;
}

// stock (number) of the currently selected size, or null if untracked
function selectedStock() {
  const s = (current.sizes || []).find(x => x.size === selectedSize);
  return s && typeof s.stock === 'number' ? s.stock : null;
}

function canAddSelected() {
  const max = selectedStock();
  if (max === 0) { showToast(`Size ${selectedSize} is out of stock`); return false; }
  if (max !== null && qty > max) { showToast(`Only ${max} left in size ${selectedSize}`); return false; }
  return true;
}

function updateStockNote() {
  const note = $('#stockNote');
  if (!note) return;
  const max = selectedStock();
  if (max === null) { note.textContent = ''; note.className = 'pdp__stock-note'; return; }
  if (max === 0) { note.textContent = `Size ${selectedSize} — Out of stock`; note.className = 'pdp__stock-note out'; }
  else if (max <= 5) { note.textContent = `Only ${max} left in size ${selectedSize}`; note.className = 'pdp__stock-note low'; }
  else { note.textContent = `In stock (${max} available)`; note.className = 'pdp__stock-note ok'; }
}

// ── Tabs ──
function renderTabs() {
  const p = current;
  const rating = getRating(p.id);
  const reviews = getReviews(p.id);

  $('#reviewTabCount').textContent = `(${rating.count})`;

  // Description — just a few short points (highlights; else split the description into sentences)
  let points = (p.highlights || []).map(h => String(h).trim()).filter(Boolean);
  if (!points.length) points = String(p.description || '').split(/(?<=[.!?।])\s+/).map(s => s.trim().replace(/[.।]$/, '')).filter(Boolean);
  $('#tab-desc').innerHTML = `
    <ul class="pdp__points">
      ${points.slice(0, 5).map(h => `<li>${h}</li>`).join('')}
    </ul>
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
    const key = variantKey(item);
    const meta = [item.size ? 'Size: ' + item.size : '', item.color ? 'Color: ' + item.color : ''].filter(Boolean).join(' · ');
    return `
      <div class="cart-item">
        <div class="cart-item__image"><img src="${p.image}" alt="${p.name}" width="70" height="70"></div>
        <div class="cart-item__info">
          <div class="cart-item__title">${p.name}</div>
          ${meta ? `<div class="cart-item__meta">${meta}</div>` : ''}
          <div class="cart-item__price">${fmtBDT(p.price)}</div>
          <div class="cart-item__qty">
            <button onclick="changeQty('${key}', -1)">−</button>
            <span>${item.qty}</span>
            <button onclick="changeQty('${key}', 1)">+</button>
          </div>
        </div>
        <button class="cart-item__remove" onclick="removeItem('${key}')" aria-label="Remove">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`;
  }).join('');
}

function changeQty(key, delta) {
  changeCartLineQty(key, delta);
  updateCartUI();
  renderCartItems();
}

function removeItem(key) {
  removeCartLine(key);
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

  // Mobile nav drawer
  const menuToggle = $('#mobileMenuToggle');
  const mobileNav = $('#mobileNav');
  const navOverlay = $('#mobileNavOverlay');
  const navClose = $('#mobileNavClose');
  const openNav = () => { mobileNav.classList.add('active'); navOverlay.classList.add('active'); document.body.style.overflow = 'hidden'; };
  const closeNav = () => { mobileNav.classList.remove('active'); navOverlay.classList.remove('active'); document.body.style.overflow = ''; };
  if (menuToggle) menuToggle.addEventListener('click', openNav);
  if (navClose) navClose.addEventListener('click', closeNav);
  if (navOverlay) navOverlay.addEventListener('click', closeNav);
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

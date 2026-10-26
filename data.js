/* ========================================
   CV LUXURY SHOP - Shared Data & Helpers
   Loaded on every page (index, product, checkout)
   ======================================== */

// ── Product Catalogue (defaults; admin edits are stored in localStorage) ──
const DEFAULT_PRODUCTS = [
  {
    id: 1,
    name: "Rose Gold Stiletto Heels",
    code: "CVL-WH001",
    price: 2490,
    originalPrice: 3290,
    image: "img/products/heels-rose-gold.jpg",
    category: "women-shoes",
    badge: "in-stock",
    colors: ["#d4a08c", "#1a1a1a", "#c9a84c"],
    sizes: ["36", "37", "38", "39", "40"],
    description: "Elegant rose gold stiletto heels with ankle strap detail. Premium metallic leather upper with cushioned insole for all-day comfort. Perfect for special occasions.",
    highlights: ["Premium metallic leather upper", "Cushioned memory-foam insole", "Non-slip rubber outsole", "Adjustable ankle strap", "Heel height: 9 cm"]
  },
  {
    id: 2,
    name: "Burgundy Leather Handbag",
    code: "CVL-BG002",
    price: 3990,
    originalPrice: 4990,
    image: "img/products/bag-burgundy.jpg",
    category: "bags",
    badge: "in-stock",
    colors: ["#5c1a2a", "#1a1a1a", "#c9a84c"],
    sizes: ["One Size"],
    description: "Luxurious burgundy leather handbag with gold hardware details. Features multiple compartments, detachable shoulder strap, and premium craftsmanship.",
    highlights: ["Genuine full-grain leather", "Gold-tone hardware", "Detachable shoulder strap", "Multiple interior compartments", "Dust bag included"]
  },
  {
    id: 3,
    name: "Navy Leather Sneakers",
    code: "CVL-MS003",
    price: 2890,
    originalPrice: 3490,
    image: "img/products/sneakers-navy.jpg",
    category: "men-shoes",
    badge: "in-stock",
    colors: ["#1a2744", "#ffffff", "#1a1a1a"],
    sizes: ["40", "41", "42", "43", "44"],
    description: "Premium navy blue leather sneakers with white sole. Minimalist design with superior comfort and durability. Perfect for casual and smart-casual wear.",
    highlights: ["Full-grain leather upper", "Breathable textile lining", "Lightweight EVA sole", "Reinforced stitching", "Everyday comfort fit"]
  },
  {
    id: 4,
    name: "Gold Classic Watch",
    code: "CVL-WT004",
    price: 8990,
    originalPrice: 12490,
    image: "img/products/watch-gold.jpg",
    category: "watches",
    badge: "sale",
    colors: ["#c9a84c", "#c0c0c0"],
    sizes: ["One Size"],
    description: "Luxury gold wristwatch with black dial and genuine leather strap. Swiss movement, sapphire crystal glass, and water-resistant to 50m.",
    highlights: ["Swiss quartz movement", "Sapphire crystal glass", "Genuine leather strap", "Water-resistant to 50m", "2-year warranty"]
  },
  {
    id: 5,
    name: "Gold Crystal Sandals",
    code: "CVL-WS005",
    price: 1990,
    originalPrice: 2690,
    image: "img/products/sandals-gold.jpg",
    category: "women-shoes",
    badge: "in-stock",
    colors: ["#c9a84c", "#c0c0c0", "#d4a08c"],
    sizes: ["36", "37", "38", "39", "40"],
    description: "Stunning gold sandals with pearl and crystal embellishments. Flat comfortable design perfect for summer occasions and evening events.",
    highlights: ["Hand-set crystal embellishments", "Soft padded footbed", "Flexible flat sole", "Secure buckle closure", "Lightweight design"]
  },
  {
    id: 6,
    name: "Brown Tassel Loafers",
    code: "CVL-ML006",
    price: 3490,
    originalPrice: 4290,
    image: "img/products/loafers-brown.jpg",
    category: "men-shoes",
    badge: "in-stock",
    colors: ["#4a2c17", "#1a1a1a", "#c9a84c"],
    sizes: ["40", "41", "42", "43", "44"],
    description: "Premium brown leather tassel loafers with handcrafted detail. Full grain leather upper with leather sole. A timeless piece for the refined gentleman.",
    highlights: ["Handcrafted full-grain leather", "Classic tassel detail", "Leather sole", "Slip-on comfort", "Timeless design"]
  },
  {
    id: 7,
    name: "Crystal Evening Clutch",
    code: "CVL-CL007",
    price: 2290,
    originalPrice: 2990,
    image: "img/products/clutch-gold.jpg",
    category: "bags",
    badge: "new",
    colors: ["#c9a84c", "#c0c0c0", "#d4a08c"],
    sizes: ["One Size"],
    description: "Champagne gold evening clutch with stunning crystal clasp detail. Detachable chain strap, satin lining interior. Perfect for weddings and gala events.",
    highlights: ["Crystal clasp detail", "Detachable chain strap", "Satin lining interior", "Compact evening size", "Gift-ready packaging"]
  },
  {
    id: 8,
    name: "Black Ankle Boots",
    code: "CVL-WB008",
    price: 3290,
    originalPrice: 4190,
    image: "img/products/boots-black.jpg",
    category: "women-shoes",
    badge: "in-stock",
    colors: ["#1a1a1a", "#4a2c17"],
    sizes: ["36", "37", "38", "39", "40"],
    description: "Elegant black leather ankle boots with gold zipper details. Block heel for stability and comfort. Premium full-grain leather construction.",
    highlights: ["Premium full-grain leather", "Gold-tone side zipper", "Stable block heel", "Cushioned insole", "Durable rubber outsole"]
  },
  {
    id: 9,
    name: "Designer Gold Sunglasses",
    code: "CVL-SG009",
    price: 4490,
    originalPrice: 5990,
    image: "img/products/sunglasses-gold.jpg",
    category: "sunglasses",
    badge: "sale",
    colors: ["#c9a84c", "#1a1a1a"],
    sizes: ["One Size"],
    description: "Luxury gold frame sunglasses with gradient dark tinted lenses. UV400 protection, lightweight construction with adjustable nose pads.",
    highlights: ["UV400 protection", "Gradient tinted lenses", "Lightweight metal frame", "Adjustable nose pads", "Protective case included"]
  },
  {
    id: 10,
    name: "Cognac Leather Backpack",
    code: "CVL-BP010",
    price: 4990,
    originalPrice: 6490,
    image: "img/products/backpack-tan.jpg",
    category: "bags",
    badge: "new",
    colors: ["#b5651d", "#1a1a1a", "#c9a84c"],
    sizes: ["One Size"],
    description: "Premium cognac tan leather backpack with gold buckle hardware. Multiple compartments including padded laptop sleeve. Handcrafted with full-grain leather.",
    highlights: ["Handcrafted full-grain leather", "Padded 15\" laptop sleeve", "Gold buckle hardware", "Multiple compartments", "Adjustable padded straps"]
  }
];

// Active catalogue — filled at runtime from Supabase (see db.js loadCatalogue()).
// Starts empty; DEFAULT_PRODUCTS is used only as an offline fallback.
let PRODUCTS = [];

// ── Frequently Asked Questions (shared across products) ──
const FAQS = [
  {
    q: "Are your products 100% authentic?",
    a: "Yes. Every item at CV Luxury Shop is sourced from authorized suppliers and comes with a guarantee of authenticity. We never sell replicas."
  },
  {
    q: "How long does delivery take?",
    a: "Inside Dhaka: 1–2 business days. Outside Dhaka: 3–5 business days. You will receive an SMS with tracking details once your order ships."
  },
  {
    q: "What payment methods do you accept?",
    a: "We currently accept Cash on Delivery (COD) across Bangladesh. Pay when you receive your order."
  },
  {
    q: "Can I return or exchange a product?",
    a: "Yes. You can return or exchange unused items in their original packaging within 7 days of delivery. Please keep the invoice for a smooth process."
  },
  {
    q: "How do I choose the right size?",
    a: "Each product lists available sizes. If you are between sizes or unsure, message us on WhatsApp and our team will help you pick the perfect fit."
  }
];

// ── Review generator (deterministic per product) ──
const REVIEW_POOL = [
  { name: "Tasnim A.",   rating: 5, text: "Absolutely stunning! The quality is way better than I expected. Worth every taka." },
  { name: "Rakib H.",    rating: 5, text: "Fast delivery and the product looks exactly like the photos. Highly recommended." },
  { name: "Nusrat J.",   rating: 4, text: "Love it! Comfortable and premium feel. Took off one star only for the delivery time." },
  { name: "Imran K.",    rating: 5, text: "Authentic and beautifully packaged. Will definitely order again from CV Luxury." },
  { name: "Sadia R.",    rating: 5, text: "Got so many compliments. The finishing is top notch. Thank you CV Luxury Shop!" },
  { name: "Mahmudul I.", rating: 4, text: "Good value for money. Fits well and feels durable. Happy with my purchase." },
  { name: "Farhana S.",  rating: 5, text: "Exceeded my expectations. Customer support was very helpful with sizing too." },
  { name: "Arif M.",     rating: 5, text: "Premium quality at a great price. Delivery inside Dhaka was super quick." }
];

function getReviews(id) {
  id = Number(id);
  const count = 3 + (id % 3); // 3–5 reviews
  const start = (id * 2) % REVIEW_POOL.length;
  const list = [];
  for (let i = 0; i < count; i++) {
    const r = REVIEW_POOL[(start + i) % REVIEW_POOL.length];
    const d = new Date(2026, 9, 1 + ((id * 3 + i * 5) % 20));
    list.push({ ...r, date: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) });
  }
  return list;
}

function getRating(id) {
  const reviews = getReviews(id);
  const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
  return { avg: Math.round(avg * 10) / 10, count: reviews.length };
}

// ── Formatting ──
function fmtBDT(n) {
  return Number(n).toLocaleString() + '৳';
}

function getProduct(id) {
  return PRODUCTS.find(p => p.id === Number(id));
}

// A size is available when stock is null (untracked) or > 0
function sizeAvailable(s) {
  return s && (s.stock === null || s.stock === undefined || s.stock > 0);
}

function firstAvailableSize(product) {
  const sizes = (product && product.sizes) || [];
  const avail = sizes.find(sizeAvailable) || sizes[0];
  return avail ? avail.size : 'One Size';
}

// Product is out of stock when it has tracked sizes and all are 0
function productOutOfStock(product) {
  const sizes = (product && product.sizes) || [];
  if (!sizes.length) return false;
  return sizes.every(s => s.stock === 0);
}

function starsHTML(rating) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    const fill = i <= Math.round(rating) ? 'currentColor' : 'none';
    html += `<svg width="15" height="15" viewBox="0 0 24 24" fill="${fill}" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
  }
  return html;
}

// ── Shared Cart (localStorage) ──
const CART_KEY = 'cv_cart';
const WISHLIST_KEY = 'cv_wishlist';

function getCart() {
  try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch { return []; }
}

function setCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

// A cart line is unique per product + size + colour (a "variant")
function variantKey(item) {
  return item.id + '|' + (item.size || '') + '|' + (item.color || '');
}

function addToCartShared(id, qty = 1, size = null, color = null) {
  id = Number(id);
  const product = getProduct(id);
  if (!product) return;
  const line = { id, qty, size: size || firstAvailableSize(product), color: color || null };
  const cart = getCart();
  const existing = cart.find(i => variantKey(i) === variantKey(line));
  if (existing) {
    existing.qty += qty;
  } else {
    cart.push(line);
  }
  setCart(cart);
}

function removeCartLine(key) {
  setCart(getCart().filter(i => variantKey(i) !== key));
}

function changeCartLineQty(key, delta) {
  const cart = getCart();
  const it = cart.find(i => variantKey(i) === key);
  if (!it) return;
  it.qty += delta;
  if (it.qty <= 0) { removeCartLine(key); return; }
  setCart(cart);
}

function cartCount() {
  return getCart().reduce((s, i) => s + i.qty, 0);
}

function cartTotal() {
  return getCart().reduce((s, i) => {
    const p = getProduct(i.id);
    return s + (p ? p.price * i.qty : 0);
  }, 0);
}

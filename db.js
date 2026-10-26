/* ========================================
   CV LUXURY SHOP - API Data Layer (Railway)
   Talks to the Node/Express backend (/api/*)
   backed by PostgreSQL. Shared by all pages.
   ======================================== */

const API = ''; // same origin (server serves both site + API)
const TOKEN_KEY = 'cv_admin_token';

function getToken() { return localStorage.getItem(TOKEN_KEY); }
function setToken(t) { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); }

async function apiGet(path, auth) {
  const headers = {};
  if (auth) headers.Authorization = 'Bearer ' + getToken();
  const r = await fetch(API + path, { headers });
  if (!r.ok) throw new Error('GET ' + path + ' -> ' + r.status);
  return r.json();
}

async function apiSend(method, path, body, auth) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers.Authorization = 'Bearer ' + getToken();
  const r = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) {
    let msg = method + ' ' + path + ' -> ' + r.status;
    try { const j = await r.json(); if (j.error) msg = j.error; } catch (e) {}
    throw new Error(msg);
  }
  return r.json().catch(() => ({}));
}

// ── Normalizers (handle values typed with commas, spaces or newlines) ──
function normalizeSizes(arr) {
  const out = [];
  const add = (sz, stock) => {
    sz = String(sz).trim();
    if (!sz) return;
    let s = null;
    if (stock !== null && stock !== undefined && stock !== '') {
      s = Number(stock);
      if (isNaN(s) || s < 0) s = null;
    }
    out.push({ size: sz, stock: s });
  };
  (Array.isArray(arr) ? arr : []).forEach(raw => {
    if (raw && typeof raw === 'object' && raw.size != null) { add(raw.size, raw.stock); return; }
    String(raw).split(/[,\n]+/).forEach(part => {
      part = part.trim();
      if (!part) return;
      if (/^[\d\s.]+$/.test(part) && /\s/.test(part)) {
        part.split(/\s+/).forEach(t => { if (t) add(t, null); });
      } else { add(part, null); }
    });
  });
  return out.length ? out : [{ size: 'One Size', stock: null }];
}

function isColorToken(x) {
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(x) || /^[A-Za-z]{3,}$/.test(x);
}
function normalizeColors(arr) {
  const out = [];
  const add = (val, image) => {
    val = String(val).trim();
    if (!isColorToken(val)) return;
    out.push({ color: val, image: (image && String(image).trim()) ? String(image).trim() : null });
  };
  (Array.isArray(arr) ? arr : []).forEach(raw => {
    if (raw && typeof raw === 'object' && raw.color != null) { add(raw.color, raw.image); return; }
    String(raw).split(/[,\s\n/:]+/).forEach(x => add(x, null));
  });
  return out;
}

// ── Field mapping (DB snake_case -> app camelCase) ──
function mapProductRow(r) {
  return {
    id: Number(r.id), // Postgres BIGINT comes back as a string; normalise to number
    name: r.name,
    code: r.code || '',
    price: Number(r.price),
    originalPrice: r.original_price != null ? Number(r.original_price) : Number(r.price),
    image: r.image || '',
    category: r.category || 'accessories',
    badge: r.badge || 'in-stock',
    colors: normalizeColors(r.colors),
    sizes: normalizeSizes(r.sizes),
    description: r.description || '',
    highlights: Array.isArray(r.highlights) ? r.highlights : []
  };
}

// ── Products ──
async function dbGetProducts() {
  const rows = await apiGet('/api/products');
  return (rows || []).map(mapProductRow);
}

async function dbGetProduct(id) {
  const row = await apiGet('/api/products/' + encodeURIComponent(id));
  return mapProductRow(row);
}

async function dbSaveProduct(p) {
  await apiSend('POST', '/api/products', p, true);
}

async function dbDeleteProduct(id) {
  await apiSend('DELETE', '/api/products/' + encodeURIComponent(id), null, true);
}

async function dbNextProductId() {
  const rows = await apiGet('/api/products');
  const max = (rows || []).reduce((m, r) => Math.max(m, Number(r.id) || 0), 0);
  return max + 1;
}

// ── Orders ──
async function dbInsertOrder(order) {
  await apiSend('POST', '/api/orders', order, false);
}

async function dbGetOrders() {
  const rows = await apiGet('/api/orders', true);
  return (rows || []).map(o => ({ ...o, date: o.created_at }));
}

async function dbUpdateOrderStatus(id, status) {
  await apiSend('PATCH', '/api/orders/' + encodeURIComponent(id), { status }, true);
}

async function dbDeleteOrder(id) {
  await apiSend('DELETE', '/api/orders/' + encodeURIComponent(id), null, true);
}

// ── Auth (admin) ──
async function dbSignIn(email, password) {
  try {
    const res = await apiSend('POST', '/api/login', { email, password }, false);
    setToken(res.token);
    return { error: null };
  } catch (e) {
    return { error: { message: e.message || 'Invalid email or password' } };
  }
}

async function dbSignOut() {
  setToken(null);
}

async function dbGetUser() {
  if (!getToken()) return null;
  try { await apiGet('/api/me', true); return { email: 'admin' }; }
  catch (e) { setToken(null); return null; }
}

// ── Catalogue loader for storefront pages ──
const CATALOGUE_CACHE = 'cv_catalogue_cache';

async function loadCatalogue() {
  try {
    const list = await dbGetProducts();
    PRODUCTS.length = 0;
    list.forEach(p => PRODUCTS.push(p));
    try { sessionStorage.setItem(CATALOGUE_CACHE, JSON.stringify(list)); } catch (e) {}
  } catch (e) {
    console.error('Catalogue load failed:', e);
    let cached = null;
    try { cached = JSON.parse(sessionStorage.getItem(CATALOGUE_CACHE)); } catch (e2) {}
    if (Array.isArray(cached) && cached.length) {
      PRODUCTS.length = 0;
      cached.forEach(p => PRODUCTS.push(p));
    } else if (!PRODUCTS.length) {
      DEFAULT_PRODUCTS.forEach(p => PRODUCTS.push({
        ...p,
        sizes: normalizeSizes(p.sizes),
        colors: normalizeColors(p.colors)
      }));
    }
  }
  return PRODUCTS;
}

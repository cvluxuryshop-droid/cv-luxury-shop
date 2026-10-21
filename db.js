/* ========================================
   CV LUXURY SHOP - Supabase Backend Layer
   Shared across storefront + admin
   ======================================== */

const SUPABASE_URL = 'https://aokojvmuxpsrqcomgmze.supabase.co';
const SUPABASE_KEY = 'sb_publishable_8hCn6N_auPv562uNgkHuJA_qX1U9hea';

// supabase-js (loaded via CDN) exposes window.supabase.createClient
const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Normalizers (handle values typed with commas, spaces or newlines) ──
function normalizeSizes(arr) {
  const out = [];
  (Array.isArray(arr) ? arr : []).forEach(raw => {
    String(raw).split(/[,\n]+/).forEach(part => {
      part = part.trim();
      if (!part) return;
      // split purely-numeric groups separated by spaces (e.g. "36 37 38")
      if (/^[\d\s.]+$/.test(part) && /\s/.test(part)) {
        part.split(/\s+/).forEach(t => { if (t) out.push(t); });
      } else {
        out.push(part);
      }
    });
  });
  return out.length ? out : ['One Size'];
}

function normalizeColors(arr) {
  const out = [];
  (Array.isArray(arr) ? arr : []).forEach(raw => {
    // split on commas, whitespace, slashes, colons — drops emoji/punctuation glue
    String(raw).split(/[,\s\n/:]+/).forEach(x => {
      x = x.trim();
      if (!x) return;
      // keep only valid hex codes or CSS color names (e.g. Black, Khaki, Beige)
      if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(x) || /^[A-Za-z]{3,}$/.test(x)) {
        out.push(x);
      }
    });
  });
  return out;
}

// ── Field mapping (DB snake_case <-> app camelCase) ──
function mapProductRow(r) {
  return {
    id: r.id,
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

function productToRow(p) {
  return {
    id: p.id,
    name: p.name,
    code: p.code,
    price: p.price,
    original_price: p.originalPrice,
    image: p.image,
    category: p.category,
    badge: p.badge,
    colors: p.colors,
    sizes: p.sizes,
    description: p.description,
    highlights: p.highlights
  };
}

// ── Products ──
async function dbGetProducts() {
  const { data, error } = await sb.from('products').select('*').order('id');
  if (error) throw error;
  return (data || []).map(mapProductRow);
}

async function dbSaveProduct(p) {
  const { error } = await sb.from('products').upsert(productToRow(p), { onConflict: 'id' });
  if (error) throw error;
}

async function dbDeleteProduct(id) {
  const { error } = await sb.from('products').delete().eq('id', id);
  if (error) throw error;
}

async function dbNextProductId() {
  const { data, error } = await sb.from('products').select('id').order('id', { ascending: false }).limit(1);
  if (error) throw error;
  return (data && data.length ? Number(data[0].id) : 0) + 1;
}

// ── Orders ──
async function dbInsertOrder(order) {
  const { error } = await sb.from('orders').insert({
    id: order.id,
    customer: order.customer,
    payment: order.payment,
    items: order.items,
    subtotal: order.subtotal,
    shipping: order.shipping,
    discount: order.discount,
    total: order.total,
    status: order.status || 'pending'
  });
  if (error) throw error;
}

async function dbGetOrders() {
  const { data, error } = await sb.from('orders').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []).map(o => ({ ...o, date: o.created_at }));
}

async function dbUpdateOrderStatus(id, status) {
  const { error } = await sb.from('orders').update({ status }).eq('id', id);
  if (error) throw error;
}

async function dbDeleteOrder(id) {
  const { error } = await sb.from('orders').delete().eq('id', id);
  if (error) throw error;
}

// ── Auth (admin) ──
async function dbSignIn(email, password) {
  return await sb.auth.signInWithPassword({ email, password });
}
async function dbSignOut() {
  return await sb.auth.signOut();
}
async function dbGetUser() {
  const { data } = await sb.auth.getUser();
  return data ? data.user : null;
}

// ── Catalogue loader for storefront pages ──
// Fills the global PRODUCTS array (declared in data.js) from the database.
async function loadCatalogue() {
  try {
    const list = await dbGetProducts();
    PRODUCTS.length = 0;
    list.forEach(p => PRODUCTS.push(p));
  } catch (e) {
    console.error('Catalogue load failed, using defaults:', e);
    if (!PRODUCTS.length) DEFAULT_PRODUCTS.forEach(p => PRODUCTS.push(p));
  }
  return PRODUCTS;
}

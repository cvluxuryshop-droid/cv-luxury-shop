/* ========================================
   CV LUXURY SHOP - Backend (Railway)
   Serves the static site + a small JSON API
   backed by PostgreSQL (Railway Postgres).
   ======================================== */

const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const zlib = require('zlib');

const app = express();
app.set('trust proxy', true); // real client IP behind Railway's proxy (for Meta CAPI)
const PORT = process.env.PORT || 3000;

// ── Config (set these in Railway → Variables) ──
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@cvluxury.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-railway-variables';
const META_CAPI_TOKEN = process.env.META_CAPI_TOKEN || '';          // Meta Conversions API access token
const META_TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE || ''; // optional, for Events Manager → Test Events

// ── Database ──
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id             BIGINT PRIMARY KEY,
      name           TEXT NOT NULL,
      code           TEXT,
      price          NUMERIC NOT NULL,
      original_price NUMERIC,
      image          TEXT,
      category       TEXT,
      badge          TEXT,
      colors         JSONB DEFAULT '[]',
      sizes          JSONB DEFAULT '[]',
      description    TEXT,
      highlights     JSONB DEFAULT '[]',
      created_at     TIMESTAMPTZ DEFAULT now()
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id          TEXT PRIMARY KEY,
      created_at  TIMESTAMPTZ DEFAULT now(),
      customer    JSONB NOT NULL,
      payment     TEXT,
      items       JSONB NOT NULL,
      subtotal    NUMERIC,
      shipping    NUMERIC,
      discount    NUMERIC,
      total       NUMERIC,
      status      TEXT DEFAULT 'pending'
    );
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  console.log('DB ready');
}

// ── Middleware ──
app.use(express.json({ limit: '15mb' })); // base64 images can be large

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid or expired session' });
  }
}

// ── Auth ──
app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  if (password === ADMIN_PASSWORD && (!ADMIN_EMAIL || email === ADMIN_EMAIL || !email)) {
    const token = jwt.sign({ role: 'admin', email: email || ADMIN_EMAIL }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, user: { email: email || ADMIN_EMAIL } });
  }
  res.status(401).json({ error: 'Invalid email or password' });
});

app.get('/api/me', requireAdmin, (req, res) => res.json({ ok: true }));

// ── Products ──
const LIST_COLS = 'id,name,code,price,original_price,image,category,badge,sizes';

// Photos are stored as base64 data URLs in the DB. For the storefront (?pub=1) we replace them with
// small, long-cached image URLs so the JSON stays tiny and each photo is downloaded only once.
const isDataUrl = (s) => typeof s === 'string' && s.startsWith('data:');
const imgVer = (s) => crypto.createHash('md5').update(s).digest('hex').slice(0, 10);

function publicImages(row) {
  const out = { ...row };
  if (isDataUrl(out.image)) out.image = `/api/products/${out.id}/img/main?v=${imgVer(out.image)}`;
  if (Array.isArray(out.colors)) {
    out.colors = out.colors.map((c, i) =>
      c && isDataUrl(c.image) ? { ...c, image: `/api/products/${out.id}/img/c${i}?v=${imgVer(c.image)}` } : c);
  }
  return out;
}

// gzip JSON replies (Express has no compression by default)
function sendJsonGzip(req, res, data) {
  const body = Buffer.from(JSON.stringify(data));
  res.type('application/json');
  if (body.length > 1024 && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    res.set('Content-Encoding', 'gzip').set('Vary', 'Accept-Encoding');
    return res.send(zlib.gzipSync(body));
  }
  res.send(body);
}

app.get('/api/products', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT ${LIST_COLS} FROM products ORDER BY id`);
    if (req.query.pub) return sendJsonGzip(req, res, rows.map(publicImages));
    sendJsonGzip(req, res, rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to load products' }); }
});

app.get('/api/products/:id/img/:slot', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT image, colors FROM products WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.sendStatus(404);
    const m = req.params.slot.match(/^(main|c(\d+))$/);
    if (!m) return res.sendStatus(404);
    const src = m[1] === 'main' ? rows[0].image : (rows[0].colors || [])[Number(m[2])]?.image;
    const d = isDataUrl(src) && src.match(/^data:([^;,]+);base64,(.*)$/s);
    if (!d) return res.sendStatus(404);
    res.set('Content-Type', d[1]).set('Cache-Control', 'public, max-age=31536000, immutable');
    res.send(Buffer.from(d[2], 'base64'));
  } catch (e) { console.error(e); res.sendStatus(500); }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    sendJsonGzip(req, res, req.query.pub ? publicImages(rows[0]) : rows[0]);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to load product' }); }
});

app.post('/api/products', requireAdmin, async (req, res) => {
  const p = req.body || {};
  try {
    await pool.query(`
      INSERT INTO products (id,name,code,price,original_price,image,category,badge,colors,sizes,description,highlights)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      ON CONFLICT (id) DO UPDATE SET
        name=$2, code=$3, price=$4, original_price=$5, image=$6, category=$7, badge=$8,
        colors=$9, sizes=$10, description=$11, highlights=$12
    `, [p.id, p.name, p.code, p.price, p.originalPrice, p.image, p.category, p.badge,
        JSON.stringify(p.colors || []), JSON.stringify(p.sizes || []), p.description, JSON.stringify(p.highlights || [])]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to save product' }); }
});

app.delete('/api/products/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to delete product' }); }
});

// ── Meta Conversions API (server-side tracking) ──
const sha = (v) => v ? crypto.createHash('sha256').update(String(v).trim().toLowerCase()).digest('hex') : undefined;
const bdPhone = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.startsWith('0') ? '88' + d : d; };

async function getPixelId() {
  const { rows } = await pool.query("SELECT value FROM settings WHERE key = 'pixelId'");
  return (rows[0] && rows[0].value) || '';
}

// events: [{ event_name, event_id, event_source_url, user_data, custom_data }]
async function sendCapi(req, events) {
  if (!META_CAPI_TOKEN) return;
  const pixelId = await getPixelId();
  if (!pixelId) return;
  const ip = req.ip;
  const ua = req.headers['user-agent'];
  const payload = {
    data: events.map(e => ({
      event_name: e.event_name,
      event_time: Math.floor(Date.now() / 1000),
      event_id: e.event_id,
      event_source_url: e.event_source_url,
      action_source: 'website',
      user_data: { client_ip_address: ip, client_user_agent: ua, ...e.user_data },
      custom_data: e.custom_data
    }))
  };
  if (META_TEST_EVENT_CODE) payload.test_event_code = META_TEST_EVENT_CODE;
  const r = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${encodeURIComponent(META_CAPI_TOKEN)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
  });
  if (!r.ok) console.error('Meta CAPI error', r.status, await r.text());
}

// Browser events relayed here so they are also sent server-side (deduplicated by event_id)
const TRACK_EVENTS = ['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout'];
app.post('/api/track', (req, res) => {
  res.json({ ok: true }); // never make the page wait on tracking
  const b = req.body || {};
  if (!TRACK_EVENTS.includes(b.event_name) || !b.event_id) return;
  const c = b.custom_data || {};
  sendCapi(req, [{
    event_name: b.event_name,
    event_id: String(b.event_id).slice(0, 64),
    event_source_url: String(b.event_source_url || '').slice(0, 500),
    user_data: { fbp: b.fbp || undefined, fbc: b.fbc || undefined },
    custom_data: {
      content_ids: Array.isArray(c.content_ids) ? c.content_ids.slice(0, 50).map(String) : undefined,
      content_name: c.content_name ? String(c.content_name).slice(0, 200) : undefined,
      content_type: c.content_type ? 'product' : undefined,
      num_items: Number.isFinite(Number(c.num_items)) ? Number(c.num_items) : undefined,
      value: Number.isFinite(Number(c.value)) ? Number(c.value) : undefined,
      currency: 'BDT'
    }
  }]).catch(e => console.error('Track failed:', e.message));
});

// ── Orders ──
// Anti-fake-order settings (keep in sync with checkout.js)
const FREE_SHIP_THRESHOLD = 5000, SHIP_INSIDE = 60, SHIP_OUTSIDE = 120, COUPON_CODE = 'CVLUXURY', COUPON_RATE = 0.10;
const ORDER_LIMIT_PER_IP = 5, ORDER_LIMIT_WINDOW_MS = 60 * 60 * 1000;   // 5 orders / hour / IP
const DUPLICATE_PHONE_MINUTES = 30;                                      // same phone: wait before next order
const BLOCKED_PHONES = new Set((process.env.BLOCKED_PHONES || '').split(',').map(s => bdPhone(s.trim())).filter(Boolean));

const orderHits = new Map(); // ip -> [timestamps]
function overIpLimit(ip) {
  const now = Date.now();
  const hits = (orderHits.get(ip) || []).filter(t => now - t < ORDER_LIMIT_WINDOW_MS);
  hits.push(now);
  orderHits.set(ip, hits);
  return hits.length > ORDER_LIMIT_PER_IP;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, hits] of orderHits) if (!hits.some(t => now - t < ORDER_LIMIT_WINDOW_MS)) orderHits.delete(ip);
}, 10 * 60 * 1000).unref();

app.post('/api/orders', async (req, res) => {
  const o = req.body || {};
  const fail = (code, msg) => res.status(code).json({ error: msg });
  try {
    // 1. Bots fill the hidden honeypot field: pretend success, save nothing
    if (o.website) return res.json({ ok: true });

    // 2. Per-IP rate limit
    if (overIpLimit(req.ip)) return fail(429, 'অনেকবার অর্ডার করার চেষ্টা হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।');

    // 3. Validate customer details
    const c = o.customer || {};
    const name = String(c.name || '').trim().slice(0, 100);
    const address = String(c.address || '').trim().slice(0, 500);
    const area = c.area === 'outside' ? 'outside' : 'inside';
    const phone = String(c.phone || '').replace(/[\s-]/g, '');
    if (!name || !address) return fail(400, 'নাম ও ঠিকানা দিন।');
    if (!/^01[3-9]\d{8}$/.test(phone)) return fail(400, 'সঠিক ১১ ডিজিটের মোবাইল নাম্বার দিন।');
    if (!/^CV\d{8}$/.test(String(o.id || ''))) return fail(400, 'Invalid order');
    if (BLOCKED_PHONES.has(bdPhone(phone))) return fail(403, 'এই নাম্বার থেকে অর্ডার নেওয়া যাচ্ছে না। আমাদের সাথে যোগাযোগ করুন।');

    // 4. Same phone ordering again too soon
    const dup = await pool.query(
      "SELECT 1 FROM orders WHERE customer->>'phone' = $1 AND created_at > now() - ($2 || ' minutes')::interval LIMIT 1",
      [phone, String(DUPLICATE_PHONE_MINUTES)]);
    if (dup.rows.length) return fail(429, 'এই নাম্বার থেকে একটু আগেই অর্ডার করা হয়েছে। আমরা শীঘ্রই যোগাযোগ করব।');

    // 5. Prices come from the database, never from the browser
    const req_items = Array.isArray(o.items) ? o.items.slice(0, 50) : [];
    const ids = [...new Set(req_items.map(i => String(i && i.id)))];
    if (!req_items.length || ids.some(id => !/^\d{1,18}$/.test(id))) return fail(400, 'Invalid cart');
    const { rows: prods } = await pool.query('SELECT id,name,price,image FROM products WHERE id = ANY($1::bigint[])', [ids]);
    const byId = new Map(prods.map(p => [String(p.id), p]));
    const items = [];
    for (const i of req_items) {
      const p = byId.get(String(i.id));
      const qty = Math.floor(Number(i.qty));
      if (!p || !(qty >= 1 && qty <= 20)) return fail(400, 'কার্টের কোনো পণ্য পাওয়া যায়নি। কার্ট রিফ্রেশ করুন।');
      items.push({ id: i.id, name: p.name, qty, size: i.size ? String(i.size).slice(0, 30) : null,
                   color: i.color ? String(i.color).slice(0, 30) : null, price: Number(p.price), image: p.image });
    }
    const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
    const shipping = subtotal >= FREE_SHIP_THRESHOLD ? 0 : (area === 'outside' ? SHIP_OUTSIDE : SHIP_INSIDE);
    const discount = String(o.coupon || '').toUpperCase() === COUPON_CODE ? Math.round(subtotal * COUPON_RATE) : 0;
    const total = subtotal + shipping - discount;

    await pool.query(`
      INSERT INTO orders (id,customer,payment,items,subtotal,shipping,discount,total,status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `, [o.id, JSON.stringify({ name, phone, address, area }), 'cod', JSON.stringify(items),
        subtotal, shipping, discount, total, 'pending']);
    res.json({ ok: true });

    // Server-side Purchase (same event_id as the browser Purchase → Meta deduplicates)
    const cu = { name, phone, address, area };
    const t = o.tracking || {};
    const [fn, ...rest] = name.split(/\s+/);
    sendCapi(req, [{
      event_name: 'Purchase',
      event_id: String(o.id),
      event_source_url: String(t.url || '').slice(0, 500),
      user_data: {
        ph: sha(bdPhone(cu.phone)) ? [sha(bdPhone(cu.phone))] : undefined,
        fn: sha(fn) ? [sha(fn)] : undefined,
        ln: sha(rest.join(' ')) ? [sha(rest.join(' '))] : undefined,
        ct: cu.area === 'inside' ? [sha('dhaka')] : undefined, // checkout only asks inside/outside Dhaka
        external_id: sha(bdPhone(cu.phone)) ? [sha(bdPhone(cu.phone))] : undefined,
        country: [sha('bd')],
        fbp: t.fbp || undefined,
        fbc: t.fbc || undefined
      },
      custom_data: {
        content_ids: items.map(i => String(i.id)),
        content_type: 'product',
        contents: items.map(i => ({ id: String(i.id), quantity: Number(i.qty) || 1, item_price: Number(i.price) || 0 })),
        num_items: items.reduce((s, i) => s + (Number(i.qty) || 0), 0),
        value: total,
        currency: 'BDT'
      }
    }]).catch(e => console.error('Purchase CAPI failed:', e.message));
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to place order' }); }
});

app.get('/api/orders', requireAdmin, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to load orders' }); }
});

app.patch('/api/orders/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [req.body.status, req.params.id]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to update order' }); }
});

app.delete('/api/orders/:id', requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM orders WHERE id = $1', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to delete order' }); }
});

// ── Site settings (contact info, social links) ──
const SETTING_KEYS = ['phone', 'whatsapp', 'email', 'address', 'facebook', 'instagram', 'youtube', 'tiktok', 'pixelId'];

app.get('/api/settings', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT key, value FROM settings');
    const out = {};
    rows.forEach(r => { if (SETTING_KEYS.includes(r.key)) out[r.key] = r.value; });
    res.json(out);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to load settings' }); }
});

app.put('/api/settings', requireAdmin, async (req, res) => {
  const body = req.body || {};
  try {
    for (const k of SETTING_KEYS) {
      if (typeof body[k] !== 'string') continue;
      await pool.query(`
        INSERT INTO settings (key, value) VALUES ($1, $2)
        ON CONFLICT (key) DO UPDATE SET value = $2
      `, [k, k === 'pixelId' ? body[k].replace(/\D/g, '').slice(0, 20) : body[k].trim().slice(0, 300)]);
    }
    res.json({ ok: true });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to save settings' }); }
});

// ── Durable tracking cookies ──
// Safari/iOS deletes cookies written by JavaScript after 7 days, so returning visitors look new to
// Meta/GA. Re-issuing _fbp / _fbc / _ga from the server (HTTP cookies) keeps them for ~13 months.
const TRACK_COOKIE_MAX_AGE = 395 * 24 * 60 * 60; // seconds
function parseCookies(h) {
  const out = {};
  String(h || '').split(';').forEach(p => {
    const i = p.indexOf('=');
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}
app.use((req, res, next) => {
  const isPage = req.method === 'GET' && (req.path === '/' || /\.html$/.test(req.path) || !/\.[a-z0-9]+$/i.test(req.path)) && !req.path.startsWith('/api/');
  if (!isPage || /admin/i.test(req.path)) return next();
  const c = parseCookies(req.headers.cookie);
  const opts = `; Max-Age=${TRACK_COOKIE_MAX_AGE}; Path=/; SameSite=Lax${req.secure ? '; Secure' : ''}`;
  const set = [];
  const fbp = /^fb\.\d\.\d+\.\d+$/.test(c._fbp || '') ? c._fbp
    : `fb.1.${Date.now()}.${crypto.randomInt(1e9, 1e10 - 1)}${crypto.randomInt(0, 10)}`; // same format Meta's pixel uses
  set.push(`_fbp=${fbp}${opts}`);
  const fbclid = typeof req.query.fbclid === 'string' ? req.query.fbclid.slice(0, 500) : '';
  if (fbclid && /^[\w-]+$/.test(fbclid)) set.push(`_fbc=fb.1.${Date.now()}.${fbclid}${opts}`);
  else if (/^fb\.\d\.\d+\./.test(c._fbc || '')) set.push(`_fbc=${c._fbc}${opts}`);
  // GA4 client id: create it on the first visit too (gtag reuses an existing _ga), and keep the
  // per-property session cookies (_ga_XXXXXXX) alive as well
  const ga = /^GA\d\.\d\.\d+\.\d+$/.test(c._ga || '') ? c._ga
    : `GA1.1.${crypto.randomInt(1e8, 2147483647)}.${Math.floor(Date.now() / 1000)}`;
  set.push(`_ga=${ga}${opts}`);
  for (const [k, v] of Object.entries(c)) {
    if (/^_ga_[A-Z0-9]{4,20}$/.test(k) && /^[\w.$-]{1,200}$/.test(v)) set.push(`${k}=${v}${opts}`);
  }
  res.append('Set-Cookie', set);
  next();
});

// ── Static site ──
// `extensions: ['html']` lets /admin, /checkout, /product resolve to the .html files
app.use(express.static(__dirname, { extensions: ['html'] }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// ── Start ──
initDb()
  .then(() => app.listen(PORT, '0.0.0.0', () => console.log('CV Luxury server running on ' + PORT)))
  .catch(err => { console.error('DB init failed:', err); app.listen(PORT, '0.0.0.0', () => console.log('Server up (DB error) on ' + PORT)); });

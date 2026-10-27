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

app.get('/api/products', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT ${LIST_COLS} FROM products ORDER BY id`);
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({ error: 'Failed to load products' }); }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
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
app.post('/api/orders', async (req, res) => {
  const o = req.body || {};
  try {
    await pool.query(`
      INSERT INTO orders (id,customer,payment,items,subtotal,shipping,discount,total,status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    `, [o.id, JSON.stringify(o.customer || {}), o.payment, JSON.stringify(o.items || []),
        o.subtotal, o.shipping, o.discount, o.total, o.status || 'pending']);
    res.json({ ok: true });

    // Server-side Purchase (same event_id as the browser Purchase → Meta deduplicates)
    const cu = o.customer || {};
    const t = o.tracking || {};
    const [fn, ...rest] = String(cu.name || '').trim().split(/\s+/);
    const items = Array.isArray(o.items) ? o.items : [];
    sendCapi(req, [{
      event_name: 'Purchase',
      event_id: String(o.id),
      event_source_url: String(t.url || '').slice(0, 500),
      user_data: {
        em: sha(cu.email) ? [sha(cu.email)] : undefined,
        ph: sha(bdPhone(cu.phone)) ? [sha(bdPhone(cu.phone))] : undefined,
        fn: sha(fn) ? [sha(fn)] : undefined,
        ln: sha(rest.join(' ')) ? [sha(rest.join(' '))] : undefined,
        ct: sha(String(cu.city || '').replace(/\s+/g, '')) ? [sha(String(cu.city).replace(/\s+/g, ''))] : undefined,
        country: [sha('bd')],
        fbp: t.fbp || undefined,
        fbc: t.fbc || undefined
      },
      custom_data: {
        content_ids: items.map(i => String(i.id)),
        content_type: 'product',
        contents: items.map(i => ({ id: String(i.id), quantity: Number(i.qty) || 1, item_price: Number(i.price) || 0 })),
        num_items: items.reduce((s, i) => s + (Number(i.qty) || 0), 0),
        value: Number(o.total) || 0,
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

// ── Static site ──
// `extensions: ['html']` lets /admin, /checkout, /product resolve to the .html files
app.use(express.static(__dirname, { extensions: ['html'] }));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// ── Start ──
initDb()
  .then(() => app.listen(PORT, '0.0.0.0', () => console.log('CV Luxury server running on ' + PORT)))
  .catch(err => { console.error('DB init failed:', err); app.listen(PORT, '0.0.0.0', () => console.log('Server up (DB error) on ' + PORT)); });

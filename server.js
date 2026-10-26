/* ========================================
   CV LUXURY SHOP - Backend (Railway)
   Serves the static site + a small JSON API
   backed by PostgreSQL (Railway Postgres).
   ======================================== */

const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Config (set these in Railway → Variables) ──
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@cvluxury.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-railway-variables';

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
const SETTING_KEYS = ['phone', 'whatsapp', 'email', 'address', 'facebook', 'instagram', 'youtube', 'tiktok'];

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
      `, [k, body[k].trim().slice(0, 300)]);
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

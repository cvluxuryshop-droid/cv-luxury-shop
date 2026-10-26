/* ========================================
   CV LUXURY SHOP - Admin Panel
   Order management (localStorage backed)
   ======================================== */

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
const STATUS_LABEL = {
  pending: 'Pending', processing: 'Processing', shipped: 'Shipped',
  delivered: 'Delivered', cancelled: 'Cancelled'
};
const PAY_LABEL = { cod: 'Cash on Delivery', bkash: 'bKash', nagad: 'Nagad' };

let orderFilter = 'all';
let orderQuery = '';

// In-memory order cache (loaded from Supabase)
const ORDERS = [];

// ── Data helpers ──
function loadOrders() { return ORDERS; }
async function refreshOrders() {
  try {
    const list = await dbGetOrders();
    ORDERS.length = 0;
    list.forEach(o => ORDERS.push(o));
  } catch (e) {
    console.error('Load orders failed:', e);
  }
}
function money(n) { return Number(n || 0).toLocaleString() + '৳'; }
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' · ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// ── Auth (Supabase) ──
document.addEventListener('DOMContentLoaded', async () => {
  $('#loginForm').addEventListener('submit', onLogin);
  $('#logoutBtn').addEventListener('click', onLogout);
  const user = await dbGetUser();
  if (user) showAdmin();
});

async function onLogin(e) {
  e.preventDefault();
  $('#loginError').textContent = '';
  const email = $('#loginUser').value.trim();
  const pass = $('#loginPass').value;
  const btn = $('#loginForm').querySelector('button[type="submit"]');
  const label = btn.textContent;
  btn.disabled = true; btn.textContent = 'Signing in...';
  const { error } = await dbSignIn(email, pass);
  btn.disabled = false; btn.textContent = label;
  if (error) { $('#loginError').textContent = error.message || 'Invalid email or password.'; return; }
  showAdmin();
}

async function onLogout(e) {
  e.preventDefault();
  await dbSignOut();
  location.reload();
}

async function showAdmin() {
  $('#loginGate').style.display = 'none';
  $('#adminShell').style.display = 'flex';
  initNav();
  initOrdersUI();
  initProductsUI();
  $('#exportBtn').addEventListener('click', exportCSV);
  $('#menuToggle').addEventListener('click', () => $('#sidebar').classList.toggle('open'));
  await Promise.all([refreshOrders(), loadCatalogue()]);
  renderAll();
}

// ── Navigation ──
function initNav() {
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-view]');
    if (!link) return;
    e.preventDefault();
    switchView(link.dataset.view);
  });
}

function switchView(view) {
  $$('.nav-item[data-view]').forEach(n => n.classList.toggle('active', n.dataset.view === view));
  $$('.view').forEach(v => v.classList.remove('active'));
  $('#view-' + view).classList.add('active');
  $('#viewTitle').textContent = view.charAt(0).toUpperCase() + view.slice(1);
  $('#sidebar').classList.remove('open');
  if (view === 'products') renderProducts();
}

// ── Render everything ──
function renderAll() {
  renderStats();
  renderRecent();
  renderOrders();
  updateNavBadge();
}

function updateNavBadge() {
  const pending = loadOrders().filter(o => o.status === 'pending').length;
  const el = $('#navOrderCount');
  el.textContent = pending;
  el.style.display = pending ? 'inline-flex' : 'none';
}

// ── Dashboard stats ──
function renderStats() {
  const orders = loadOrders();
  const revenue = orders.filter(o => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0);
  const pending = orders.filter(o => o.status === 'pending').length;
  const today = new Date().toDateString();
  const todayCount = orders.filter(o => new Date(o.date).toDateString() === today).length;

  const cards = [
    { label: 'Total Orders', value: orders.length, color: 'blue', icon: '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>' },
    { label: 'Total Revenue', value: money(revenue), color: 'green', icon: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>' },
    { label: 'Pending Orders', value: pending, color: 'orange', icon: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>' },
    { label: "Today's Orders", value: todayCount, color: 'purple', icon: '<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>' }
  ];

  $('#statsGrid').innerHTML = cards.map(c => `
    <div class="stat stat--${c.color}">
      <div class="stat__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${c.icon}</svg></div>
      <div class="stat__info">
        <div class="stat__value">${c.value}</div>
        <div class="stat__label">${c.label}</div>
      </div>
    </div>`).join('');
}

function renderRecent() {
  const orders = loadOrders().slice(0, 5);
  if (!orders.length) {
    $('#recentOrders').innerHTML = emptyState('No orders yet', 'Orders placed on the store will appear here.');
    return;
  }
  $('#recentOrders').innerHTML = ordersTableHTML(orders, false);
  wireRowActions('#recentOrders');
}

// ── Orders view ──
function initOrdersUI() {
  $('#orderSearch').addEventListener('input', (e) => { orderQuery = e.target.value.trim().toLowerCase(); renderOrders(); });
  $$('#statusFilters .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      $$('#statusFilters .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      orderFilter = chip.dataset.status;
      renderOrders();
    });
  });
}

function filteredOrders() {
  return loadOrders().filter(o => {
    if (orderFilter !== 'all' && o.status !== orderFilter) return false;
    if (orderQuery) {
      const hay = (o.id + ' ' + o.customer.name + ' ' + o.customer.phone).toLowerCase();
      if (!hay.includes(orderQuery)) return false;
    }
    return true;
  });
}

function renderOrders() {
  const orders = filteredOrders();
  if (!orders.length) {
    $('#ordersTable').innerHTML = emptyState('No orders found', 'Try a different search or filter.');
    updateNavBadge();
    return;
  }
  $('#ordersTable').innerHTML = ordersTableHTML(orders, true);
  wireRowActions('#ordersTable');
  updateNavBadge();
}

function ordersTableHTML(orders, withActions) {
  return `
  <table class="table">
    <thead>
      <tr>
        <th>Order</th><th>Customer</th><th>Date</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th>${withActions ? '<th></th>' : ''}
      </tr>
    </thead>
    <tbody>
      ${orders.map(o => `
        <tr data-id="${o.id}" class="row-click">
          <td class="mono">#${o.id}</td>
          <td>
            <div class="cell-strong">${o.customer.name}</div>
            <div class="cell-sub">${o.customer.phone}</div>
          </td>
          <td class="cell-sub">${fmtDate(o.date)}</td>
          <td>${o.items.reduce((s, i) => s + i.qty, 0)}</td>
          <td class="cell-strong">${money(o.total)}</td>
          <td class="cell-sub">${PAY_LABEL[o.payment] || o.payment}</td>
          <td><span class="status status--${o.status}">${STATUS_LABEL[o.status]}</span></td>
          ${withActions ? `<td class="row-actions">
            <button class="icon-btn view-btn" data-id="${o.id}" title="View">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </button>
            <button class="icon-btn danger del-btn" data-id="${o.id}" title="Delete">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </td>` : ''}
        </tr>`).join('')}
    </tbody>
  </table>`;
}

function wireRowActions(scope) {
  $$(`${scope} .row-click`).forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.del-btn')) return;
      openOrder(row.dataset.id);
    });
  });
  $$(`${scope} .del-btn`).forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteOrder(btn.dataset.id);
    });
  });
}

// ── Order detail drawer ──
function openOrder(id) {
  const o = loadOrders().find(x => x.id === id);
  if (!o) return;
  $('#drawerTitle').textContent = 'Order #' + o.id;

  const c = o.customer;
  $('#drawerBody').innerHTML = `
    <div class="d-section">
      <label>Status</label>
      <div class="status-picker" id="statusPicker">
        ${STATUSES.map(s => `<button class="status-opt status--${s} ${o.status === s ? 'active' : ''}" data-status="${s}">${STATUS_LABEL[s]}</button>`).join('')}
      </div>
    </div>

    <div class="d-section">
      <label>Customer</label>
      <div class="d-box">
        <div class="d-row"><span>Name</span><b>${c.name}</b></div>
        <div class="d-row"><span>Phone</span><b><a href="tel:${c.phone}">${c.phone}</a></b></div>
        ${c.email ? `<div class="d-row"><span>Email</span><b>${c.email}</b></div>` : ''}
        <div class="d-row"><span>Address</span><b>${c.address}, ${c.city}</b></div>
        <div class="d-row"><span>Area</span><b>${c.area === 'outside' ? 'Outside Dhaka' : 'Inside Dhaka'}</b></div>
        ${c.notes ? `<div class="d-row"><span>Notes</span><b>${c.notes}</b></div>` : ''}
        <div class="d-row"><span>Payment</span><b>${PAY_LABEL[o.payment] || o.payment}</b></div>
        <div class="d-row"><span>Placed</span><b>${fmtDate(o.date)}</b></div>
      </div>
    </div>

    <div class="d-section">
      <label>Items (${o.items.reduce((s, i) => s + i.qty, 0)})</label>
      <div class="d-items">
        ${o.items.map(i => `
          <div class="d-item">
            <img src="${i.image}" alt="${i.name}" width="46" height="46">
            <div class="d-item__info">
              <div class="d-item__name">${i.name}</div>
              <div class="d-item__meta">Size: ${i.size || '-'} · Qty: ${i.qty}</div>
            </div>
            <div class="d-item__price">${money(i.price * i.qty)}</div>
          </div>`).join('')}
      </div>
    </div>

    <div class="d-section">
      <div class="d-row"><span>Subtotal</span><b>${money(o.subtotal)}</b></div>
      <div class="d-row"><span>Shipping</span><b>${o.shipping === 0 ? 'FREE' : money(o.shipping)}</b></div>
      ${o.discount ? `<div class="d-row"><span>Discount</span><b class="text-green">-${money(o.discount)}</b></div>` : ''}
      <div class="d-row d-total"><span>Total</span><b>${money(o.total)}</b></div>
    </div>

    <button class="btn btn-danger btn-block" id="drawerDelete">Delete Order</button>
  `;

  // status change
  $$('#statusPicker .status-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      setOrderStatus(o.id, btn.dataset.status);
      $$('#statusPicker .status-opt').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
  $('#drawerDelete').addEventListener('click', () => deleteOrder(o.id, true));

  $('#orderDrawer').classList.add('open');
  $('#drawerOverlay').classList.add('open');
}

function closeDrawer() {
  $('#orderDrawer').classList.remove('open');
  $('#drawerOverlay').classList.remove('open');
}

async function setOrderStatus(id, status) {
  try {
    await dbUpdateOrderStatus(id, status);
  } catch (e) {
    console.error(e); toast('Could not update status'); return;
  }
  await refreshOrders();
  toast(`Order #${id} marked ${STATUS_LABEL[status]}`);
  renderAll();
}

async function deleteOrder(id, fromDrawer) {
  if (!confirm(`Delete order #${id}? This cannot be undone.`)) return;
  try {
    await dbDeleteOrder(id);
  } catch (e) {
    console.error(e); toast('Could not delete order'); return;
  }
  if (fromDrawer) closeDrawer();
  await refreshOrders();
  toast(`Order #${id} deleted`);
  renderAll();
}

// ── Products (full CRUD) ──
let productQuery = '';

function renderProducts() {
  const list = PRODUCTS.filter(p => {
    if (!productQuery) return true;
    return (p.name + ' ' + p.code + ' ' + p.category).toLowerCase().includes(productQuery);
  });

  if (!list.length) {
    $('#productsTable').innerHTML = emptyState('No products found', 'Try a different search or add a new product.');
    return;
  }

  $('#productsTable').innerHTML = `
  <table class="table">
    <thead><tr><th>Product</th><th>Code</th><th>Category</th><th>Price</th><th>Original</th><th>Badge</th><th></th></tr></thead>
    <tbody>
      ${list.map(p => `
        <tr>
          <td><div class="prod-cell"><img src="${p.image}" alt="${p.name}" width="40" height="40" onerror="this.style.visibility='hidden'"><span>${p.name}</span></div></td>
          <td class="mono">${p.code || '-'}</td>
          <td class="cell-sub">${p.category.replace('-', ' ')}</td>
          <td class="cell-strong">${money(p.price)}</td>
          <td class="cell-sub">${p.originalPrice ? '<s>' + money(p.originalPrice) + '</s>' : '-'}</td>
          <td><span class="status status--${p.badge === 'sale' ? 'processing' : p.badge === 'new' ? 'shipped' : 'delivered'}">${p.badge === 'in-stock' ? 'In Stock' : p.badge}</span></td>
          <td class="row-actions">
            <button class="icon-btn edit-prod" data-id="${p.id}" title="Edit">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <button class="icon-btn danger del-prod" data-id="${p.id}" title="Delete">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </td>
        </tr>`).join('')}
    </tbody>
  </table>`;

  $$('#productsTable .edit-prod').forEach(b => b.addEventListener('click', () => openProductForm(Number(b.dataset.id))));
  $$('#productsTable .del-prod').forEach(b => b.addEventListener('click', () => deleteProduct(Number(b.dataset.id))));
}

function initProductsUI() {
  $('#productSearch').addEventListener('input', (e) => { productQuery = e.target.value.trim().toLowerCase(); renderProducts(); });
  $('#addProductBtn').addEventListener('click', () => openProductForm(null));
  $('#productModalClose').addEventListener('click', closeProductForm);
  $('#productCancel').addEventListener('click', closeProductForm);
  $('#productModal').addEventListener('click', (e) => { if (e.target === e.currentTarget) closeProductForm(); });
  $('#productForm').addEventListener('submit', saveProduct);
  $('#pfAddSize').addEventListener('click', () => addSizeRow('', ''));
  $('#pfAddColor').addEventListener('click', () => addColorRow('', ''));

  // image upload → compressed dataURL (keeps images small & fast)
  $('#pfImageFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      $('#pfImage').value = dataUrl;
      showImagePreview(dataUrl);
    } catch (err) { console.error(err); toast('Could not process image'); }
  });
  $('#pfImage').addEventListener('input', () => showImagePreview($('#pfImage').value));
}

// Resize + compress an image file to a small JPEG data URL (much faster loading)
function compressImage(file, maxDim = 1000, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file.type || !file.type.startsWith('image/')) { reject(new Error('Not an image')); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w >= h) { h = Math.round(h * maxDim / w); w = maxDim; }
          else { w = Math.round(w * maxDim / h); h = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

function showImagePreview(src) {
  const img = $('#pfImagePreview');
  if (src) { img.src = src; img.style.display = 'block'; }
  else { img.style.display = 'none'; }
}

function addSizeRow(size, stock) {
  const row = document.createElement('div');
  row.className = 'pf-size-row';
  const sizeVal = (size == null ? '' : String(size)).replace(/"/g, '&quot;');
  const stockVal = (stock === null || stock === undefined || stock === '') ? '' : stock;
  row.innerHTML = `
    <input type="text" class="pf-size-name" placeholder="Size (e.g. 40)" value="${sizeVal}">
    <input type="number" class="pf-size-stock" placeholder="Stock (empty = ∞)" min="0" value="${stockVal}">
    <button type="button" class="pf-size-del" aria-label="Remove size">×</button>`;
  row.querySelector('.pf-size-del').addEventListener('click', () => row.remove());
  $('#pfSizesRows').appendChild(row);
}

function addColorRow(color, image) {
  const row = document.createElement('div');
  row.className = 'pf-color-row';
  const cv = (color == null ? '' : String(color)).replace(/"/g, '&quot;');
  const iv = (image == null ? '' : String(image)).replace(/"/g, '&quot;');
  row.innerHTML = `
    <input type="text" class="pf-color-val" placeholder="#000 or Black" value="${cv}">
    <input type="text" class="pf-color-img" placeholder="Image URL (or upload →)" value="${iv}">
    <label class="pf-color-upload" title="Upload image">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
      <input type="file" accept="image/*" hidden>
    </label>
    <img class="pf-color-preview" alt="" ${iv ? `src="${iv}"` : 'style="display:none"'}>
    <button type="button" class="pf-color-del" aria-label="Remove color">×</button>`;
  const fileInput = row.querySelector('input[type=file]');
  const imgField = row.querySelector('.pf-color-img');
  const preview = row.querySelector('.pf-color-preview');
  const showPrev = (src) => { if (src) { preview.src = src; preview.style.display = 'block'; } else { preview.style.display = 'none'; } };
  fileInput.addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const dataUrl = await compressImage(f);
      imgField.value = dataUrl;
      showPrev(dataUrl);
    } catch (err) { console.error(err); toast('Could not process image'); }
  });
  imgField.addEventListener('input', () => showPrev(imgField.value.trim()));
  row.querySelector('.pf-color-del').addEventListener('click', () => row.remove());
  $('#pfColorsRows').appendChild(row);
}

async function openProductForm(id) {
  $('#pfError').textContent = '';
  let p = null;
  if (id) {
    try { p = await dbGetProduct(id); }
    catch (e) { p = getProduct(id); }
  }
  $('#productModalTitle').textContent = p ? 'Edit Product' : 'Add Product';
  $('#pfId').value = p ? p.id : '';
  $('#pfName').value = p ? p.name : '';
  $('#pfCode').value = p ? (p.code || '') : '';
  $('#pfCategory').value = p ? p.category : 'women-shoes';
  $('#pfPrice').value = p ? p.price : '';
  $('#pfOriginal').value = p ? (p.originalPrice || '') : '';
  $('#pfBadge').value = p ? p.badge : 'in-stock';

  // Sizes + stock rows
  const rowsC = $('#pfSizesRows');
  rowsC.innerHTML = '';
  const sizes = (p && Array.isArray(p.sizes) && p.sizes.length) ? p.sizes : null;
  if (sizes) {
    sizes.forEach(s => addSizeRow(s && s.size != null ? s.size : s, s && s.stock != null ? s.stock : ''));
  } else {
    addSizeRow('', '');
  }

  // Colors + images rows
  const colorsC = $('#pfColorsRows');
  colorsC.innerHTML = '';
  const cols = (p && Array.isArray(p.colors) && p.colors.length) ? p.colors : null;
  if (cols) {
    cols.forEach(c => addColorRow(c && c.color != null ? c.color : c, c && c.image ? c.image : ''));
  } else {
    addColorRow('#1a1a1a', '');
  }
  $('#pfImage').value = p ? (p.image || '') : '';
  $('#pfDesc').value = p ? (p.description || '') : '';
  $('#pfHighlights').value = p ? (p.highlights || []).join('\n') : '';
  showImagePreview(p ? p.image : '');
  $('#productModal').classList.add('open');
}

function closeProductForm() {
  $('#productModal').classList.remove('open');
}

async function saveProduct(e) {
  e.preventDefault();
  const name = $('#pfName').value.trim();
  const price = Number($('#pfPrice').value);
  if (!name || !price) {
    $('#pfError').textContent = 'Name and price are required.';
    return;
  }

  const existingId = $('#pfId').value ? Number($('#pfId').value) : null;
  const id = existingId || await dbNextProductId();

  const colorRows = [];
  $$('#pfColorsRows .pf-color-row').forEach(r => {
    const val = r.querySelector('.pf-color-val').value.trim();
    if (!val) return;
    const img = r.querySelector('.pf-color-img').value.trim();
    colorRows.push({ color: val, image: img || null });
  });
  const colors = normalizeColors(colorRows);

  const sizeRows = [];
  $$('#pfSizesRows .pf-size-row').forEach(r => {
    const nm = r.querySelector('.pf-size-name').value.trim();
    if (!nm) return;
    const st = r.querySelector('.pf-size-stock').value.trim();
    sizeRows.push({ size: nm, stock: st === '' ? null : Number(st) });
  });

  const data = {
    id,
    name,
    code: $('#pfCode').value.trim() || ('CVL-' + String(id).padStart(3, '0')),
    price,
    originalPrice: Number($('#pfOriginal').value) || price,
    image: $('#pfImage').value.trim() || 'img/products/heels-rose-gold.jpg',
    category: $('#pfCategory').value,
    badge: $('#pfBadge').value,
    colors: colors.length ? colors : [{ color: '#1a1a1a', image: null }],
    sizes: normalizeSizes(sizeRows.length ? sizeRows : [{ size: 'One Size', stock: null }]),
    description: $('#pfDesc').value.trim(),
    highlights: $('#pfHighlights').value.split('\n').map(s => s.trim()).filter(Boolean)
  };

  try {
    await dbSaveProduct(data);
  } catch (err) {
    console.error(err);
    $('#pfError').textContent = 'Could not save. Are you logged in? ' + (err.message || '');
    return;
  }

  await loadCatalogue();
  closeProductForm();
  renderProducts();
  toast(existingId ? 'Product updated' : 'Product added');
}

async function deleteProduct(id) {
  const p = getProduct(id);
  if (!confirm(`Delete "${p ? p.name : 'this product'}"? This cannot be undone.`)) return;
  try {
    await dbDeleteProduct(id);
  } catch (err) {
    console.error(err); toast('Could not delete product'); return;
  }
  await loadCatalogue();
  renderProducts();
  toast('Product deleted');
}

// ── CSV export ──
function exportCSV() {
  const orders = filteredOrders();
  if (!orders.length) { toast('No orders to export'); return; }
  const rows = [['Order ID', 'Date', 'Name', 'Phone', 'Address', 'City', 'Payment', 'Items', 'Total', 'Status']];
  orders.forEach(o => {
    rows.push([
      o.id, new Date(o.date).toLocaleString('en-GB'), o.customer.name, o.customer.phone,
      o.customer.address, o.customer.city, PAY_LABEL[o.payment] || o.payment,
      o.items.reduce((s, i) => s + i.qty, 0), o.total, STATUS_LABEL[o.status]
    ]);
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cv-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('CSV exported');
}

// ── Utilities ──
function emptyState(title, sub) {
  return `<div class="empty">
    <svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
    <h4>${title}</h4><p>${sub}</p></div>`;
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  $('#toastMsg').textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// drawer close wiring (always available)
document.addEventListener('DOMContentLoaded', () => {
  $('#drawerClose').addEventListener('click', closeDrawer);
  $('#drawerOverlay').addEventListener('click', closeDrawer);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
});

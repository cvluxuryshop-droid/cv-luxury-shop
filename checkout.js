/* ========================================
   CV LUXURY SHOP - Checkout Page
   ======================================== */

const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const FREE_SHIP_THRESHOLD = 5000;
const SHIP_INSIDE = 60;
const SHIP_OUTSIDE = 120;

let couponApplied = false;

document.addEventListener('DOMContentLoaded', async () => {
  await loadCatalogue();
  $('#cartCount').textContent = cartCount();

  if (!getCart().length) {
    renderEmpty();
    return;
  }

  renderSummaryItems();
  recalc();
  trackPixel('InitiateCheckout', {
    content_ids: getCart().map(i => String(i.id)), content_type: 'product',
    num_items: cartCount(), value: cartTotal(), currency: 'BDT'
  });

  $('#fArea').addEventListener('change', recalc);
  $('#couponBtn').addEventListener('click', applyCoupon);
  $('#couponInput').addEventListener('keyup', (e) => { if (e.key === 'Enter') applyCoupon(); });
  $('#placeOrderBtn').addEventListener('click', placeOrder);
});

function renderEmpty() {
  $('#checkoutGrid').innerHTML = `
    <div class="checkout__empty">
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
      <h2>Your cart is empty</h2>
      <p>Add some products before checking out.</p>
      <a href="index.html#shop" class="btn-primary">Start Shopping</a>
    </div>`;
  document.querySelector('.checkout__steps').style.display = 'none';
}

function renderSummaryItems() {
  const cart = getCart();
  $('#summaryItems').innerHTML = cart.map(item => {
    const p = getProduct(item.id);
    if (!p) return '';
    return `
      <div class="summary__item">
        <div class="summary__item-img">
          <img src="${p.image}" alt="${p.name}" width="56" height="56">
          <span class="summary__item-qty">${item.qty}</span>
        </div>
        <div class="summary__item-info">
          <div class="summary__item-name">${p.name}</div>
          <div class="summary__item-meta">Size: ${item.size || '-'}${item.color ? ' · Color: ' + item.color : ''}</div>
        </div>
        <div class="summary__item-price">${fmtBDT(p.price * item.qty)}</div>
      </div>`;
  }).join('');
}

function shippingFee(subtotal) {
  if (subtotal >= FREE_SHIP_THRESHOLD) return 0;
  return $('#fArea').value === 'outside' ? SHIP_OUTSIDE : SHIP_INSIDE;
}

function recalc() {
  const subtotal = cartTotal();
  const ship = shippingFee(subtotal);
  let discount = 0;
  if (couponApplied) discount = Math.round(subtotal * 0.10); // 10% off

  const total = subtotal + ship - discount;

  $('#sumSubtotal').textContent = fmtBDT(subtotal);
  $('#sumShipping').textContent = ship === 0 ? 'FREE' : fmtBDT(ship);
  if (couponApplied) {
    $('#discountRow').style.display = 'flex';
    $('#sumDiscount').textContent = '-' + fmtBDT(discount);
  } else {
    $('#discountRow').style.display = 'none';
  }
  $('#sumTotal').textContent = fmtBDT(total);
}

function applyCoupon() {
  const code = $('#couponInput').value.trim().toUpperCase();
  if (code === 'CVLUXURY') {
    if (couponApplied) { showToast('Coupon already applied'); return; }
    couponApplied = true;
    showToast('Coupon applied — 10% off! 🎉');
    recalc();
  } else {
    showToast('Invalid coupon code');
  }
}

async function placeOrder() {
  // Validate required fields
  const name = $('#fName').value.trim();
  const phone = $('#fPhone').value.trim();
  const address = $('#fAddress').value.trim();
  const city = $('#fCity').value.trim();

  if (!name || !phone || !address || !city) {
    showToast('Please fill in all required fields *');
    [['#fName', name], ['#fPhone', phone], ['#fAddress', address], ['#fCity', city]].forEach(([sel, val]) => {
      $(sel).classList.toggle('invalid', !val);
    });
    document.querySelector('.checkout__form').scrollIntoView({ behavior: 'smooth' });
    return;
  }
  if (!/^01\d{9}$/.test(phone.replace(/\s|-/g, ''))) {
    showToast('Please enter a valid 11-digit phone number');
    $('#fPhone').classList.add('invalid');
    return;
  }

  // Build order (client-side only)
  const orderId = 'CV' + Date.now().toString().slice(-8);
  const subtotal = cartTotal();
  const ship = shippingFee(subtotal);
  const discount = couponApplied ? Math.round(subtotal * 0.10) : 0;
  const total = subtotal + ship - discount;
  const payment = (document.querySelector('input[name="pay"]:checked') || {}).value || 'cod';

  const order = {
    id: orderId,
    date: new Date().toISOString(),
    customer: {
      name,
      phone,
      email: $('#fEmail').value.trim(),
      address,
      city,
      area: $('#fArea').value,
      notes: $('#fNotes').value.trim()
    },
    payment,
    items: getCart().map(i => {
      const p = getProduct(i.id);
      return { id: i.id, name: p ? p.name : 'Item', qty: i.qty, size: i.size, color: i.color || null, price: p ? p.price : 0, image: p ? p.image : '' };
    }),
    subtotal, shipping: ship, discount, total,
    status: 'pending'
  };

  // Save order to Supabase
  const btn = $('#placeOrderBtn');
  btn.disabled = true;
  btn.textContent = 'Placing order...';
  try {
    await dbInsertOrder(order);
  } catch (err) {
    console.error(err);
    showToast('Could not place order. Please try again.');
    btn.disabled = false;
    btn.textContent = 'Place Order';
    return;
  }

  trackPixel('Purchase', {
    content_ids: order.items.map(i => String(i.id)), content_type: 'product',
    contents: order.items.map(i => ({ id: String(i.id), quantity: i.qty, item_price: i.price })),
    num_items: order.items.reduce((s, i) => s + i.qty, 0), value: total, currency: 'BDT'
  }, { eventID: orderId });

  // Clear cart
  setCart([]);

  // Show success
  $('#checkoutGrid').style.display = 'none';
  document.querySelector('.checkout__steps').innerHTML = `
    <span class="step done">1. Cart</span>
    <span class="step done">2. Checkout</span>
    <span class="step active">3. Confirmation</span>`;
  $('#orderId').textContent = '#' + orderId;
  $('#orderSuccess').style.display = 'block';
  $('#cartCount').textContent = '0';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showToast(msg) {
  const toast = $('#toast');
  $('#toastMessage').textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// clear invalid state on input
document.addEventListener('input', (e) => {
  if (e.target.classList.contains('invalid')) e.target.classList.remove('invalid');
});

/**
 * OrangePOS — Main Application
 * Full-featured POS for Orange Pi One
 */

/* ============================
   STATE
   ============================ */
const App = {
  currentUser: null,
  cart: [],
  discount: { type: 'none', value: 0 },
  selectedCustomerId: null,
  currentView: 'pos',
  currentOrderId: null,
  pricingMode: 'retail', // 'retail' | 'wholesale'
};

const TAX_RATE_DEFAULT = 12;

/* Returns the effective price for a product given current pricing mode */
function getActivePrice(product) {
  const s = Store.getSettings();
  if (App.pricingMode === 'wholesale' && s.wholesaleEnabled) {
    const disc = (s.wholesaleDiscount || 0) / 100;
    return Math.round(product.price * (1 - disc) * 100) / 100;
  }
  return product.price;
}

/* ============================
   UTILITIES
   ============================ */
function fmt(n) {
  const s = Store.getSettings();
  return (s.currency || '₱') + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(ts) {
  return new Date(ts).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function toast(msg, type = '') {
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' ' + type : '');
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => {
    el.classList.add('fade-out');
    setTimeout(() => el.remove(), 350);
  }, 3000);
}
function showModal(id) { document.getElementById(id).classList.remove('hidden'); }
function hideModal(id) { document.getElementById(id).classList.add('hidden'); }
function confirm(title, msg) {
  return new Promise(resolve => {
    document.getElementById('confirm-title').textContent = title;
    document.getElementById('confirm-message').textContent = msg;
    showModal('modal-confirm');
    document.getElementById('confirm-ok').onclick = () => { hideModal('modal-confirm'); resolve(true); };
    document.getElementById('confirm-cancel').onclick = () => { hideModal('modal-confirm'); resolve(false); };
  });
}
function audit(action, details) {
  Store.addAuditEntry({
    id: OrangeCrypto.uid(),
    ts: Date.now(),
    user: App.currentUser ? App.currentUser.name : 'System',
    action,
    details: typeof details === 'object' ? JSON.stringify(details) : String(details),
  });
}

/* ============================
   SEED DATA
   ============================ */
async function seedDefaultData() {
  // Users
  if (!Store.getUsers().length) {
    const adminHash = await OrangeCrypto.hashPin('1234');
    const cashierHash = await OrangeCrypto.hashPin('5678');
    Store.saveUsers([
      { id: OrangeCrypto.uid(), name: 'Admin User', role: 'admin', pinHash: adminHash, active: true, createdAt: Date.now(), lastLogin: null },
      { id: OrangeCrypto.uid(), name: 'Cashier 1', role: 'cashier', pinHash: cashierHash, active: true, createdAt: Date.now(), lastLogin: null },
    ]);
  }
  // Categories
  if (!Store.getCategories().length) {
    Store.saveCategories([
      { id: OrangeCrypto.uid(), name: 'Groceries', color: '#E8650A' },
      { id: OrangeCrypto.uid(), name: 'Beverages', color: '#1A7D45' },
      { id: OrangeCrypto.uid(), name: 'Snacks', color: '#1155AA' },
      { id: OrangeCrypto.uid(), name: 'Personal Care', color: '#8B5CF6' },
      { id: OrangeCrypto.uid(), name: 'Household', color: '#888' },
    ]);
  }
  // Products
  if (!Store.getProducts().length) {
    const cats = Store.getCategories();
    const groc = cats.find(c => c.name === 'Groceries')?.id || cats[0]?.id;
    const bev  = cats.find(c => c.name === 'Beverages')?.id || cats[0]?.id;
    const snk  = cats.find(c => c.name === 'Snacks')?.id || cats[0]?.id;
    const care = cats.find(c => c.name === 'Personal Care')?.id || cats[0]?.id;
    const hh   = cats.find(c => c.name === 'Household')?.id || cats[0]?.id;
    Store.saveProducts([
      { id: OrangeCrypto.uid(), name: 'Rice (5kg)', sku: 'GRC001', categoryId: groc, price: 280, cost: 220, stock: 30, unit: 'bag', trackStock: true, active: true, createdAt: Date.now() },
      { id: OrangeCrypto.uid(), name: 'Cooking Oil (1L)', sku: 'GRC002', categoryId: groc, price: 95, cost: 70, stock: 40, unit: 'bottle', trackStock: true, active: true, createdAt: Date.now() },
      { id: OrangeCrypto.uid(), name: 'Sugar (1kg)', sku: 'GRC003', categoryId: groc, price: 75, cost: 58, stock: 50, unit: 'pack', trackStock: true, active: true, createdAt: Date.now() },
      { id: OrangeCrypto.uid(), name: 'Softdrinks 1.5L', sku: 'BEV001', categoryId: bev, price: 65, cost: 45, stock: 60, unit: 'bottle', trackStock: true, active: true, createdAt: Date.now() },
      { id: OrangeCrypto.uid(), name: 'Mineral Water 500ml', sku: 'BEV002', categoryId: bev, price: 20, cost: 10, stock: 100, unit: 'bottle', trackStock: true, active: true, createdAt: Date.now() },
      { id: OrangeCrypto.uid(), name: 'Coffee 3-in-1 (10s)', sku: 'BEV003', categoryId: bev, price: 55, cost: 38, stock: 80, unit: 'pack', trackStock: true, active: true, createdAt: Date.now() },
      { id: OrangeCrypto.uid(), name: 'Potato Chips 60g', sku: 'SNK001', categoryId: snk, price: 35, cost: 22, stock: 60, unit: 'pack', trackStock: true, active: true, createdAt: Date.now() },
      { id: OrangeCrypto.uid(), name: 'Biscuits 150g', sku: 'SNK002', categoryId: snk, price: 28, cost: 18, stock: 4, unit: 'pack', trackStock: true, active: true, createdAt: Date.now() },
      { id: OrangeCrypto.uid(), name: 'Shampoo Sachet', sku: 'CRE001', categoryId: care, price: 8, cost: 4, stock: 200, unit: 'pc', trackStock: true, active: true, createdAt: Date.now() },
      { id: OrangeCrypto.uid(), name: 'Soap Bar 90g', sku: 'CRE002', categoryId: care, price: 32, cost: 20, stock: 80, unit: 'bar', trackStock: true, active: true, createdAt: Date.now() },
      { id: OrangeCrypto.uid(), name: 'Dishwashing Liquid', sku: 'HH001', categoryId: hh, price: 45, cost: 30, stock: 35, unit: 'bottle', trackStock: true, active: true, createdAt: Date.now() },
      { id: OrangeCrypto.uid(), name: 'Laundry Detergent', sku: 'HH002', categoryId: hh, price: 68, cost: 48, stock: 25, unit: 'pack', trackStock: true, active: true, createdAt: Date.now() },
    ]);
  }
  // Sample customers
  if (!Store.getCustomers().length) {
    Store.saveCustomers([
      { id: OrangeCrypto.uid(), name: 'Juan dela Cruz', phone: '09171234567', email: 'juan@example.com', address: 'Manila', senior: false, points: 120, totalSpent: 2400, visits: 12, createdAt: Date.now() },
      { id: OrangeCrypto.uid(), name: 'Maria Santos', phone: '09281234567', email: '', address: 'Quezon City', senior: true, points: 55, totalSpent: 1100, visits: 5, createdAt: Date.now() },
    ]);
  }
}

/* ============================
   AUTH
   ============================ */
async function initAuth() {
  const session = Store.getSession();
  if (session) {
    // Validate session is still a valid user
    const users = Store.getUsers();
    const user = users.find(u => u.id === session.id && u.active !== false);
    if (user) {
      App.currentUser = user;
      enterPOS();
      return;
    }
    Store.clearSession();
  }
  showScreen('screen-login');
}

document.getElementById('form-login').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pin = document.getElementById('login-pin').value;
  const errEl = document.getElementById('login-error');
  if (!pin) return;
  const pinHash = await OrangeCrypto.hashPin(pin);
  const user = Store.getUserByPin(pinHash);
  if (!user) {
    errEl.classList.remove('hidden');
    document.getElementById('login-pin').value = '';
    document.getElementById('login-pin').focus();
    return;
  }
  errEl.classList.add('hidden');
  App.currentUser = user;
  user.lastLogin = Date.now();
  Store.upsertUser(user);
  Store.setSession(user);
  audit('LOGIN', `User "${user.name}" logged in`);
  enterPOS();
});

document.getElementById('login-pin').addEventListener('blur', () => {
  if (IS_TOUCH_DEVICE) return; // don't fight the on-screen keyboard on phones
  if (!document.getElementById('screen-login').classList.contains('active')) return;
  setTimeout(() => {
    if (document.getElementById('screen-login').classList.contains('active')) {
      document.getElementById('login-pin').focus();
    }
  }, 100);
});

function lockTerminal(reason = 'manual') {
  AutoLock.cancel();
  audit('LOCK', `Terminal locked by "${App.currentUser?.name}" (${reason})`);
  App.currentUser = null;
  Store.clearSession();
  document.getElementById('login-pin').value = '';
  document.getElementById('login-error').classList.add('hidden');
  showScreen('screen-login');
  // Focus PIN input immediately
  setTimeout(() => document.getElementById('login-pin').focus(), 100);
}

document.getElementById('btn-lock').addEventListener('click', () => lockTerminal('manual'));

/* ============================
   AUTO-LOCK / IDLE TIMEOUT
   ============================ */
const AutoLock = (() => {
  let idleTimer = null;
  let warnTimer = null;
  let countdownInterval = null;
  let warnEl = null;

  const WARN_SECONDS = 30; // show warning 30s before locking

  function reset() {
    if (!App.currentUser) return; // not logged in
    const s = Store.getSettings();
    if (!s.autoLockEnabled) return;
    const ms = (s.autoLockMinutes || 5) * 60 * 1000;
    const warnMs = ms - WARN_SECONDS * 1000;

    cancel();

    // Warning timer
    if (warnMs > 0) {
      warnTimer = setTimeout(showWarning, warnMs);
    }
    // Lock timer
    idleTimer = setTimeout(() => {
      hideWarning();
      lockTerminal('idle timeout');
      toast('Terminal locked due to inactivity', 'warning');
    }, ms);
  }

  function cancel() {
    clearTimeout(idleTimer);
    clearTimeout(warnTimer);
    clearInterval(countdownInterval);
    idleTimer = null;
    warnTimer = null;
    hideWarning();
  }

  function showWarning() {
    // Don't show warning if a modal (like checkout) is open
    const anyModalOpen = [...document.querySelectorAll('.modal-overlay')].some(m => !m.classList.contains('hidden'));
    if (anyModalOpen) { reset(); return; }

    if (!warnEl) {
      warnEl = document.createElement('div');
      warnEl.id = 'autolock-warning';
      warnEl.className = 'autolock-warning';
      warnEl.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>Locking in <strong id="autolock-countdown">${WARN_SECONDS}</strong>s due to inactivity</span>
        <button id="autolock-stay" class="autolock-stay-btn">I'm here</button>`;
      document.body.appendChild(warnEl);
      document.getElementById('autolock-stay').addEventListener('click', () => { reset(); });
    }
    warnEl.classList.add('visible');

    let remaining = WARN_SECONDS;
    countdownInterval = setInterval(() => {
      remaining--;
      const el = document.getElementById('autolock-countdown');
      if (el) el.textContent = remaining;
      if (remaining <= 0) clearInterval(countdownInterval);
    }, 1000);
  }

  function hideWarning() {
    clearInterval(countdownInterval);
    if (warnEl) warnEl.classList.remove('visible');
  }

  // Track any user activity — mouse, touch, keyboard
  function attachListeners() {
    const events = ['mousemove', 'mousedown', 'touchstart', 'keydown', 'scroll'];
    events.forEach(evt => {
      document.addEventListener(evt, () => {
        if (App.currentUser) reset();
      }, { passive: true });
    });
  }

  return { reset, cancel, attachListeners };
})();

// Start auto-lock listeners once on page load
AutoLock.attachListeners();

function enterPOS() {
  const user = App.currentUser;
  // Update nav user info
  document.getElementById('nav-user-name').textContent = user.name;
  document.getElementById('nav-user-role').textContent = capitalizeFirst(user.role);
  document.getElementById('nav-user-avatar').textContent = user.name.split(' ').map(n => n[0]).join('').substring(0,2).toUpperCase();
  // Show/hide admin nav
  document.querySelectorAll('.admin-only').forEach(el => {
    el.classList.toggle('visible', user.role === 'admin' || user.role === 'manager');
  });
  showScreen('screen-pos');
  renderCategoryTabs();
  renderProductGrid();
  renderCartCustomers();
  loadCurrentView('pos');
  setTimeout(maintainSearchFocus, 100);
  setTimeout(checkLowStockAlerts, 200);
  setTimeout(updatePricingToggleUI, 50);
  Sync.updateSyncBadge();
  AutoLock.reset();
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  document.body.classList.remove('loading');
  if (id === 'screen-login') {
    setTimeout(() => document.getElementById('login-pin').focus(), 50);
  }
}

/* ============================
   NAVIGATION
   ============================ */
document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();
    const view = link.dataset.view;
    if (!view) return;
    // Check admin access
    if ((view === 'admin') && App.currentUser.role === 'cashier') {
      toast('Access denied: Admin only', 'error');
      return;
    }
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    loadCurrentView(view);
  });
});

function loadCurrentView(view) {
  App.currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const el = document.getElementById('view-' + view);
  if (el) el.classList.add('active');
  if (view === 'pos') setTimeout(maintainSearchFocus, 50);
  if (view === 'orders') renderOrders();
  if (view === 'inventory') renderInventory();
  if (view === 'customers') renderCustomers();
  if (view === 'reports') renderReports();
  if (view === 'admin') renderAdmin();
  if (view === 'zreport') renderZReport();
}

function capitalizeFirst(str) { return str ? str[0].toUpperCase() + str.slice(1) : ''; }

/* ============================
   PRODUCT GRID
   ============================ */
let currentCat = 'all';
let searchTerm = '';

function renderCategoryTabs() {
  const tabs = document.getElementById('category-tabs');
  const cats = Store.getCategories();
  tabs.innerHTML = `<button class="cat-tab ${currentCat === 'all' ? 'active' : ''}" data-cat="all">All</button>`;
  cats.forEach(cat => {
    tabs.innerHTML += `<button class="cat-tab ${currentCat === cat.id ? 'active' : ''}" data-cat="${escHtml(cat.id)}">${escHtml(cat.name)}</button>`;
  });
  tabs.querySelectorAll('.cat-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      currentCat = btn.dataset.cat;
      tabs.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderProductGrid();
    });
  });
}

function renderProductGrid() {
  const settings = Store.getSettings();
  const grid = document.getElementById('product-grid');
  let products = Store.getProducts().filter(p => p.active !== false);
  if (currentCat !== 'all') products = products.filter(p => p.categoryId === currentCat);
  if (searchTerm) {
    const s = searchTerm.toLowerCase();
    products = products.filter(p =>
      p.name.toLowerCase().includes(s) ||
      (p.sku || '').toLowerCase().includes(s)
    );
  }
  if (!products.length) {
    grid.innerHTML = `<div class="cart-empty" style="grid-column:1/-1;height:200px"><p>No products found</p></div>`;
    return;
  }
  const lowQty = settings.lowStockQty || 5;
  const showWholesale = settings.wholesaleEnabled;
  const wholesaleDisc = (settings.wholesaleDiscount || 0) / 100;

  grid.innerHTML = products.map(p => {
    const outOfStock = p.trackStock !== false && p.stock <= 0;
    const lowStock = p.trackStock !== false && p.stock > 0 && p.stock <= lowQty;
    const extraClass = outOfStock ? 'out-of-stock' : lowStock ? 'low-stock-card' : '';
    const stockLabel = p.trackStock === false ? '' : `<span class="product-stock ${outOfStock ? 'out' : lowStock ? 'low' : ''}">${outOfStock ? 'Out of stock' : `${p.stock} ${p.unit || 'pcs'}`}</span>`;
    const wsPrice = Math.round(p.price * (1 - wholesaleDisc) * 100) / 100;
    const isWholesaleActive = App.pricingMode === 'wholesale' && showWholesale;
    const displayPrice = isWholesaleActive ? wsPrice : p.price;
    const priceHtml = showWholesale
      ? `<div class="product-price ${isWholesaleActive ? 'ws-active' : ''}">${fmt(displayPrice)}</div>
         <div class="product-price-sub">${isWholesaleActive
           ? `<span class="price-label-small retail-sub">Retail ${fmt(p.price)}</span>`
           : `<span class="price-label-small ws-sub">WS ${fmt(wsPrice)}</span>`}</div>`
      : `<div class="product-price">${fmt(p.price)}</div>`;
    return `
      <div class="product-card ${extraClass}" data-id="${p.id}">
        <div class="product-name">${escHtml(p.name)}</div>
        ${priceHtml}
        ${stockLabel}
      </div>`;
  }).join('');
  grid.querySelectorAll('.product-card:not(.out-of-stock)').forEach(card => {
    card.addEventListener('click', () => addToCart(card.dataset.id));
  });
}

document.getElementById('product-search').addEventListener('input', (e) => {
  searchTerm = e.target.value;
  renderProductGrid();
});

/* ============================
   CART
   ============================ */
function addToCart(productId) {
  const product = Store.getProducts().find(p => p.id === productId);
  if (!product) return;
  const activePrice = getActivePrice(product);
  const existing = App.cart.find(i => i.productId === productId);
  if (existing) {
    if (product.trackStock !== false && existing.qty >= product.stock) {
      toast('Not enough stock', 'error'); return;
    }
    existing.qty++;
    // Update price in case mode changed
    existing.price = activePrice;
  } else {
    App.cart.push({ productId, name: product.name, price: activePrice, qty: 1 });
  }
  renderCart();
  renderProductGrid();
}

function setPricingMode(mode) {
  App.pricingMode = mode;
  const s = Store.getSettings();
  // Re-price every item already in cart
  const products = Store.getProducts();
  App.cart.forEach(item => {
    const product = products.find(p => p.id === item.productId);
    if (product) item.price = getActivePrice(product);
  });
  renderCart();
  renderProductGrid();
  updatePricingToggleUI();
  const label = mode === 'wholesale' ? (s.wholesaleLabel || 'Wholesale') : (s.retailLabel || 'Retail');
  toast(`Switched to ${label} pricing`, mode === 'wholesale' ? 'warning' : 'success');
  audit('PRICING_MODE', `Switched to ${mode}`);
}

function updatePricingToggleUI() {
  const s = Store.getSettings();
  const isWholesale = App.pricingMode === 'wholesale';
  const retailBtn  = document.getElementById('pricing-btn-retail');
  const wholesale  = document.getElementById('pricing-btn-wholesale');
  const indicator  = document.getElementById('pricing-mode-indicator');
  if (!retailBtn) return;
  retailBtn.classList.toggle('active', !isWholesale);
  wholesale.classList.toggle('active', isWholesale);
  retailBtn.textContent = s.retailLabel || 'Retail';
  wholesale.textContent = `${s.wholesaleLabel || 'Wholesale'} (−${s.wholesaleDiscount || 0}%)`;
  if (indicator) {
    indicator.textContent = isWholesale
      ? `${s.wholesaleLabel || 'Wholesale'} −${s.wholesaleDiscount || 0}%`
      : (s.retailLabel || 'Retail');
    indicator.className = 'pricing-indicator ' + (isWholesale ? 'wholesale' : 'retail');
  }
  // Show/hide wholesale toggle based on settings
  const wrap = document.getElementById('pricing-toggle-wrap');
  if (wrap) wrap.style.display = s.wholesaleEnabled ? '' : 'none';
}

function removeFromCart(productId) {
  App.cart = App.cart.filter(i => i.productId !== productId);
  renderCart();
  renderProductGrid();
}

function updateCartQty(productId, qty) {
  const item = App.cart.find(i => i.productId === productId);
  if (!item) return;
  qty = parseInt(qty) || 1;
  if (qty <= 0) { removeFromCart(productId); return; }
  const product = Store.getProducts().find(p => p.id === productId);
  if (product?.trackStock !== false && qty > product.stock) {
    toast(`Only ${product.stock} in stock`, 'error');
    qty = product.stock;
  }
  item.qty = qty;
  renderCart();
}

function calcTotals() {
  const settings = Store.getSettings();
  const taxRate = (settings.taxRate || TAX_RATE_DEFAULT) / 100;
  const taxInclusive = settings.pricesTaxInclusive !== false;

  const subtotalRaw = App.cart.reduce((s, i) => s + (i.price * i.qty), 0);
  let discountAmt = 0;
  const disc = App.discount;
  if (disc.type === 'percent') discountAmt = subtotalRaw * (parseFloat(disc.value) || 0) / 100;
  else if (disc.type === 'fixed') discountAmt = Math.min(parseFloat(disc.value) || 0, subtotalRaw);
  else if (disc.type === 'senior') discountAmt = subtotalRaw * 0.20;

  const afterDiscount = subtotalRaw - discountAmt;

  let taxAmt, subtotal;
  if (taxInclusive) {
    taxAmt = afterDiscount - afterDiscount / (1 + taxRate);
    subtotal = afterDiscount / (1 + taxRate);
  } else {
    taxAmt = afterDiscount * taxRate;
    subtotal = afterDiscount;
  }
  const total = taxInclusive ? afterDiscount : afterDiscount + taxAmt;

  return { subtotalRaw, discountAmt, subtotal, taxAmt, total };
}

function renderCart() {
  const el = document.getElementById('cart-items');
  if (!App.cart.length) {
    el.innerHTML = `<div class="cart-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 001.99 1.61h9.72a2 2 0 001.99-1.61L23 6H6"/></svg>
      <p>Cart is empty</p><span>Tap a product to add it</span></div>`;
    document.getElementById('btn-checkout').disabled = true;
  } else {
    el.innerHTML = App.cart.map((item, idx) => `
      <div class="cart-item">
        <div class="cart-item-num">${idx + 1}</div>
        <div class="cart-item-info">
          <div class="cart-item-name" title="${escHtml(item.name)}">${escHtml(item.name)}${item.priceOverride ? ' <span class="override-badge">Override</span>' : ''}</div>
          <div class="cart-item-price">${fmt(item.price)} × ${item.qty} = <strong>${fmt(item.price * item.qty)}</strong></div>
        </div>
        <div class="cart-item-controls">
          <button class="qty-btn" data-action="dec" data-id="${item.productId}">−</button>
          <input class="qty-input" type="number" value="${item.qty}" min="1" data-id="${item.productId}"
            onfocus="window._qtyFocused=true" onblur="window._qtyFocused=false">
          <button class="qty-btn" data-action="inc" data-id="${item.productId}">+</button>
        </div>
        <button class="cart-item-override btn-icon" data-id="${item.productId}" title="Override price">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="cart-item-remove" data-id="${item.productId}" title="Remove">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>`).join('');

    el.querySelectorAll('.qty-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        const item = App.cart.find(i => i.productId === id);
        if (!item) return;
        const delta = btn.dataset.action === 'inc' ? 1 : -1;
        updateCartQty(id, item.qty + delta);
      });
    });
    el.querySelectorAll('.qty-input').forEach(input => {
      // When user focuses a qty input, disable the auto-refocus-to-search behaviour
      input.addEventListener('focus', () => { window._qtyFocused = true; });
      input.addEventListener('blur', () => { window._qtyFocused = false; });
      input.addEventListener('change', () => updateCartQty(input.dataset.id, input.value));
      // Prevent Enter inside qty input from triggering barcode scan
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.stopPropagation(); e.preventDefault(); input.blur(); }
      });
    });
    el.querySelectorAll('.cart-item-remove').forEach(btn => {
      btn.addEventListener('click', () => removeFromCart(btn.dataset.id));
    });
    el.querySelectorAll('.cart-item-override').forEach(btn => {
      btn.addEventListener('click', () => openPriceOverride(btn.dataset.id));
    });
    document.getElementById('btn-checkout').disabled = false;
  }

  const { subtotalRaw, discountAmt, taxAmt, total } = calcTotals();
  document.getElementById('cart-subtotal').textContent = fmt(subtotalRaw);
  document.getElementById('cart-discount').textContent = '-' + fmt(discountAmt);
  document.getElementById('cart-tax').textContent = fmt(taxAmt);
  document.getElementById('cart-total').textContent = fmt(total);
}

function clearCart() {
  App.cart = [];
  App.discount = { type: 'none', value: 0 };
  App.selectedCustomerId = null;
  document.getElementById('discount-type').value = 'none';
  document.getElementById('discount-value').value = '';
  document.getElementById('discount-value').disabled = true;
  document.getElementById('cart-customer').value = '';
  renderCart();
  renderProductGrid();
}

document.getElementById('btn-clear-cart').addEventListener('click', async () => {
  if (!App.cart.length) return;
  if (await confirm('Clear Cart', 'Remove all items from the cart?')) clearCart();
});

document.getElementById('discount-type').addEventListener('change', (e) => {
  App.discount.type = e.target.value;
  const valInput = document.getElementById('discount-value');
  valInput.disabled = e.target.value === 'none' || e.target.value === 'senior';
  if (e.target.value === 'senior') { App.discount.value = 20; valInput.value = '20'; }
  else if (e.target.value === 'none') { App.discount.value = 0; valInput.value = ''; }
  renderCart();
});
document.getElementById('discount-value').addEventListener('input', (e) => {
  App.discount.value = parseFloat(e.target.value) || 0;
  renderCart();
});
document.getElementById('cart-customer').addEventListener('change', (e) => {
  App.selectedCustomerId = e.target.value || null;

  if (!App.selectedCustomerId) {
    // Switched to Walk-in — remove senior discount if it was auto-applied
    if (App.discount.type === 'senior') {
      App.discount = { type: 'none', value: 0 };
      document.getElementById('discount-type').value = 'none';
      document.getElementById('discount-value').value = '';
      document.getElementById('discount-value').disabled = true;
      renderCart();
    }
  } else {
    const c = Store.getCustomers().find(x => x.id === App.selectedCustomerId);
    if (c?.senior) {
      // Senior customer — auto-apply discount
      document.getElementById('discount-type').value = 'senior';
      document.getElementById('discount-value').value = '20';
      document.getElementById('discount-value').disabled = true;
      App.discount = { type: 'senior', value: 20 };
      renderCart();
      toast('Senior/PWD discount applied', 'success');
    } else {
      // Non-senior customer — remove senior discount if previously set
      if (App.discount.type === 'senior') {
        App.discount = { type: 'none', value: 0 };
        document.getElementById('discount-type').value = 'none';
        document.getElementById('discount-value').value = '';
        document.getElementById('discount-value').disabled = true;
        renderCart();
      }
    }
  }
});

/* ============================
   HOLD ORDERS
   ============================ */
document.getElementById('btn-hold').addEventListener('click', () => {
  if (!App.cart.length) { toast('Cart is empty', 'error'); return; }
  Store.addHeld({
    id: OrangeCrypto.uid(),
    heldAt: Date.now(),
    cart: [...App.cart],
    discount: { ...App.discount },
    customerId: App.selectedCustomerId,
    label: `Order held at ${new Date().toLocaleTimeString()}`,
  });
  updateHeldBadge();
  clearCart();
  toast('Order held');
});

document.getElementById('btn-held-orders').addEventListener('click', () => {
  renderHeldOrders();
  showModal('modal-held');
});

function renderHeldOrders() {
  const held = Store.getHeld();
  const el = document.getElementById('held-orders-list');
  if (!held.length) {
    el.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:1rem">No held orders</p>';
    return;
  }
  el.innerHTML = held.map(h => `
    <div style="border:0.5px solid var(--border);border-radius:var(--radius);padding:0.75rem;margin-bottom:0.5rem;display:flex;align-items:center;justify-content:space-between;gap:8px">
      <div>
        <div style="font-weight:500;font-size:0.875rem">${escHtml(h.label)}</div>
        <div style="font-size:0.78rem;color:var(--text-muted)">${h.cart.length} item(s)</div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-primary btn-sm" data-held-id="${h.id}">Resume</button>
        <button class="btn btn-sm btn-danger" data-held-del="${h.id}">Delete</button>
      </div>
    </div>`).join('');
  el.querySelectorAll('[data-held-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const h = Store.getHeld().find(x => x.id === btn.dataset.heldId);
      if (!h) return;
      if (App.cart.length) { toast('Please clear the current cart first', 'error'); return; }
      App.cart = h.cart;
      App.discount = h.discount;
      App.selectedCustomerId = h.customerId;
      if (h.customerId) document.getElementById('cart-customer').value = h.customerId;
      Store.removeHeld(h.id);
      updateHeldBadge();
      renderCart();
      hideModal('modal-held');
      toast('Order resumed');
    });
  });
  el.querySelectorAll('[data-held-del]').forEach(btn => {
    btn.addEventListener('click', () => {
      Store.removeHeld(btn.dataset.heldDel);
      renderHeldOrders();
      updateHeldBadge();
    });
  });
}

function updateHeldBadge() {
  const count = Store.getHeld().length;
  const badge = document.getElementById('held-badge');
  badge.textContent = count;
  badge.classList.toggle('hidden', count === 0);
}

/* ============================
   CHECKOUT
   ============================ */
document.getElementById('btn-checkout').addEventListener('click', openCheckout);

function openCheckout() {
  if (!App.cart.length) return;
  const { subtotalRaw, discountAmt, taxAmt, total } = calcTotals();
  document.getElementById('co-subtotal').textContent = fmt(subtotalRaw);
  document.getElementById('co-discount').textContent = '-' + fmt(discountAmt);
  document.getElementById('co-tax').textContent = fmt(taxAmt);
  document.getElementById('co-total').textContent = fmt(total);
  document.getElementById('cash-tendered').value = '';
  document.getElementById('cash-change').textContent = fmt(0);
  document.getElementById('checkout-note').value = '';
  document.getElementById('ewallet-ref').value = '';
  document.getElementById('card-last4').value = '';
  document.getElementById('ewallet-total-display').textContent = fmt(total);
  // Reset payment method to cash
  document.querySelectorAll('.pay-method').forEach(b => b.classList.remove('active'));
  document.querySelector('.pay-method[data-method="cash"]').classList.add('active');
  document.getElementById('cash-tendered-wrap').classList.remove('hidden');
  document.getElementById('ewallet-wrap').classList.add('hidden');
  document.getElementById('card-wrap').classList.add('hidden');
  document.getElementById('split-payment-wrap').classList.add('hidden');
  showModal('modal-checkout');
}

document.querySelectorAll('.pay-method').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.pay-method').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const method = btn.dataset.method;
    document.getElementById('cash-tendered-wrap').classList.toggle('hidden', method !== 'cash');
    document.getElementById('ewallet-wrap').classList.toggle('hidden', method !== 'gcash' && method !== 'maya');
    document.getElementById('card-wrap').classList.toggle('hidden', method !== 'card');
    document.getElementById('split-payment-wrap').classList.toggle('hidden', method !== 'split');
    // Update e-wallet label
    if (method === 'gcash' || method === 'maya') {
      document.getElementById('ewallet-method-label').textContent = method === 'gcash' ? 'GCash' : 'Maya';
    }
  });
});

document.getElementById('cash-tendered').addEventListener('input', (e) => {
  const { total } = calcTotals();
  const tendered = parseFloat(e.target.value) || 0;
  const change = tendered - total;
  const el = document.getElementById('cash-change');
  el.textContent = fmt(Math.max(0, change));
  el.style.color = change < 0 ? 'var(--danger)' : 'var(--success)';
});

document.querySelectorAll('.quick-cash-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const { total } = calcTotals();
    const amt = btn.dataset.amount === 'exact' ? total : parseFloat(btn.dataset.amount);
    document.getElementById('cash-tendered').value = amt.toFixed(2);
    document.getElementById('cash-tendered').dispatchEvent(new Event('input'));
  });
});

document.getElementById('btn-complete-sale').addEventListener('click', completeSale);

async function completeSale() {
  const { subtotalRaw, discountAmt, taxAmt, total } = calcTotals();
  const method = document.querySelector('.pay-method.active')?.dataset.method || 'cash';
  const settings = Store.getSettings();

  // Validate payment
  if (method === 'cash') {
    const tendered = parseFloat(document.getElementById('cash-tendered').value) || 0;
    if (tendered < total) { toast('Insufficient cash tendered', 'error'); return; }
  }
  if ((method === 'gcash' || method === 'maya') && !document.getElementById('ewallet-ref').value.trim()) {
    toast(`Please enter the ${method === 'gcash' ? 'GCash' : 'Maya'} reference number`, 'error'); return;
  }

  const orderId = OrangeCrypto.uid();
  const orderNum = OrangeCrypto.orderNum();
  const order = {
    id: orderId,
    orderNum,
    createdAt: Date.now(),
    cashierId: App.currentUser.id,
    cashierName: App.currentUser.name,
    customerId: App.selectedCustomerId || null,
    items: App.cart.map(i => ({ ...i })),
    subtotal: subtotalRaw,
    discountAmt,
    discountType: App.discount.type,
    taxAmt,
    total,
    paymentMethod: method,
    pricingMode: App.pricingMode,
    cashTendered: method === 'cash' ? parseFloat(document.getElementById('cash-tendered').value) || 0 : total,
    paymentRef: (method === 'gcash' || method === 'maya') ? document.getElementById('ewallet-ref').value.trim() : '',
    cardLast4: method === 'card' ? document.getElementById('card-last4').value.trim() : '',
    note: document.getElementById('checkout-note').value,
    status: 'completed',
  };

  Store.addOrder(order);
  Store.decrementStock(App.cart);
  if (App.selectedCustomerId) {
    const points = Math.floor(total / 100); // 1 point per ₱100
    Store.updateCustomerStats(App.selectedCustomerId, total, points);
  }

  audit('SALE', { orderNum, total: fmt(total), method, cashier: App.currentUser.name });
  Sync.queueOrder(order);
  LocalDashboardSync.pushNow();

  hideModal('modal-checkout');
  showReceipt(order);
  clearCart();
  renderProductGrid();
  updateHeldBadge();
  toast(`Sale complete! ${fmt(total)}`, 'success');
}

/* ============================
   RECEIPT
   ============================ */
function showReceipt(order) {
  const settings = Store.getSettings();
  const customer = order.customerId ? Store.getCustomers().find(c => c.id === order.customerId) : null;
  const change = order.cashTendered - order.total;

  let html = `
    <div class="receipt-header">
      <div class="receipt-title">${escHtml(settings.bizName || 'My Store')}</div>
      <div style="font-size:0.75rem">${escHtml(settings.bizAddress || '')}</div>
      <div style="font-size:0.75rem">${escHtml(settings.bizPhone || '')}</div>
      ${settings.bizTin ? `<div style="font-size:0.75rem">TIN: ${escHtml(settings.bizTin)}</div>` : ''}
    </div>
    <div class="receipt-divider"></div>
    <div class="receipt-row"><span>Order #</span><span>${escHtml(order.orderNum)}</span></div>
    <div class="receipt-row"><span>Date</span><span>${fmtDate(order.createdAt)}</span></div>
    <div class="receipt-row"><span>Cashier</span><span>${escHtml(order.cashierName)}</span></div>
    ${customer ? `<div class="receipt-row"><span>Customer</span><span>${escHtml(customer.name)}</span></div>` : ''}
    ${order.pricingMode === 'wholesale' ? `<div class="receipt-row"><span>Pricing</span><span>${escHtml(Store.getSettings().wholesaleLabel || 'Wholesale')}</span></div>` : ''}
    <div class="receipt-divider"></div>
    ${order.items.map(i => `
      <div class="receipt-row">
        <span>${escHtml(i.name)}</span>
        <span>${fmt(i.price * i.qty)}</span>
      </div>
      <div style="font-size:0.75rem;color:var(--text-muted);padding-left:8px">${i.qty} × ${fmt(i.price)}${i.priceOverride ? ` (Override)` : ''}</div>
    `).join('')}
    <div class="receipt-divider"></div>
    <div class="receipt-row"><span>Subtotal</span><span>${fmt(order.subtotal)}</span></div>
    ${order.discountAmt > 0 ? `<div class="receipt-row"><span>Discount (${order.discountType})</span><span>-${fmt(order.discountAmt)}</span></div>` : ''}
    <div class="receipt-row"><span>VAT (${settings.taxRate || 12}%)</span><span>${fmt(order.taxAmt)}</span></div>
    <div class="receipt-divider"></div>
    <div class="receipt-row total"><span>TOTAL</span><span>${fmt(order.total)}</span></div>
    <div class="receipt-row"><span>Payment (${escHtml(order.paymentMethod.toUpperCase())})</span><span>${fmt(order.cashTendered)}</span></div>
    ${order.paymentRef ? `<div class="receipt-row"><span>Ref #</span><span>${escHtml(order.paymentRef)}</span></div>` : ''}
    ${order.cardLast4 ? `<div class="receipt-row"><span>Card</span><span>**** ${escHtml(order.cardLast4)}</span></div>` : ''}
    ${order.paymentMethod === 'cash' ? `<div class="receipt-row"><span>Change</span><span>${fmt(Math.max(0, change))}</span></div>` : ''}
    ${order.note ? `<div class="receipt-divider"></div><div style="font-size:0.78rem">Note: ${escHtml(order.note)}</div>` : ''}
    <div class="receipt-divider"></div>
    <div class="receipt-footer">${escHtml(settings.receiptFooter || 'Thank you!')}</div>
  `;

  document.getElementById('receipt-content').innerHTML = html;
  document.getElementById('modal-receipt').dataset.orderId = order.id;
  showModal('modal-receipt');
}

document.getElementById('btn-print-receipt').addEventListener('click', () => window.print());
document.getElementById('btn-new-sale').addEventListener('click', () => hideModal('modal-receipt'));

/* ============================
   ORDERS VIEW
   ============================ */
function renderOrders() {
  let orders = Store.getOrders().slice().reverse();
  const dateFilter = document.getElementById('orders-date').value;
  const statusFilter = document.getElementById('orders-status').value;

  if (dateFilter) {
    const d = new Date(dateFilter);
    orders = orders.filter(o => {
      const od = new Date(o.createdAt);
      return od.toDateString() === d.toDateString();
    });
  }
  if (statusFilter) orders = orders.filter(o => o.status === statusFilter);

  const tbody = document.getElementById('orders-tbody');
  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:2rem">No orders found</td></tr>';
    return;
  }
  tbody.innerHTML = orders.map(o => {
    const customer = o.customerId ? Store.getCustomers().find(c => c.id === o.customerId) : null;
    return `<tr>
      <td><strong>${escHtml(o.orderNum)}</strong></td>
      <td>${fmtDate(o.createdAt)}</td>
      <td>${escHtml(o.cashierName)}</td>
      <td>${customer ? escHtml(customer.name) : '<span style="color:var(--text-muted)">Walk-in</span>'}</td>
      <td>${o.items.length} item(s)</td>
      <td><strong>${fmt(o.total)}</strong></td>
      <td><span style="text-transform:capitalize">${escHtml(o.paymentMethod)}</span></td>
      <td><span class="status-badge status-${o.status}">${capitalizeFirst(o.status)}</span></td>
      <td><button class="btn btn-secondary btn-sm" data-order-id="${o.id}">View</button></td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-order-id]').forEach(btn => {
    btn.addEventListener('click', () => openOrderDetail(btn.dataset.orderId));
  });
}

document.getElementById('orders-date').addEventListener('change', renderOrders);
document.getElementById('orders-status').addEventListener('change', renderOrders);

function openOrderDetail(orderId) {
  const order = Store.getOrders().find(o => o.id === orderId);
  if (!order) return;
  App.currentOrderId = orderId;
  const customer = order.customerId ? Store.getCustomers().find(c => c.id === order.customerId) : null;
  const today = new Date().toDateString();
  const orderDay = new Date(order.createdAt).toDateString();
  const sameDay = today === orderDay;

  document.getElementById('order-detail-body').innerHTML = `
    <div class="checkout-summary">
      <div class="checkout-line"><span>Order #</span><strong>${escHtml(order.orderNum)}</strong></div>
      <div class="checkout-line"><span>Date</span><span>${fmtDate(order.createdAt)}</span></div>
      <div class="checkout-line"><span>Cashier</span><span>${escHtml(order.cashierName)}</span></div>
      <div class="checkout-line"><span>Customer</span><span>${customer ? escHtml(customer.name) : 'Walk-in'}</span></div>
      <div class="checkout-line"><span>Payment</span><span style="text-transform:capitalize">${escHtml(order.paymentMethod)}</span></div>
      ${order.paymentRef ? `<div class="checkout-line"><span>Ref #</span><span>${escHtml(order.paymentRef)}</span></div>` : ''}
      ${order.cardLast4 ? `<div class="checkout-line"><span>Card</span><span>**** ${escHtml(order.cardLast4)}</span></div>` : ''}
      <div class="checkout-line"><span>Status</span><span class="status-badge status-${order.status}">${capitalizeFirst(order.status)}</span></div>
      ${order.voidedBy ? `<div class="checkout-line"><span>Voided by</span><span>${escHtml(order.voidedBy)} — ${fmtDate(order.voidedAt)}</span></div>` : ''}
      ${order.refundedBy ? `<div class="checkout-line"><span>Refunded by</span><span>${escHtml(order.refundedBy)} — ${fmtDate(order.refundedAt)}</span></div>` : ''}
      ${order.note ? `<div class="checkout-line"><span>Note</span><span>${escHtml(order.note)}</span></div>` : ''}
    </div>
    <table class="data-table" style="margin:1rem 0">
      <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th><th>Note</th></tr></thead>
      <tbody>${order.items.map(i => `<tr>
        <td>${escHtml(i.name)}</td>
        <td>${i.qty}</td>
        <td>${fmt(i.price)}${i.priceOverride ? ` <span class="override-badge" title="Overridden from ${fmt(i.originalPrice)}">Override</span>` : ''}</td>
        <td>${fmt(i.price * i.qty)}</td>
        <td style="font-size:0.78rem;color:var(--text-muted)">${i.overrideReason ? escHtml(i.overrideReason) : ''}</td>
      </tr>`).join('')}</tbody>
    </table>
    <div class="checkout-summary">
      <div class="checkout-line"><span>Subtotal</span><span>${fmt(order.subtotal)}</span></div>
      ${order.discountAmt > 0 ? `<div class="checkout-line"><span>Discount (${order.discountType})</span><span>-${fmt(order.discountAmt)}</span></div>` : ''}
      <div class="checkout-line"><span>VAT</span><span>${fmt(order.taxAmt)}</span></div>
      <div class="checkout-line checkout-total"><span>Total</span><span>${fmt(order.total)}</span></div>
      ${order.paymentMethod === 'cash' ? `<div class="checkout-line"><span>Tendered</span><span>${fmt(order.cashTendered)}</span></div>
      <div class="checkout-line"><span>Change</span><span>${fmt(Math.max(0, order.cashTendered - order.total))}</span></div>` : ''}
    </div>
  `;

  const isCompleted = order.status === 'completed';
  document.getElementById('btn-void-order').style.display = isCompleted ? '' : 'none';
  document.getElementById('btn-refund-order').style.display = isCompleted ? '' : 'none';
  // Void only available same-day or to managers
  if (isCompleted && !sameDay && App.currentUser?.role === 'cashier') {
    document.getElementById('btn-void-order').style.display = 'none';
  }
  showModal('modal-order');
}

document.getElementById('btn-refund-order').addEventListener('click', async () => {
  if (App.currentUser?.role === 'cashier') { toast('Refunds require manager/admin access', 'error'); return; }
  const order = Store.getOrders().find(o => o.id === App.currentOrderId);
  if (!order || order.status !== 'completed') { toast('Only completed orders can be refunded', 'error'); return; }
  if (await confirm('Refund Order', `Refund order ${order.orderNum} (${fmt(order.total)})? Stock will be restored and a refund record created.`)) {
    Store.updateOrderStatus(App.currentOrderId, 'refunded', { refundedAt: Date.now(), refundedBy: App.currentUser.name });
    Store.incrementStock(order.items);
    audit('REFUND', { orderNum: order.orderNum, total: fmt(order.total), by: App.currentUser.name });
    Sync.queueOrderStatusChange(Store.getOrders().find(o => o.id === App.currentOrderId));
    LocalDashboardSync.pushNow();
    hideModal('modal-order');
    renderOrders();
    toast('Order refunded — stock restored', 'success');
  }
});

document.getElementById('btn-void-order').addEventListener('click', async () => {
  const order = Store.getOrders().find(o => o.id === App.currentOrderId);
  if (!order) return;
  if (order.status !== 'completed') { toast('Only completed orders can be voided', 'error'); return; }

  // Void = same-day cancellation, requires manager PIN
  const today = new Date();
  const orderDay = new Date(order.createdAt);
  const sameDay = today.toDateString() === orderDay.toDateString();

  if (!sameDay && App.currentUser?.role === 'cashier') {
    toast('Voids after the sales day require manager access', 'error'); return;
  }

  if (await confirm('Void Order', `Void order ${order.orderNum}? This cancels the transaction. Stock will be restored. Void is recorded in audit log.`)) {
    Store.updateOrderStatus(App.currentOrderId, 'voided', { voidedAt: Date.now(), voidedBy: App.currentUser.name });
    Store.incrementStock(order.items);
    audit('VOID', { orderNum: order.orderNum, total: fmt(order.total), by: App.currentUser.name, sameDay });
    Sync.queueOrderStatusChange(Store.getOrders().find(o => o.id === App.currentOrderId));
    LocalDashboardSync.pushNow();
    hideModal('modal-order');
    renderOrders();
    toast('Order voided — stock restored', 'warning');
  }
});

document.getElementById('btn-reprint-receipt').addEventListener('click', () => {
  const order = Store.getOrders().find(o => o.id === App.currentOrderId);
  if (order) { hideModal('modal-order'); showReceipt(order); }
});

document.getElementById('btn-export-orders').addEventListener('click', () => {
  const orders = Store.getOrders();
  const rows = [['Order#','Date','Cashier','Customer','Items','Subtotal','Discount','Tax','Total','Payment','Status']];
  orders.forEach(o => {
    const c = o.customerId ? Store.getCustomers().find(x => x.id === o.customerId) : null;
    rows.push([o.orderNum, fmtDate(o.createdAt), o.cashierName, c ? c.name : 'Walk-in',
      o.items.length, o.subtotal, o.discountAmt, o.taxAmt, o.total, o.paymentMethod, o.status]);
  });
  downloadCSV(rows, 'orders_export.csv');
});

function downloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

/* ============================
   INVENTORY VIEW
   ============================ */
function renderInventory() {
  const search = document.getElementById('inventory-search').value.toLowerCase();
  const settings = Store.getSettings();
  const lowQty = settings.lowStockQty || 5;

  // Populate category filter — read value BEFORE rebuilding
  const catSel = document.getElementById('inventory-cat-filter');
  const catFilter = catSel.value; // capture before innerHTML wipe
  catSel.innerHTML = '<option value="">All Categories</option>';
  Store.getCategories().forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    opt.selected = catFilter === c.id;
    catSel.appendChild(opt);
  });

  let products = Store.getProducts();
  if (search) products = products.filter(p => p.name.toLowerCase().includes(search) || (p.sku||'').toLowerCase().includes(search));
  if (catFilter) products = products.filter(p => p.categoryId === catFilter);

  const cats = Store.getCategories();
  const tbody = document.getElementById('inventory-tbody');
  if (!products.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:2rem">No products found</td></tr>';
    return;
  }
  tbody.innerHTML = products.map(p => {
    const cat = cats.find(c => c.id === p.categoryId);
    const isLow = p.trackStock !== false && p.stock <= lowQty && p.stock > 0;
    const isOut = p.trackStock !== false && p.stock <= 0;
    const stockStatus = isOut ? 'status-badge status-voided' : isLow ? 'status-badge status-low' : '';
    return `<tr>
      <td><code>${escHtml(p.sku || '—')}</code></td>
      <td><strong>${escHtml(p.name)}</strong></td>
      <td>${cat ? escHtml(cat.name) : '—'}</td>
      <td>${fmt(p.price)}</td>
      <td>${fmt(p.cost || 0)}</td>
      <td>
        <span class="${stockStatus}">${p.trackStock === false ? '∞' : p.stock}</span>
        ${p.trackStock !== false ? `<button class="btn btn-sm stock-adjust-inline" data-stock-id="${p.id}" title="Adjust stock" style="margin-left:6px">+/−</button>` : ''}
      </td>
      <td><span class="status-badge ${p.active !== false ? 'status-active' : 'status-inactive'}">${p.active !== false ? 'Active' : 'Inactive'}</span></td>
      <td style="display:flex;gap:4px;flex-wrap:wrap">
        <button class="btn btn-secondary btn-sm" data-edit-product="${p.id}">Edit</button>
        <button class="btn btn-secondary btn-sm" data-history-product="${p.id}" title="Stock history">History</button>
        <button class="btn btn-sm" style="border-color:var(--danger);color:var(--danger)" data-del-product="${p.id}">Del</button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-edit-product]').forEach(btn => btn.addEventListener('click', openProductModal(btn.dataset.editProduct)));
  tbody.querySelectorAll('[data-del-product]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (await confirm('Delete Product', `Delete "${Store.getProducts().find(p=>p.id===btn.dataset.delProduct)?.name}"? This cannot be undone.`)) {
        audit('DELETE_PRODUCT', { id: btn.dataset.delProduct });
        Store.deleteProduct(btn.dataset.delProduct);
        renderInventory();
        renderCategoryTabs();
        renderProductGrid();
        toast('Product deleted');
      }
    });
  });
  tbody.querySelectorAll('[data-stock-id]').forEach(btn => {
    btn.addEventListener('click', () => openStockModal(btn.dataset.stockId));
  });
  tbody.querySelectorAll('[data-history-product]').forEach(btn => {
    btn.addEventListener('click', () => openStockHistory(btn.dataset.historyProduct));
  });
}

document.getElementById('inventory-search').addEventListener('input', renderInventory);
document.getElementById('inventory-cat-filter').addEventListener('change', renderInventory);

function openProductModal(productId) {
  return (e) => {
    const p = productId ? Store.getProducts().find(x => x.id === productId) : null;
    document.getElementById('product-modal-title').textContent = p ? 'Edit Product' : 'Add Product';
    document.getElementById('product-edit-id').value = p?.id || '';
    document.getElementById('prd-name').value = p?.name || '';
    document.getElementById('prd-sku').value = p?.sku || '';
    document.getElementById('prd-price').value = p?.price || '';
    document.getElementById('prd-cost').value = p?.cost || '';
    document.getElementById('prd-stock').value = p?.stock ?? 0;
    document.getElementById('prd-unit').value = p?.unit || 'pcs';
    document.getElementById('prd-track-stock').checked = p?.trackStock !== false;
    document.getElementById('prd-active').checked = p?.active !== false;
    // Category dropdown
    const catSel = document.getElementById('prd-category');
    catSel.innerHTML = Store.getCategories().map(c =>
      `<option value="${c.id}" ${p?.categoryId === c.id ? 'selected' : ''}>${escHtml(c.name)}</option>`
    ).join('');
    showModal('modal-product');
  };
}

document.getElementById('btn-add-product').addEventListener('click', openProductModal(null));
document.getElementById('btn-save-product').addEventListener('click', () => {
  const name = document.getElementById('prd-name').value.trim();
  if (!name) { toast('Product name is required', 'error'); return; }
  const price = parseFloat(document.getElementById('prd-price').value);
  if (!price || price <= 0) { toast('Valid price is required', 'error'); return; }
  const existingId = document.getElementById('product-edit-id').value;
  const product = {
    id: existingId || OrangeCrypto.uid(),
    name,
    sku: document.getElementById('prd-sku').value.trim(),
    categoryId: document.getElementById('prd-category').value,
    price,
    cost: parseFloat(document.getElementById('prd-cost').value) || 0,
    stock: parseInt(document.getElementById('prd-stock').value) || 0,
    unit: document.getElementById('prd-unit').value.trim() || 'pcs',
    trackStock: document.getElementById('prd-track-stock').checked,
    active: document.getElementById('prd-active').checked,
    createdAt: existingId ? Store.getProducts().find(p=>p.id===existingId)?.createdAt : Date.now(),
    updatedAt: Date.now(),
  };
  audit(existingId ? 'UPDATE_PRODUCT' : 'ADD_PRODUCT', { name, price });
  Store.upsertProduct(product);
  LocalDashboardSync.schedule();
  hideModal('modal-product');
  renderInventory();
  renderCategoryTabs();
  renderProductGrid();
  checkLowStockAlerts();
  toast(existingId ? 'Product updated' : 'Product added', 'success');
});

/* ============================
   STOCK ADJUSTMENT
   ============================ */
let _stockAdjType = 'add';

function openStockModal(productId) {
  const p = Store.getProducts().find(x => x.id === productId);
  if (!p) return;
  document.getElementById('stock-product-id').value = productId;
  document.getElementById('stock-modal-title').textContent = `Adjust Stock — ${p.name}`;
  document.getElementById('stock-product-info').innerHTML = `
    <div class="stock-info-row">
      <span>Current Stock:</span>
      <strong id="stock-current-val">${p.stock} ${p.unit || 'pcs'}</strong>
    </div>`;
  document.getElementById('stock-qty').value = '';
  document.getElementById('stock-reason').value = '';
  document.getElementById('stock-notes').value = '';
  document.getElementById('stock-result-preview').innerHTML = '';
  _stockAdjType = 'add';
  document.querySelectorAll('.stock-tab').forEach(t => t.classList.toggle('active', t.dataset.stype === 'add'));
  document.getElementById('stock-qty-label').textContent = 'Quantity to Add';
  showModal('modal-stock');
}

document.querySelectorAll('.stock-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    _stockAdjType = tab.dataset.stype;
    document.querySelectorAll('.stock-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const labels = { add: 'Quantity to Add', remove: 'Quantity to Remove', set: 'New Exact Quantity' };
    document.getElementById('stock-qty-label').textContent = labels[_stockAdjType];
    updateStockPreview();
  });
});

document.getElementById('stock-qty').addEventListener('input', updateStockPreview);

function updateStockPreview() {
  const productId = document.getElementById('stock-product-id').value;
  const p = Store.getProducts().find(x => x.id === productId);
  if (!p) return;
  const qty = parseInt(document.getElementById('stock-qty').value) || 0;
  let newStock;
  if (_stockAdjType === 'add') newStock = p.stock + qty;
  else if (_stockAdjType === 'remove') newStock = Math.max(0, p.stock - qty);
  else newStock = qty;
  const diff = newStock - p.stock;
  const diffStr = diff > 0 ? `+${diff}` : `${diff}`;
  const color = diff > 0 ? 'var(--success)' : diff < 0 ? 'var(--danger)' : 'var(--text-muted)';
  document.getElementById('stock-result-preview').innerHTML = `
    <div class="stock-preview-row">
      <span>${p.stock} ${p.unit || 'pcs'}</span>
      <span style="color:${color};font-weight:700">${diffStr}</span>
      <span>→</span>
      <strong style="font-size:1.1rem">${newStock} ${p.unit || 'pcs'}</strong>
    </div>`;
}

document.getElementById('btn-save-stock').addEventListener('click', () => {
  const productId = document.getElementById('stock-product-id').value;
  const p = Store.getProducts().find(x => x.id === productId);
  if (!p) return;
  const qty = parseInt(document.getElementById('stock-qty').value);
  if (isNaN(qty) || qty < 0) { toast('Enter a valid quantity', 'error'); return; }
  const reason = document.getElementById('stock-reason').value;
  if (!reason) { toast('Please select a reason', 'error'); return; }
  const notes = document.getElementById('stock-notes').value.trim();

  const before = p.stock;
  let after;
  if (_stockAdjType === 'add') after = before + qty;
  else if (_stockAdjType === 'remove') after = Math.max(0, before - qty);
  else after = qty;

  const diff = after - before;
  p.stock = after;
  p.updatedAt = Date.now();
  Store.upsertProduct(p);

  const entry = {
    id: OrangeCrypto.uid(),
    ts: Date.now(),
    productId,
    productName: p.name,
    type: _stockAdjType,
    qty: Math.abs(diff),
    before,
    after,
    reason,
    notes,
    by: App.currentUser.name,
  };
  Store.addStockEntry(entry);
  audit('STOCK_ADJUST', { product: p.name, before, after, diff, reason, by: App.currentUser.name });
  LocalDashboardSync.schedule();

  hideModal('modal-stock');
  renderInventory();
  renderProductGrid();
  checkLowStockAlerts();
  toast(`Stock updated: ${p.name} → ${after} ${p.unit || 'pcs'}`, 'success');
});

function openStockHistory(productId) {
  const p = Store.getProducts().find(x => x.id === productId);
  if (!p) return;
  document.getElementById('stock-history-title').textContent = `Stock History — ${p.name}`;
  const log = Store.getStockLog().filter(e => e.productId === productId);
  const tbody = document.getElementById('stock-history-tbody');
  if (!log.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:1.5rem">No adjustment history yet</td></tr>';
  } else {
    tbody.innerHTML = log.map(e => {
      const diff = e.after - e.before;
      const color = diff > 0 ? 'var(--success)' : 'var(--danger)';
      return `<tr>
        <td>${fmtDate(e.ts)}</td>
        <td style="text-transform:capitalize">${e.type}</td>
        <td style="color:${color};font-weight:600">${diff > 0 ? '+' : ''}${diff}</td>
        <td>${e.before}</td>
        <td><strong>${e.after}</strong></td>
        <td>${escHtml(e.reason)}${e.notes ? ` — ${escHtml(e.notes)}` : ''}</td>
        <td>${escHtml(e.by)}</td>
      </tr>`;
    }).join('');
  }
  showModal('modal-stock-history');
}

/* ============================
   PRICE OVERRIDE (per cart line)
   ============================ */
function openPriceOverride(productId) {
  const item = App.cart.find(i => i.productId === productId);
  if (!item) return;
  document.getElementById('override-product-id').value = productId;
  document.getElementById('override-item-name').textContent = item.name;
  document.getElementById('override-original-price').textContent = fmt(item.price);
  document.getElementById('override-new-price').value = '';
  document.getElementById('override-reason').value = '';
  document.getElementById('override-pin').value = '';
  showModal('modal-price-override');
}

document.getElementById('btn-apply-override').addEventListener('click', async () => {
  const productId = document.getElementById('override-product-id').value;
  const item = App.cart.find(i => i.productId === productId);
  if (!item) return;

  const newPrice = parseFloat(document.getElementById('override-new-price').value);
  if (isNaN(newPrice) || newPrice < 0) { toast('Enter a valid price', 'error'); return; }
  const reason = document.getElementById('override-reason').value;
  if (!reason) { toast('Please select a reason', 'error'); return; }
  const pin = document.getElementById('override-pin').value;
  if (!pin) { toast('Manager PIN is required', 'error'); return; }

  // Verify PIN belongs to manager or admin
  const pinHash = await OrangeCrypto.hashPin(pin);
  const authorizer = Store.getUserByPin(pinHash);
  if (!authorizer || (authorizer.role !== 'admin' && authorizer.role !== 'manager')) {
    toast('Invalid PIN or insufficient role (manager/admin required)', 'error'); return;
  }

  const originalPrice = item.originalPrice || item.price;
  item.originalPrice = originalPrice;
  item.price = newPrice;
  item.priceOverride = true;
  item.overrideReason = reason;
  item.overrideBy = authorizer.name;

  audit('PRICE_OVERRIDE', {
    product: item.name,
    original: fmt(originalPrice),
    newPrice: fmt(newPrice),
    reason,
    authorizedBy: authorizer.name,
    cashier: App.currentUser.name,
  });

  hideModal('modal-price-override');
  renderCart();
  toast(`Price overridden: ${item.name} → ${fmt(newPrice)} (by ${authorizer.name})`, 'warning');
});

/* ============================
   Z-REPORT / SHIFT MANAGEMENT
   ============================ */
function renderZReport() {
  const openShift = Store.getOpenShift();
  const statusBar = document.getElementById('shift-status-bar');
  const body = document.getElementById('zreport-body');
  const btnOpen = document.getElementById('btn-open-shift');
  const btnClose = document.getElementById('btn-close-shift');

  if (openShift) {
    statusBar.innerHTML = `
      <div class="shift-open-indicator">
        <span class="status-badge status-active">● Shift Open</span>
        <span>Opened by <strong>${escHtml(openShift.openedBy)}</strong> at ${fmtDate(openShift.openedAt)}</span>
        <span>Opening float: <strong>${fmt(openShift.openFloat)}</strong></span>
      </div>`;
    btnOpen.style.display = 'none';
    btnClose.style.display = '';
    renderZReportBody(openShift);
  } else {
    statusBar.innerHTML = `<div class="shift-closed-indicator"><span class="status-badge status-inactive">● No Open Shift</span><span>Open a shift to start tracking sales.</span></div>`;
    btnOpen.style.display = '';
    btnClose.style.display = 'none';

    // Show past shifts
    const shifts = Store.getShifts().filter(s => s.status === 'closed').slice(-10).reverse();
    if (shifts.length) {
      body.innerHTML = `<h3 style="margin-bottom:1rem">Recent Shifts</h3>` +
        shifts.map(s => shiftSummaryCard(s, false)).join('');
    } else {
      body.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:3rem">No shift history yet</div>';
    }
  }
}

function renderZReportBody(shift) {
  const body = document.getElementById('zreport-body');
  body.innerHTML = shiftSummaryCard(shift, true);
}

function shiftSummaryCard(shift, isLive) {
  const shiftOrders = Store.getOrders().filter(o =>
    o.status === 'completed' &&
    o.createdAt >= shift.openedAt &&
    (!shift.closedAt || o.createdAt <= shift.closedAt)
  );
  const revenue = shiftOrders.reduce((s, o) => s + o.total, 0);
  const tax = shiftOrders.reduce((s, o) => s + o.taxAmt, 0);
  const items = shiftOrders.reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.qty, 0), 0);
  const voids = Store.getOrders().filter(o => o.status === 'voided' && o.createdAt >= shift.openedAt && (!shift.closedAt || o.createdAt <= shift.closedAt)).length;
  const refunds = Store.getOrders().filter(o => o.status === 'refunded' && o.createdAt >= shift.openedAt && (!shift.closedAt || o.createdAt <= shift.closedAt)).length;

  // Payment breakdown
  const payBreak = {};
  shiftOrders.forEach(o => { payBreak[o.paymentMethod] = (payBreak[o.paymentMethod] || 0) + o.total; });

  const expectedCash = (payBreak.cash || 0) + (shift.openFloat || 0);

  return `
    <div class="zreport-card">
      <div class="zreport-header">
        <div>
          <h3>${isLive ? 'Current Shift Summary' : `Shift — ${fmtDate(shift.openedAt)}`}</h3>
          <div class="zreport-meta">
            Opened by <strong>${escHtml(shift.openedBy)}</strong> · ${fmtDate(shift.openedAt)}
            ${shift.closedAt ? ` → Closed ${fmtDate(shift.closedAt)} by ${escHtml(shift.closedBy || '—')}` : ' · <span style="color:var(--success)">In Progress</span>'}
          </div>
        </div>
        ${!isLive ? `<button class="btn btn-secondary btn-sm" onclick="printShiftReport('${shift.id}')">Print</button>` : '<button class="btn btn-secondary btn-sm" onclick="printShiftReport(null)">Print</button>'}
      </div>
      <div class="zreport-stats">
        <div class="zreport-stat"><span>Orders</span><strong>${shiftOrders.length}</strong></div>
        <div class="zreport-stat"><span>Items Sold</span><strong>${items}</strong></div>
        <div class="zreport-stat"><span>Gross Revenue</span><strong>${fmt(revenue)}</strong></div>
        <div class="zreport-stat"><span>VAT Collected</span><strong>${fmt(tax)}</strong></div>
        <div class="zreport-stat"><span>Net Revenue</span><strong>${fmt(revenue - tax)}</strong></div>
        <div class="zreport-stat"><span>Opening Float</span><strong>${fmt(shift.openFloat || 0)}</strong></div>
        <div class="zreport-stat"><span>Expected Cash</span><strong>${fmt(expectedCash)}</strong></div>
        <div class="zreport-stat"><span>Voids</span><strong style="color:var(--warning)">${voids}</strong></div>
        <div class="zreport-stat"><span>Refunds</span><strong style="color:var(--danger)">${refunds}</strong></div>
      </div>
      <div class="zreport-section">
        <h4>Payment Breakdown</h4>
        <div class="zreport-payments">
          ${Object.entries(payBreak).map(([method, amt]) =>
            `<div class="zreport-pay-row"><span style="text-transform:capitalize">${escHtml(method)}</span><strong>${fmt(amt)}</strong></div>`
          ).join('') || '<span style="color:var(--text-muted);font-size:0.85rem">No sales</span>'}
        </div>
      </div>
      ${shift.closedAt && shift.closingNote ? `<div class="zreport-section"><h4>Closing Notes</h4><p>${escHtml(shift.closingNote)}</p></div>` : ''}
    </div>`;
}

document.getElementById('btn-open-shift').addEventListener('click', async () => {
  if (Store.getOpenShift()) { toast('A shift is already open', 'error'); return; }
  const floatStr = prompt('Enter opening float (cash in drawer):');
  if (floatStr === null) return;
  const openFloat = parseFloat(floatStr) || 0;
  const shift = {
    id: OrangeCrypto.uid(),
    openedAt: Date.now(),
    openedBy: App.currentUser.name,
    openFloat,
    status: 'open',
  };
  Store.addShift(shift);
  audit('SHIFT_OPEN', { by: App.currentUser.name, float: fmt(openFloat) });
  Sync.queueShift(shift, 'shift_open');
  LocalDashboardSync.pushNow();
  renderZReport();
  toast(`Shift opened — Float: ${fmt(openFloat)}`, 'success');
});

document.getElementById('btn-close-shift').addEventListener('click', async () => {
  const shift = Store.getOpenShift();
  if (!shift) { toast('No open shift', 'error'); return; }
  if (!await confirm('Close Shift', 'Close the current shift and generate the Z-Report? This will lock the shift record.')) return;
  const closingNote = prompt('Closing notes (optional):') || '';
  const shifts = Store.getShifts();
  const s = shifts.find(x => x.id === shift.id);
  if (s) {
    s.status = 'closed';
    s.closedAt = Date.now();
    s.closedBy = App.currentUser.name;
    s.closingNote = closingNote;
    Store.saveShifts(shifts);
  }
  audit('SHIFT_CLOSE', { by: App.currentUser.name, shiftId: shift.id });
  if (s) Sync.queueShift(s, 'shift_close');
  LocalDashboardSync.pushNow();
  renderZReport();
  toast('Shift closed — Z-Report saved', 'success');
  setTimeout(() => printShiftReport(shift.id), 300);
});

function printShiftReport(shiftId) {
  let shift;
  if (shiftId) shift = Store.getShifts().find(s => s.id === shiftId);
  else shift = Store.getOpenShift();
  if (!shift) return;

  const settings = Store.getSettings();
  const shiftOrders = Store.getOrders().filter(o =>
    o.status === 'completed' && o.createdAt >= shift.openedAt &&
    (!shift.closedAt || o.createdAt <= shift.closedAt)
  );
  const revenue = shiftOrders.reduce((s, o) => s + o.total, 0);
  const tax = shiftOrders.reduce((s, o) => s + o.taxAmt, 0);
  const items = shiftOrders.reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.qty, 0), 0);
  const payBreak = {};
  shiftOrders.forEach(o => { payBreak[o.paymentMethod] = (payBreak[o.paymentMethod] || 0) + o.total; });
  const expectedCash = (payBreak.cash || 0) + (shift.openFloat || 0);
  const voids = Store.getOrders().filter(o => o.status === 'voided' && o.createdAt >= shift.openedAt && (!shift.closedAt || o.createdAt <= shift.closedAt)).length;
  const refunds = Store.getOrders().filter(o => o.status === 'refunded' && o.createdAt >= shift.openedAt && (!shift.closedAt || o.createdAt <= shift.closedAt)).length;

  const payRows = Object.entries(payBreak).map(([m,a]) => `<tr><td style="text-transform:capitalize">${m}</td><td>${fmt(a)}</td></tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>Z-Report — ${settings.bizName || 'OrangePOS'}</title>
    <style>
      body{font-family:sans-serif;font-size:13px;color:#111;margin:1.5cm}
      h1{font-size:20px;margin:0 0 4px}
      .sub{color:#666;font-size:12px;margin-bottom:16px}
      .stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px}
      .stat{border:1px solid #ddd;border-radius:6px;padding:10px 14px}
      .stat span{font-size:10px;text-transform:uppercase;color:#888;letter-spacing:.04em;display:block}
      .stat strong{font-size:18px;font-weight:700}
      h2{font-size:13px;border-bottom:1px solid #eee;padding-bottom:4px;margin:14px 0 8px;text-transform:uppercase;letter-spacing:.04em;color:#666}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{text-align:left;padding:5px 8px;background:#f5f5f5;border-bottom:1px solid #ddd;font-size:11px}
      td{padding:5px 8px;border-bottom:1px solid #f0f0f0}
      .footer{margin-top:20px;font-size:11px;color:#aaa;text-align:center;border-top:1px dashed #ddd;padding-top:10px}
    </style></head><body>
    <h1>Z-Report — ${escHtml(settings.bizName || 'My Store')}</h1>
    <div class="sub">
      Shift opened: ${fmtDate(shift.openedAt)} by ${escHtml(shift.openedBy)}<br>
      ${shift.closedAt ? `Shift closed: ${fmtDate(shift.closedAt)} by ${escHtml(shift.closedBy || '—')}<br>` : ''}
      Printed: ${new Date().toLocaleString('en-PH')}
    </div>
    <div class="stats">
      <div class="stat"><span>Total Orders</span><strong>${shiftOrders.length}</strong></div>
      <div class="stat"><span>Items Sold</span><strong>${items}</strong></div>
      <div class="stat"><span>Gross Revenue</span><strong>${fmt(revenue)}</strong></div>
      <div class="stat"><span>VAT Collected</span><strong>${fmt(tax)}</strong></div>
      <div class="stat"><span>Net Revenue</span><strong>${fmt(revenue - tax)}</strong></div>
      <div class="stat"><span>Opening Float</span><strong>${fmt(shift.openFloat || 0)}</strong></div>
      <div class="stat"><span>Expected Cash</span><strong>${fmt(expectedCash)}</strong></div>
      <div class="stat"><span>Voids</span><strong>${voids}</strong></div>
      <div class="stat"><span>Refunds</span><strong>${refunds}</strong></div>
    </div>
    <h2>Payment Methods</h2>
    <table><thead><tr><th>Method</th><th>Amount</th></tr></thead><tbody>
      ${payRows || '<tr><td colspan="2">No sales</td></tr>'}
    </tbody></table>
    <h2>Order Log</h2>
    <table><thead><tr><th>Order #</th><th>Time</th><th>Cashier</th><th>Total</th><th>Payment</th></tr></thead><tbody>
      ${shiftOrders.map(o => `<tr>
        <td>${o.orderNum}</td>
        <td>${new Date(o.createdAt).toLocaleTimeString('en-PH')}</td>
        <td>${escHtml(o.cashierName)}</td>
        <td>${fmt(o.total)}</td>
        <td style="text-transform:capitalize">${o.paymentMethod}</td>
      </tr>`).join('')}
    </tbody></table>
    ${shift.closingNote ? `<h2>Closing Notes</h2><p>${escHtml(shift.closingNote)}</p>` : ''}
    <div class="footer">OrangePOS · ${escHtml(settings.bizName || '')} · Z-Report</div>
    <script>window.onload=()=>{window.print();window.onafterprint=()=>window.close()}<\/script>
  </body></html>`;

  const win = window.open('', '_blank', 'width=800,height=700');
  if (win) { win.document.write(html); win.document.close(); }
  else toast('Pop-up blocked. Allow pop-ups to print.', 'warning');
}
function renderCartCustomers() {
  const sel = document.getElementById('cart-customer');
  const current = sel.value;
  sel.innerHTML = '<option value="">Walk-in Customer</option>';
  Store.getCustomers().forEach(c => {
    sel.innerHTML += `<option value="${c.id}" ${current === c.id ? 'selected' : ''}>${escHtml(c.name)}${c.senior ? ' (Senior/PWD)' : ''}</option>`;
  });
}

function renderCustomers() {
  const search = document.getElementById('customer-search').value.toLowerCase();
  let customers = Store.getCustomers();
  if (search) customers = customers.filter(c =>
    c.name.toLowerCase().includes(search) || (c.phone||'').includes(search) || (c.email||'').toLowerCase().includes(search)
  );
  const tbody = document.getElementById('customers-tbody');
  if (!customers.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:2rem">No customers found</td></tr>';
    return;
  }
  tbody.innerHTML = customers.map(c => `<tr>
    <td><strong>${escHtml(c.name)}</strong>${c.senior ? ' <span class="status-badge status-low">Senior/PWD</span>' : ''}</td>
    <td>${escHtml(c.phone || '—')}</td>
    <td>${escHtml(c.email || '—')}</td>
    <td><strong>${c.points || 0}</strong> pts</td>
    <td>${fmt(c.totalSpent || 0)}</td>
    <td>${c.visits || 0}</td>
    <td style="display:flex;gap:4px">
      <button class="btn btn-secondary btn-sm" data-edit-cust="${c.id}">Edit</button>
      <button class="btn btn-sm" style="border-color:var(--danger);color:var(--danger)" data-del-cust="${c.id}">Del</button>
    </td>
  </tr>`).join('');

  tbody.querySelectorAll('[data-edit-cust]').forEach(btn => btn.addEventListener('click', () => openCustomerModal(btn.dataset.editCust)));
  tbody.querySelectorAll('[data-del-cust]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (await confirm('Delete Customer', 'Delete this customer record?')) {
        Store.deleteCustomer(btn.dataset.delCust);
        renderCustomers();
        renderCartCustomers();
        toast('Customer deleted');
      }
    });
  });
}

document.getElementById('customer-search').addEventListener('input', renderCustomers);

function openCustomerModal(customerId) {
  const c = customerId ? Store.getCustomers().find(x => x.id === customerId) : null;
  document.getElementById('customer-modal-title').textContent = c ? 'Edit Customer' : 'Add Customer';
  document.getElementById('customer-edit-id').value = c?.id || '';
  document.getElementById('cust-name').value = c?.name || '';
  document.getElementById('cust-phone').value = c?.phone || '';
  document.getElementById('cust-email').value = c?.email || '';
  document.getElementById('cust-address').value = c?.address || '';
  document.getElementById('cust-senior').checked = c?.senior || false;
  showModal('modal-customer');
}

document.getElementById('btn-add-customer').addEventListener('click', () => openCustomerModal(null));
document.getElementById('btn-save-customer').addEventListener('click', () => {
  const name = document.getElementById('cust-name').value.trim();
  if (!name) { toast('Customer name is required', 'error'); return; }
  const existingId = document.getElementById('customer-edit-id').value;
  const existing = existingId ? Store.getCustomers().find(c=>c.id===existingId) : null;
  const customer = {
    id: existingId || OrangeCrypto.uid(),
    name,
    phone: document.getElementById('cust-phone').value.trim(),
    email: document.getElementById('cust-email').value.trim(),
    address: document.getElementById('cust-address').value.trim(),
    senior: document.getElementById('cust-senior').checked,
    points: existing?.points || 0,
    totalSpent: existing?.totalSpent || 0,
    visits: existing?.visits || 0,
    createdAt: existing?.createdAt || Date.now(),
    lastVisit: existing?.lastVisit || null,
  };
  Store.upsertCustomer(customer);
  LocalDashboardSync.schedule();
  hideModal('modal-customer');
  renderCustomers();
  renderCartCustomers();
  toast(existingId ? 'Customer updated' : 'Customer added', 'success');
});

/* ============================
   REPORTS VIEW
   ============================ */
function renderReports() {
  const period = document.getElementById('report-period').value;
  const now = new Date();
  let start;
  if (period === 'today') start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  else if (period === 'week') { const d = new Date(now); d.setDate(d.getDate() - d.getDay()); start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }
  else if (period === 'month') start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  else start = new Date(now.getFullYear(), 0, 1).getTime();

  const orders = Store.getOrders().filter(o => o.createdAt >= start && o.status === 'completed');
  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const tax = orders.reduce((s, o) => s + o.taxAmt, 0);
  const items = orders.reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.qty, 0), 0);
  const costs = orders.reduce((s, o) => {
    return s + o.items.reduce((ss, i) => {
      const p = Store.getProducts().find(x => x.id === i.productId);
      return ss + (p?.cost || 0) * i.qty;
    }, 0);
  }, 0);
  const profit = revenue - costs; // revenue is already net; don't subtract tax (VAT is collected, not a cost)
  const avg = orders.length ? revenue / orders.length : 0;

  document.getElementById('rpt-revenue').textContent = fmt(revenue);
  document.getElementById('rpt-orders').textContent = orders.length;
  document.getElementById('rpt-avg').textContent = fmt(avg);
  document.getElementById('rpt-items').textContent = items;
  document.getElementById('rpt-tax').textContent = fmt(tax);
  document.getElementById('rpt-profit').textContent = fmt(profit);

  // Top products
  const productSales = {};
  orders.forEach(o => o.items.forEach(i => {
    if (!productSales[i.productId]) productSales[i.productId] = { name: i.name, qty: 0, revenue: 0 };
    productSales[i.productId].qty += i.qty;
    productSales[i.productId].revenue += i.price * i.qty;
  }));
  const top = Object.values(productSales).sort((a,b) => b.qty - a.qty).slice(0, 10);
  document.getElementById('top-products-tbody').innerHTML = top.length
    ? top.map(p => `<tr><td>${escHtml(p.name)}</td><td>${p.qty}</td><td>${fmt(p.revenue)}</td></tr>`).join('')
    : '<tr><td colspan="3" style="text-align:center;color:var(--text-muted)">No data</td></tr>';

  // Payment breakdown
  const payBreakdown = {};
  orders.forEach(o => {
    payBreakdown[o.paymentMethod] = (payBreakdown[o.paymentMethod] || 0) + o.total;
  });
  document.getElementById('payment-breakdown').innerHTML = Object.entries(payBreakdown)
    .map(([method, amt]) => `<div class="pay-bar"><span class="pay-bar-method">${capitalizeFirst(method)}</span><span class="pay-bar-amount">${fmt(amt)}</span></div>`).join('') || '<span style="color:var(--text-muted);font-size:0.85rem">No data</span>';
}

document.getElementById('report-period').addEventListener('change', renderReports);
document.getElementById('btn-print-report').addEventListener('click', printReport);

function printReport() {
  const period = document.getElementById('report-period').value;
  const periodLabel = { today: 'Today', week: 'This Week', month: 'This Month', year: 'This Year' }[period] || period;
  const settings = Store.getSettings();
  const biz = settings.bizName || 'My Store';

  // Collect all data shown in report
  const revenue = document.getElementById('rpt-revenue').textContent;
  const orders  = document.getElementById('rpt-orders').textContent;
  const avg     = document.getElementById('rpt-avg').textContent;
  const items   = document.getElementById('rpt-items').textContent;
  const tax     = document.getElementById('rpt-tax').textContent;
  const profit  = document.getElementById('rpt-profit').textContent;

  // Top products rows
  const topRows = [...document.querySelectorAll('#top-products-tbody tr')].map(r =>
    `<tr>${[...r.cells].map(c => `<td>${c.innerHTML}</td>`).join('')}</tr>`
  ).join('');

  // Payment breakdown
  const payRows = [...document.querySelectorAll('#payment-breakdown .pay-bar')].map(b =>
    `<tr><td>${b.querySelector('.pay-bar-method').textContent}</td><td>${b.querySelector('.pay-bar-amount').textContent}</td></tr>`
  ).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <title>${biz} — Sales Report (${periodLabel})</title>
    <style>
      body { font-family: sans-serif; font-size: 13px; color: #111; margin: 2cm; }
      h1 { font-size: 18px; margin: 0 0 4px; }
      .sub { color: #666; font-size: 12px; margin-bottom: 20px; }
      .stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
      .stat { border: 1px solid #ddd; border-radius: 6px; padding: 10px 14px; }
      .stat-label { font-size: 10px; text-transform: uppercase; color: #888; letter-spacing: .04em; }
      .stat-value { font-size: 20px; font-weight: 700; margin-top: 4px; }
      h2 { font-size: 14px; margin: 20px 0 8px; border-bottom: 1px solid #eee; padding-bottom: 6px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { text-align: left; padding: 6px 8px; background: #f5f5f5; border-bottom: 1px solid #ddd; font-size: 11px; text-transform: uppercase; }
      td { padding: 6px 8px; border-bottom: 1px solid #f0f0f0; }
      .footer { margin-top: 30px; font-size: 11px; color: #aaa; text-align: center; }
    </style>
  </head><body>
    <h1>${escHtml(biz)} — Sales Report</h1>
    <div class="sub">Period: ${escHtml(periodLabel)} &nbsp;·&nbsp; Printed: ${new Date().toLocaleString('en-PH')}</div>
    <div class="stats">
      <div class="stat"><div class="stat-label">Total Revenue</div><div class="stat-value">${revenue}</div></div>
      <div class="stat"><div class="stat-label">Orders</div><div class="stat-value">${orders}</div></div>
      <div class="stat"><div class="stat-label">Avg Order Value</div><div class="stat-value">${avg}</div></div>
      <div class="stat"><div class="stat-label">Items Sold</div><div class="stat-value">${items}</div></div>
      <div class="stat"><div class="stat-label">VAT Collected</div><div class="stat-value">${tax}</div></div>
      <div class="stat"><div class="stat-label">Net Profit</div><div class="stat-value">${profit}</div></div>
    </div>
    <h2>Top Selling Products</h2>
    <table><thead><tr><th>Product</th><th>Qty Sold</th><th>Revenue</th></tr></thead><tbody>${topRows || '<tr><td colspan="3" style="color:#aaa">No data</td></tr>'}</tbody></table>
    <h2>Payment Methods Breakdown</h2>
    <table><thead><tr><th>Method</th><th>Amount</th></tr></thead><tbody>${payRows || '<tr><td colspan="2" style="color:#aaa">No data</td></tr>'}</tbody></table>
    <div class="footer">OrangePOS &nbsp;·&nbsp; ${escHtml(biz)}</div>
    <script>window.onload = () => { window.print(); window.onafterprint = () => window.close(); }<\/script>
  </body></html>`;

  const win = window.open('', '_blank', 'width=800,height=600');
  if (win) { win.document.write(html); win.document.close(); }
  else toast('Pop-up blocked. Allow pop-ups to print.', 'warning');
}

/* ============================
   ADMIN VIEW
   ============================ */
function renderAdmin() {
  renderUsers();
  renderCategories();
  renderAuditLog();
  loadSettings();
}

// Admin tabs
document.querySelectorAll('.admin-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('admin-' + tab.dataset.tab).classList.add('active');
  });
});

// Users
function renderUsers() {
  const users = Store.getUsers();
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = users.map(u => `<tr>
    <td><strong>${escHtml(u.name)}</strong></td>
    <td><span class="status-badge" style="background:var(--orange-bg);color:var(--orange-dark)">${capitalizeFirst(u.role)}</span></td>
    <td>${u.lastLogin ? fmtDate(u.lastLogin) : '<span style="color:var(--text-muted)">Never</span>'}</td>
    <td><span class="status-badge ${u.active !== false ? 'status-active' : 'status-inactive'}">${u.active !== false ? 'Active' : 'Inactive'}</span></td>
    <td style="display:flex;gap:4px">
      <button class="btn btn-secondary btn-sm" data-edit-user="${u.id}">Edit</button>
      ${u.id !== App.currentUser?.id ? `<button class="btn btn-sm" style="border-color:var(--danger);color:var(--danger)" data-del-user="${u.id}">Del</button>` : ''}
    </td>
  </tr>`).join('');
  tbody.querySelectorAll('[data-edit-user]').forEach(btn => btn.addEventListener('click', () => openUserModal(btn.dataset.editUser)));
  tbody.querySelectorAll('[data-del-user]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (await confirm('Delete User', 'Delete this user account?')) {
        audit('DELETE_USER', { id: btn.dataset.delUser });
        Store.deleteUser(btn.dataset.delUser);
        renderUsers();
        toast('User deleted');
      }
    });
  });
}

document.getElementById('btn-add-user').addEventListener('click', () => openUserModal(null));

function openUserModal(userId) {
  const u = userId ? Store.getUsers().find(x => x.id === userId) : null;
  document.getElementById('user-modal-title').textContent = u ? 'Edit User' : 'Add User';
  document.getElementById('user-edit-id').value = u?.id || '';
  document.getElementById('usr-name').value = u?.name || '';
  document.getElementById('usr-role').value = u?.role || 'cashier';
  document.getElementById('usr-pin').value = '';
  document.getElementById('usr-pin-confirm').value = '';
  showModal('modal-user');
}

document.getElementById('btn-save-user').addEventListener('click', async () => {
  const name = document.getElementById('usr-name').value.trim();
  if (!name) { toast('Name is required', 'error'); return; }
  const pin = document.getElementById('usr-pin').value;
  const pinConfirm = document.getElementById('usr-pin-confirm').value;
  const existingId = document.getElementById('user-edit-id').value;
  const existing = existingId ? Store.getUsers().find(u=>u.id===existingId) : null;
  let pinHash = existing?.pinHash;
  if (pin) {
    if (pin.length < 4) { toast('PIN must be at least 4 digits', 'error'); return; }
    if (pin !== pinConfirm) { toast('PINs do not match', 'error'); return; }
    if (!/^\d+$/.test(pin)) { toast('PIN must contain only numbers', 'error'); return; }
    pinHash = await OrangeCrypto.hashPin(pin);
  } else if (!existingId) {
    toast('PIN is required for new users', 'error'); return;
  }
  const user = {
    id: existingId || OrangeCrypto.uid(),
    name,
    role: document.getElementById('usr-role').value,
    pinHash,
    active: existing?.active !== false,
    createdAt: existing?.createdAt || Date.now(),
    lastLogin: existing?.lastLogin || null,
  };
  audit(existingId ? 'UPDATE_USER' : 'ADD_USER', { name, role: user.role });
  Store.upsertUser(user);
  hideModal('modal-user');
  renderUsers();
  toast(existingId ? 'User updated' : 'User added', 'success');
});

// Settings
function loadSettings() {
  const s = Store.getSettings();
  document.getElementById('set-biz-name').value = s.bizName || '';
  document.getElementById('set-biz-address').value = s.bizAddress || '';
  document.getElementById('set-biz-phone').value = s.bizPhone || '';
  document.getElementById('set-biz-tin').value = s.bizTin || '';
  document.getElementById('set-receipt-footer').value = s.receiptFooter || '';
  document.getElementById('set-tax-rate').value = s.taxRate ?? 12;
  document.getElementById('set-prices-tax-incl').checked = s.pricesTaxInclusive !== false;
  document.getElementById('set-currency').value = s.currency || '₱';
  document.getElementById('set-low-stock-alert').checked = s.lowStockAlert !== false;
  document.getElementById('set-low-stock-qty').value = s.lowStockQty || 5;
  document.getElementById('set-wholesale-enabled').checked = s.wholesaleEnabled !== false;
  document.getElementById('set-retail-label').value = s.retailLabel || 'Retail';
  document.getElementById('set-wholesale-label').value = s.wholesaleLabel || 'Wholesale';
  document.getElementById('set-wholesale-discount').value = s.wholesaleDiscount ?? 15;
  document.getElementById('set-wholesale-discount-slider').value = s.wholesaleDiscount ?? 15;
  document.getElementById('set-autolock-enabled').checked = s.autoLockEnabled !== false;
  document.getElementById('set-autolock-minutes').value = s.autoLockMinutes ?? 5;
  document.getElementById('set-autolock-slider').value = s.autoLockMinutes ?? 5;
  document.getElementById('set-cloudsync-enabled').checked = s.cloudSyncEnabled === true;
  document.getElementById('set-cloudsync-storename').value = s.cloudSyncStoreName || '';
  document.getElementById('set-cloudsync-url').value = s.cloudSyncUrl || '';
  toggleWholesaleFields();
  updateWholesalePreview();
  updateSyncPendingInfo();
}

function updateSyncPendingInfo() {
  const el = document.getElementById('cloudsync-pending-info');
  if (!el) return;
  const s = Store.getSettings();
  if (!s.cloudSyncEnabled) { el.textContent = ''; return; }
  const pending = Sync.queueLength();
  el.textContent = pending === 0 ? '✓ All events synced' : `${pending} event(s) waiting to sync`;
  el.style.color = pending === 0 ? 'var(--success)' : 'var(--warning)';
}

function toggleWholesaleFields() {
  const enabled = document.getElementById('set-wholesale-enabled').checked;
  document.getElementById('wholesale-fields').style.display = enabled ? '' : 'none';
}

function updateWholesalePreview() {
  const disc = parseFloat(document.getElementById('set-wholesale-discount').value) || 0;
  const retailLabel = document.getElementById('set-retail-label').value || 'Retail';
  const wsLabel = document.getElementById('set-wholesale-label').value || 'Wholesale';
  const bar = document.getElementById('wholesale-preview-bar');
  if (!bar) return;
  const exRetail = 100;
  const exWS = Math.round(exRetail * (1 - disc / 100) * 100) / 100;
  bar.innerHTML = `
    <div class="ws-preview-item"><span class="ws-preview-label">${escHtml(retailLabel)}</span><span class="ws-preview-price">₱${exRetail.toFixed(2)}</span></div>
    <div class="ws-preview-arrow">→</div>
    <div class="ws-preview-item ws-active-preview"><span class="ws-preview-label">${escHtml(wsLabel)}</span><span class="ws-preview-price">₱${exWS.toFixed(2)}</span></div>
    <span class="ws-preview-saving">−${disc}% off retail</span>`;
}

// Sync slider ↔ number input
document.getElementById('set-wholesale-discount').addEventListener('input', (e) => {
  const v = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
  document.getElementById('set-wholesale-discount-slider').value = v;
  updateWholesalePreview();
});
document.getElementById('set-wholesale-discount-slider').addEventListener('input', (e) => {
  document.getElementById('set-wholesale-discount').value = e.target.value;
  updateWholesalePreview();
});
document.getElementById('set-retail-label').addEventListener('input', updateWholesalePreview);
document.getElementById('set-wholesale-label').addEventListener('input', updateWholesalePreview);

document.getElementById('set-wholesale-enabled').addEventListener('change', toggleWholesaleFields);

document.getElementById('btn-save-settings').addEventListener('click', () => {
  const settings = {
    bizName: document.getElementById('set-biz-name').value.trim(),
    bizAddress: document.getElementById('set-biz-address').value.trim(),
    bizPhone: document.getElementById('set-biz-phone').value.trim(),
    bizTin: document.getElementById('set-biz-tin').value.trim(),
    receiptFooter: document.getElementById('set-receipt-footer').value.trim(),
    taxRate: parseFloat(document.getElementById('set-tax-rate').value) || 12,
    pricesTaxInclusive: document.getElementById('set-prices-tax-incl').checked,
    currency: document.getElementById('set-currency').value.trim() || '₱',
    lowStockAlert: document.getElementById('set-low-stock-alert').checked,
    lowStockQty: parseInt(document.getElementById('set-low-stock-qty').value) || 5,
    wholesaleEnabled: document.getElementById('set-wholesale-enabled').checked,
    retailLabel: document.getElementById('set-retail-label').value.trim() || 'Retail',
    wholesaleLabel: document.getElementById('set-wholesale-label').value.trim() || 'Wholesale',
    wholesaleDiscount: parseFloat(document.getElementById('set-wholesale-discount').value) || 0,
    autoLockEnabled: document.getElementById('set-autolock-enabled').checked,
    autoLockMinutes: parseInt(document.getElementById('set-autolock-minutes').value) || 5,
    cloudSyncEnabled: document.getElementById('set-cloudsync-enabled').checked,
    cloudSyncStoreName: document.getElementById('set-cloudsync-storename').value.trim(),
    cloudSyncUrl: document.getElementById('set-cloudsync-url').value.trim(),
  };
  Store.saveSettings(settings);
  audit('UPDATE_SETTINGS', 'Settings updated');
  LocalDashboardSync.pushNow();
  updatePricingToggleUI();
  renderProductGrid();
  AutoLock.reset(); // apply new timeout immediately
  Sync.init(); // re-evaluate sync state with new settings
  updateSyncPendingInfo();
  toast('Settings saved', 'success');
});

document.getElementById('btn-test-sync').addEventListener('click', async () => {
  const url = document.getElementById('set-cloudsync-url').value.trim();
  if (!url) { toast('Enter the Apps Script Web App URL first', 'error'); return; }
  // Save current values temporarily so testConnection picks up the right URL/store name
  const settings = Store.getSettings();
  settings.cloudSyncUrl = url;
  settings.cloudSyncStoreName = document.getElementById('set-cloudsync-storename').value.trim();
  Store.saveSettings(settings);

  toast('Sending test event...', '');
  const ok = await Sync.testConnection();
  if (ok) {
    toast('Test event sent — check your Google Sheet for a "test" row', 'success');
  } else {
    toast('Failed to send — check the URL and your internet connection', 'error');
  }
});

// Categories
function renderCategories() {
  const cats = Store.getCategories();
  const list = document.getElementById('categories-list');
  list.innerHTML = cats.map(c => `
    <div class="category-tag" data-cat-id="${c.id}">
      ${escHtml(c.name)}
      <button data-del-cat="${c.id}" title="Delete">&times;</button>
    </div>`).join('');
  list.querySelectorAll('[data-del-cat]').forEach(btn => {
    btn.addEventListener('click', async () => {
      // Check if category has products
      const hasProducts = Store.getProducts().some(p => p.categoryId === btn.dataset.delCat);
      if (hasProducts) { toast('Cannot delete: category has products', 'error'); return; }
      if (await confirm('Delete Category', 'Delete this category?')) {
        const cats = Store.getCategories().filter(c => c.id !== btn.dataset.delCat);
        Store.saveCategories(cats);
        renderCategories();
        renderCategoryTabs();
        toast('Category deleted');
      }
    });
  });
}

document.getElementById('btn-add-category').addEventListener('click', () => {
  const name = prompt('Category name:');
  if (!name?.trim()) return;
  const cats = Store.getCategories();
  cats.push({ id: OrangeCrypto.uid(), name: name.trim() });
  Store.saveCategories(cats);
  renderCategories();
  renderCategoryTabs();
  renderProductGrid();
  toast('Category added', 'success');
});

// Audit Log
function renderAuditLog() {
  const log = Store.getAuditLog();
  const tbody = document.getElementById('audit-tbody');
  tbody.innerHTML = log.slice(0, 200).map(e => `<tr>
    <td style="white-space:nowrap">${fmtDate(e.ts)}</td>
    <td>${escHtml(e.user)}</td>
    <td><strong>${escHtml(e.action)}</strong></td>
    <td style="font-size:0.8rem;color:var(--text-secondary)">${escHtml(e.details)}</td>
  </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:2rem">No activity yet</td></tr>';
}

// Backup
document.getElementById('btn-backup-export').addEventListener('click', () => {
  const data = Store.exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `orangepos_backup_${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  audit('BACKUP_EXPORT', 'Data exported');
  toast('Backup downloaded', 'success');
});

document.getElementById('btn-backup-import').addEventListener('click', () => {
  document.getElementById('backup-import-file').click();
});

document.getElementById('backup-import-file').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (!await confirm('Import Backup', 'This will replace ALL current data. Continue?')) {
    e.target.value = ''; return;
  }
  const text = await file.text();
  try {
    const data = JSON.parse(text);
    Store.importAll(data);
    audit('BACKUP_IMPORT', 'Data imported from backup');
    toast('Backup restored. Reloading...', 'success');
    setTimeout(() => location.reload(), 1500);
  } catch (err) {
    toast('Invalid backup file: ' + err.message, 'error');
  }
  e.target.value = '';
});

document.getElementById('btn-clear-data').addEventListener('click', async () => {
  if (!await confirm('⚠️ Clear All Data', 'This permanently deletes ALL orders, products, customers, and settings. This CANNOT be undone. Are you absolutely sure?')) return;
  const pin = prompt('Enter your admin PIN to confirm:');
  if (!pin) return;
  const hash = await OrangeCrypto.hashPin(pin);
  const user = Store.getUserByPin(hash);
  if (!user || user.role !== 'admin') { toast('Invalid PIN or insufficient permissions', 'error'); return; }
  Store.clearAll();
  toast('All data cleared. Reloading...', 'warning');
  setTimeout(() => location.reload(), 1500);
});

/* ============================
   MODAL CLOSE BUTTONS
   ============================ */
document.querySelectorAll('.modal-close').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.modal || btn.closest('.modal-overlay')?.id;
    if (targetId) hideModal(targetId);
  });
});
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) hideModal(overlay.id);
  });
});

/* ============================
   BARCODE SCANNER + SEARCH FOCUS
   ============================ */

// Detect whether this device should use "kiosk" behaviors (USB scanner
// auto-focus, etc.) vs "remote viewing" behaviors (phone/tablet touch).
// On touch devices, constantly stealing focus into the search box would
// pop up the on-screen keyboard and break navigation — so we disable it.
const IS_TOUCH_DEVICE = window.matchMedia('(pointer: coarse)').matches
  || ('ontouchstart' in window)
  || navigator.maxTouchPoints > 0;

// Elements that should be allowed to keep focus — never steal from these
function userIsInteracting() {
  if (window._qtyFocused) return true;
  const el = document.activeElement;
  if (!el || el === document.body) return false;
  const tag = el.tagName;
  // Any input/select/button/textarea that is NOT the search bar itself
  if (['INPUT','TEXTAREA','SELECT','BUTTON'].includes(tag) && el.id !== 'product-search') return true;
  // Any element inside a modal
  if (el.closest?.('.modal-overlay:not(.hidden)')) return true;
  return false;
}

function maintainSearchFocus() {
  if (IS_TOUCH_DEVICE) return; // never auto-focus on phones/tablets (would pop keyboard)
  if (App.currentView !== 'pos') return;
  if (userIsInteracting()) return;
  const anyModalOpen = [...document.querySelectorAll('.modal-overlay')].some(m => !m.classList.contains('hidden'));
  if (anyModalOpen) return;
  const searchEl = document.getElementById('product-search');
  if (document.activeElement !== searchEl) searchEl.focus();
}

// Re-focus search when clicking on inert areas (product grid, cart bg, etc.)
// but NOT when the click lands on or inside an interactive element
document.addEventListener('click', (e) => {
  if (IS_TOUCH_DEVICE) return;
  if (App.currentView !== 'pos') return;
  const anyModalOpen = [...document.querySelectorAll('.modal-overlay')].some(m => !m.classList.contains('hidden'));
  if (anyModalOpen) return;
  // Walk up from the click target — if it or any ancestor is interactive, don't steal focus
  const interactiveTags = ['INPUT','SELECT','TEXTAREA','BUTTON','A','LABEL'];
  let node = e.target;
  while (node && node !== document.body) {
    if (interactiveTags.includes(node.tagName)) return;
    node = node.parentElement;
  }
  setTimeout(maintainSearchFocus, 50);
});

// Escape closes modals and returns focus to search
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay:not(.hidden)').forEach(m => m.classList.add('hidden'));
    window._qtyFocused = false;
    setTimeout(maintainSearchFocus, 50);
  }
});

// Barcode scanner logic inside the search input:
// USB scanners type fast and send Enter. We detect this by tracking
// time between keystrokes — if Enter arrives within 80ms of last char,
// treat entire input value as a barcode lookup.
let lastKeyTime = 0;
let scannerMode = false;
let scannerTimer = null;

document.getElementById('product-search').addEventListener('keydown', (e) => {
  const now = Date.now();
  const gap = now - lastKeyTime;
  lastKeyTime = now;

  // If keys are coming in very fast (scanner), flag scanner mode
  if (gap < 80) scannerMode = true;

  if (e.key === 'Enter') {
    e.preventDefault();
    const val = document.getElementById('product-search').value.trim();
    if (!val) return;

    if (scannerMode || val.length >= 3) {
      // Try exact SKU match first (barcode)
      const byBarcode = Store.getProducts().find(p => p.sku === val && p.active !== false);
      if (byBarcode) {
        if (byBarcode.trackStock !== false && byBarcode.stock <= 0) {
          toast(`Out of stock: ${byBarcode.name}`, 'error');
        } else {
          addToCart(byBarcode.id);
          toast(`Added: ${byBarcode.name}`, 'success');
        }
        document.getElementById('product-search').value = '';
        searchTerm = '';
        renderProductGrid();
        scannerMode = false;
        return;
      }
      // Try partial name match — if exactly one result, add it
      const byName = Store.getProducts().filter(p =>
        p.active !== false && p.name.toLowerCase().includes(val.toLowerCase())
      );
      if (byName.length === 1) {
        addToCart(byName[0].id);
        toast(`Added: ${byName[0].name}`, 'success');
        document.getElementById('product-search').value = '';
        searchTerm = '';
        renderProductGrid();
      } else if (byName.length === 0) {
        toast(`Not found: "${val}"`, 'error');
      }
      // If multiple matches, leave search results visible so user can tap
    }
    scannerMode = false;
  }

  // Reset scanner mode after a pause
  clearTimeout(scannerTimer);
  scannerTimer = setTimeout(() => { scannerMode = false; }, 200);
});

// Only restore search focus when losing it to a truly inert element
document.getElementById('product-search').addEventListener('blur', () => {
  if (App.currentView !== 'pos') return;
  setTimeout(() => {
    if (userIsInteracting()) return;
    const anyModalOpen = [...document.querySelectorAll('.modal-overlay')].some(m => !m.classList.contains('hidden'));
    if (!anyModalOpen) maintainSearchFocus();
  }, 200);
});

/* ============================
   LOW STOCK ALERTS
   ============================ */
function checkLowStockAlerts() {
  const settings = Store.getSettings();
  if (!settings.lowStockAlert) return;
  const threshold = settings.lowStockQty || 5;
  const low = Store.getProducts().filter(p =>
    p.active !== false && p.trackStock !== false && p.stock <= threshold && p.stock > 0
  );
  const out = Store.getProducts().filter(p =>
    p.active !== false && p.trackStock !== false && p.stock <= 0
  );

  // Show persistent banner if any low/out stock
  let banner = document.getElementById('stock-alert-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'stock-alert-banner';
    banner.className = 'stock-alert-banner hidden';
    document.getElementById('screen-pos').querySelector('.pos-main').prepend(banner);
  }

  if (out.length || low.length) {
    const outMsg = out.length ? `<strong>${out.length} out of stock</strong>` : '';
    const lowMsg = low.length ? `<strong>${low.length} low stock</strong>` : '';
    const items = [...out.slice(0,3), ...low.slice(0,3)].map(p => p.name).join(', ');
    const suffix = (out.length + low.length) > 6 ? ' & more' : '';
    banner.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span>${[outMsg, lowMsg].filter(Boolean).join(' · ')} — ${escHtml(items)}${suffix}</span>
      <button class="banner-goto-inventory" onclick="document.querySelector('[data-view=inventory]').click()">View Inventory →</button>
      <button class="banner-dismiss" onclick="this.closest('.stock-alert-banner').classList.add('hidden')">✕</button>`;
    banner.classList.remove('hidden');
  } else {
    banner.classList.add('hidden');
  }
}

/* ============================
   LOCAL DASHBOARD SYNC
   Pushes a full data snapshot to a small PHP script on the same
   device (Orange Pi) so the read-only dashboard.html — opened from
   any phone on the same WiFi — can show live data. No internet
   required; this is separate from the Google Sheets cloud sync.
   ============================ */
const LocalDashboardSync = (() => {
  let pushTimer = null;

  function buildSnapshot() {
    const data = Store.exportAll();
    // Add some precomputed "live" info so the dashboard doesn't need
    // to recompute everything itself
    data.liveShift = Store.getOpenShift();
    data.heldOrders = Store.getHeld().length;
    data.currentUser = App.currentUser ? { name: App.currentUser.name, role: App.currentUser.role } : null;
    return data;
  }

  async function push() {
    try {
      await fetch('php/sync.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSnapshot()),
      });
    } catch {
      // Local dashboard sync is best-effort — fail silently
      // (e.g. PHP not set up yet, or running file:// directly)
    }
  }

  // Debounce — wait 1.5s after the last change before pushing,
  // so rapid changes don't spam requests
  function schedule() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, 1500);
  }

  return { schedule, pushNow: push };
})();


(async function init() {
  try {
    // Always start on login screen — never auto-resume a session
    Store.clearSession();
    await seedDefaultData();
    await initAuth();
    updateHeldBadge();
    checkLowStockAlerts();
    Sync.init();
    LocalDashboardSync.pushNow(); // initial snapshot
    setInterval(() => LocalDashboardSync.pushNow(), 10000); // keep dashboard fresh
  } catch (err) {
    // Never leave the user staring at a black screen — show the error
    document.body.classList.remove('loading');
    const errBox = document.createElement('div');
    errBox.style.cssText = 'position:fixed;inset:0;background:#1A1A18;color:#fff;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;font-family:sans-serif;padding:2rem;text-align:center;z-index:999999';
    errBox.innerHTML = `
      <div style="font-size:2rem">⚠️</div>
      <h2 style="margin:0">OrangePOS failed to start</h2>
      <p style="color:#ccc;max-width:480px">${escHtml(err.message || String(err))}</p>
      <button onclick="location.reload()" style="background:#E8650A;color:#fff;border:none;padding:0.6rem 1.5rem;border-radius:8px;font-size:1rem;cursor:pointer">Reload</button>`;
    document.body.appendChild(errBox);
    console.error('OrangePOS init error:', err);
  }
})();
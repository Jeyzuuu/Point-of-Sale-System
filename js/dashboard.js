/**
 * OrangePOS — Live Dashboard (read-only)
 *
 * Polls php/get.php every 5 seconds for the latest data snapshot
 * pushed by OrangePOS (running on the till), and renders a live
 * summary: today's sales, current shift, recent activity, low stock.
 */

const POLL_INTERVAL = 5000;
const STALE_AFTER = 20000; // mark "stale" if no update in 20s

let lastReceivedAt = null;

function fmt(currency, n) {
  return (currency || '₱') + Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function timeAgo(ts) {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  if (diff < 5000) return 'just now';
  if (diff < 60000) return `${Math.floor(diff/1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
  return `${Math.floor(diff/3600000)}h ago`;
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
}

function fmtDate(ts) {
  return new Date(ts).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }

async function poll() {
  try {
    const res = await fetch('php/get.php', { cache: 'no-store' });
    const data = await res.json();

    if (data._empty) {
      renderSetupMessage(data.message);
      setStatus('offline', 'No data yet');
      return;
    }

    lastReceivedAt = data._receivedAt ? new Date(data._receivedAt).getTime() : Date.now();
    render(data);
    updateStatus();
  } catch (err) {
    setStatus('offline', 'Connection error');
  }
}

function updateStatus() {
  if (!lastReceivedAt) { setStatus('offline', 'No data'); return; }
  const age = Date.now() - lastReceivedAt;
  if (age < STALE_AFTER) {
    setStatus('', `Live · updated ${timeAgo(lastReceivedAt)}`);
  } else {
    setStatus('stale', `Stale · last update ${timeAgo(lastReceivedAt)}`);
  }
}

function setStatus(cls, text) {
  const dot = document.getElementById('dash-status-dot');
  const txt = document.getElementById('dash-status-text');
  dot.className = 'dash-status-dot' + (cls ? ' ' + cls : '');
  txt.textContent = text;
}

function renderSetupMessage(message) {
  document.getElementById('dash-container').innerHTML = `
    <div class="dash-setup-msg">
      <h2>👋 No data yet</h2>
      <p>${escHtml(message || 'OrangePOS hasn\'t synced any data to this device yet.')}</p>
      <p style="margin-top:1rem">Open OrangePOS on the till and complete any action (e.g. log in) — it will sync automatically within a few seconds.</p>
    </div>`;
}

function render(data) {
  const settings = data.settings || {};
  const currency = settings.currency || '₱';
  const orders = data.orders || [];
  const products = data.products || [];
  const shift = data.liveShift;

  document.getElementById('dash-biz-name').textContent = settings.bizName || 'OrangePOS — Live Dashboard';

  // ---- Today's stats ----
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayOrders = orders.filter(o => o.status === 'completed' && o.createdAt >= todayStart.getTime());
  const revenue = todayOrders.reduce((s, o) => s + o.total, 0);
  const items = todayOrders.reduce((s, o) => s + o.items.reduce((ss, i) => ss + i.qty, 0), 0);
  const avg = todayOrders.length ? revenue / todayOrders.length : 0;

  let html = '';

  html += `
    <div class="dash-section">
      <h3>Today</h3>
      <div class="dash-stats-grid">
        <div class="dash-stat-card">
          <span class="dash-stat-label">Revenue</span>
          <span class="dash-stat-value">${fmt(currency, revenue)}</span>
        </div>
        <div class="dash-stat-card">
          <span class="dash-stat-label">Orders</span>
          <span class="dash-stat-value">${todayOrders.length}</span>
        </div>
        <div class="dash-stat-card">
          <span class="dash-stat-label">Items Sold</span>
          <span class="dash-stat-value">${items}</span>
        </div>
        <div class="dash-stat-card">
          <span class="dash-stat-label">Avg Order</span>
          <span class="dash-stat-value">${fmt(currency, avg)}</span>
        </div>
      </div>
    </div>`;

  // ---- Shift status ----
  if (shift) {
    const shiftOrders = orders.filter(o => o.status === 'completed' && o.createdAt >= shift.openedAt);
    const cashSales = shiftOrders.filter(o => o.paymentMethod === 'cash').reduce((s,o) => s + o.total, 0);
    const expectedCash = cashSales + (shift.openFloat || 0);
    html += `
      <div class="dash-section">
        <h3>Current Shift</h3>
        <div class="dash-shift-card open">
          <div class="dash-shift-item">
            <span>Status</span>
            <span style="color:var(--success)">● Open</span>
          </div>
          <div class="dash-shift-item">
            <span>Opened By</span>
            <span>${escHtml(shift.openedBy)}</span>
          </div>
          <div class="dash-shift-item">
            <span>Since</span>
            <span>${fmtTime(shift.openedAt)}</span>
          </div>
          <div class="dash-shift-item">
            <span>Opening Float</span>
            <span>${fmt(currency, shift.openFloat || 0)}</span>
          </div>
          <div class="dash-shift-item">
            <span>Expected Cash</span>
            <span>${fmt(currency, expectedCash)}</span>
          </div>
        </div>
      </div>`;
  } else {
    html += `
      <div class="dash-section">
        <h3>Current Shift</h3>
        <div class="dash-shift-card">
          <div class="dash-shift-item">
            <span>Status</span>
            <span style="color:var(--text-muted)">● No shift open</span>
          </div>
        </div>
      </div>`;
  }

  // ---- Currently logged in (who's on the till) ----
  if (data.currentUser) {
    html += `
      <div class="dash-section">
        <h3>Till Status</h3>
        <div class="dash-shift-card">
          <div class="dash-shift-item">
            <span>Logged In As</span>
            <span>${escHtml(data.currentUser.name)} (${capitalize(data.currentUser.role)})</span>
          </div>
          ${data.heldOrders ? `<div class="dash-shift-item"><span>Held Orders</span><span>${data.heldOrders}</span></div>` : ''}
        </div>
      </div>`;
  }

  // ---- Recent activity ----
  const recent = [...orders].sort((a,b) => (b.updatedAt || b.createdAt) - (a.createdAt)).slice(0, 12);
  html += `<div class="dash-section"><h3>Recent Activity</h3><div class="dash-list">`;
  if (!recent.length) {
    html += `<div class="dash-empty">No orders yet</div>`;
  } else {
    html += recent.map(o => {
      const statusColor = o.status === 'completed' ? 'var(--success)' : o.status === 'voided' ? 'var(--warning)' : 'var(--danger)';
      const statusLabel = o.status === 'completed' ? capitalize(o.paymentMethod) : capitalize(o.status);
      return `
        <div class="dash-row">
          <div class="dash-row-main">
            <div class="dash-row-title">${escHtml(o.orderNum)}</div>
            <div class="dash-row-sub">${fmtDate(o.createdAt)} · ${escHtml(o.cashierName)} · ${o.items.reduce((s,i)=>s+i.qty,0)} item(s)</div>
          </div>
          <div style="text-align:right">
            <div class="dash-row-amount">${fmt(currency, o.total)}</div>
            <div class="dash-row-sub" style="color:${statusColor};text-transform:capitalize">${escHtml(statusLabel)}</div>
          </div>
        </div>`;
    }).join('');
  }
  html += `</div></div>`;

  // ---- Low stock ----
  const lowQty = settings.lowStockQty || 5;
  const lowStock = products.filter(p => p.active !== false && p.trackStock !== false && p.stock <= lowQty);
  if (lowStock.length) {
    html += `<div class="dash-section"><h3>Low / Out of Stock (${lowStock.length})</h3><div class="dash-list">`;
    html += lowStock.slice(0, 20).map(p => {
      const out = p.stock <= 0;
      return `
        <div class="dash-row">
          <div class="dash-row-main">
            <div class="dash-row-title">${escHtml(p.name)}</div>
            <div class="dash-row-sub">${escHtml(p.sku || '')}</div>
          </div>
          <span class="dash-low-stock-qty ${out ? 'out' : 'low'}">${out ? 'Out of stock' : `${p.stock} ${p.unit || 'pcs'}`}</span>
        </div>`;
    }).join('');
    html += `</div></div>`;
  }

  document.getElementById('dash-container').innerHTML = html;
  document.getElementById('dash-footer').textContent =
    `OrangePOS Live Dashboard · Read-only · Last synced ${lastReceivedAt ? fmtDate(lastReceivedAt) : '—'}`;
}

// Initial load + polling
poll();
setInterval(poll, POLL_INTERVAL);
// Also re-check staleness every few seconds even without a new poll result
setInterval(updateStatus, 5000);
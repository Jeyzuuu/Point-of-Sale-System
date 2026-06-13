/**
 * OrangePOS — Cloud Sync Module
 *
 * Sends sales and shift events to a Google Sheet (via a Google Apps
 * Script Web App acting as a webhook), so a manager can view live sales
 * from anywhere with an internet connection — not just on the same WiFi.
 *
 * - Works fully offline: events are queued in localStorage and sent
 *   when a connection is available.
 * - Uses fetch with mode:'no-cors' + text/plain content type, which is
 *   the standard workaround for posting to Apps Script web apps without
 *   triggering a CORS preflight request (Apps Script doesn't support
 *   OPTIONS preflight responses).
 * - Because of 'no-cors', the response cannot be read — success is
 *   inferred from the absence of a network error. Verify actual receipt
 *   by checking the Google Sheet.
 */

const Sync = (() => {
  const QUEUE_KEY = 'opos_sync_queue';
  let retryTimer = null;
  let flushing = false;

  function getQueue() {
    try { return JSON.parse(localStorage.getItem(QUEUE_KEY)) || []; }
    catch { return []; }
  }
  function saveQueue(q) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch {}
  }
  function queueLength() { return getQueue().length; }

  function isEnabled() {
    const s = Store.getSettings();
    return !!(s.cloudSyncEnabled && s.cloudSyncUrl);
  }

  function enqueue(payload) {
    if (!isEnabled()) return;
    const q = getQueue();
    q.push({ id: OrangeCrypto.uid(), ts: Date.now(), payload });
    if (q.length > 1000) q.splice(0, q.length - 1000); // cap queue size
    saveQueue(q);
    updateSyncBadge();
    flush();
  }

  async function sendOne(item) {
    const s = Store.getSettings();
    const body = JSON.stringify({
      storeName: s.cloudSyncStoreName || s.bizName || 'Store',
      ...item.payload,
    });
    try {
      await fetch(s.cloudSyncUrl, {
        method: 'POST',
        mode: 'no-cors', // required for Apps Script webhooks from a browser
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body,
      });
      return true; // opaque response — assume delivered if no network error
    } catch {
      return false;
    }
  }

  async function flush() {
    if (flushing) return;
    if (!isEnabled()) return;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

    let q = getQueue();
    if (!q.length) return;

    flushing = true;
    try {
      for (const item of [...q]) {
        const ok = await sendOne(item);
        if (ok) {
          q = q.filter(x => x.id !== item.id);
          saveQueue(q);
        } else {
          break; // stop on first failure; retry on next cycle
        }
      }
    } finally {
      flushing = false;
      updateSyncBadge();
    }
  }

  function updateSyncBadge() {
    const badge = document.getElementById('sync-status-badge');
    if (!badge) return;
    const s = Store.getSettings();
    if (!s.cloudSyncEnabled) { badge.classList.add('hidden'); return; }
    const pending = queueLength();
    badge.classList.remove('hidden');
    if (!s.cloudSyncUrl) {
      badge.textContent = '☁ Not configured';
      badge.className = 'sync-badge error';
    } else if (pending === 0) {
      badge.textContent = '☁ Synced';
      badge.className = 'sync-badge synced';
    } else {
      badge.textContent = `☁ ${pending} pending`;
      badge.className = 'sync-badge pending';
    }
  }

  function init() {
    window.addEventListener('online', flush);
    if (retryTimer) clearInterval(retryTimer);
    retryTimer = setInterval(flush, 60000); // retry every 60s
    flush();
    updateSyncBadge();
  }

  /* ---- Event builders ---- */

  function queueOrder(order) {
    enqueue({
      type: order.status === 'completed' ? 'order' : order.status, // order | voided | refunded
      orderNum: order.orderNum,
      timestamp: order.createdAt,
      cashier: order.cashierName,
      itemCount: order.items.reduce((sum, i) => sum + i.qty, 0),
      subtotal: order.subtotal,
      discount: order.discountAmt,
      tax: order.taxAmt,
      total: order.total,
      paymentMethod: order.paymentMethod,
      pricingMode: order.pricingMode || 'retail',
      status: order.status,
    });
  }

  function queueOrderStatusChange(order) {
    enqueue({
      type: order.status, // 'voided' | 'refunded'
      orderNum: order.orderNum,
      timestamp: Date.now(),
      total: order.total,
      by: order.voidedBy || order.refundedBy || '',
      status: order.status,
    });
  }

  function queueShift(shift, eventType) {
    enqueue({
      type: eventType, // 'shift_open' | 'shift_close'
      shiftId: shift.id,
      timestamp: Date.now(),
      openedAt: shift.openedAt,
      openedBy: shift.openedBy,
      openFloat: shift.openFloat || 0,
      closedAt: shift.closedAt || '',
      closedBy: shift.closedBy || '',
    });
  }

  async function testConnection() {
    if (!isEnabled() && !Store.getSettings().cloudSyncUrl) return false;
    const s = Store.getSettings();
    const body = JSON.stringify({
      storeName: s.cloudSyncStoreName || s.bizName || 'Store',
      type: 'test',
      timestamp: Date.now(),
      message: 'OrangePOS connection test',
    });
    try {
      await fetch(s.cloudSyncUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body,
      });
      return true;
    } catch {
      return false;
    }
  }

  return {
    init, flush, queueOrder, queueOrderStatusChange, queueShift,
    testConnection, queueLength, updateSyncBadge, isEnabled,
  };
})();
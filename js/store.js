/**
 * OrangePOS — Store Module v2
 *
 * PRIMARY storage: filesystem via PHP (data/save.php / data/load.php)
 * MIRROR storage:  localStorage (fast reads during a session)
 *
 * On startup: load from file → populate localStorage
 * On every write: update localStorage immediately + save to file
 *
 * This means data survives browser cache clears, Chromium profile
 * resets, incognito accidents, and reboots — as long as the SD card
 * is intact.
 */

const Store = (() => {
  const KEYS = {
    users:      'opos_users',
    products:   'opos_products',
    orders:     'opos_orders',
    customers:  'opos_customers',
    categories: 'opos_categories',
    settings:   'opos_settings',
    audit:      'opos_audit',
    held:       'opos_held',
    session:    'opos_session',
    shifts:     'opos_shifts',
    stockLog:   'opos_stock_log',
  };

  const SETTINGS_DEFAULTS = {
    bizName:           'My Store',
    bizAddress:        '',
    bizPhone:          '',
    bizTin:            '',
    receiptFooter:     'Thank you for your purchase!',
    taxRate:           12,
    pricesTaxInclusive: true,
    currency:          '₱',
    lowStockAlert:     true,
    lowStockQty:       5,
    wholesaleEnabled:  true,
    retailLabel:       'Retail',
    wholesaleLabel:    'Wholesale',
    wholesaleDiscount: 15,
<<<<<<< Updated upstream
    autoLockEnabled: true,
    autoLockMinutes: 5,
    cloudSyncEnabled: false,
    cloudSyncUrl: '',
    cloudSyncStoreName: '',
=======
    autoLockEnabled:   true,
    autoLockMinutes:   5,
    cloudSyncEnabled:  false,
    cloudSyncUrl:      '',
    cloudSyncStoreName:'',
>>>>>>> Stashed changes
  };

  /* ---- localStorage helpers (fast in-session access) ---- */
  function _get(key) {
    try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; }
    catch { return null; }
  }
  function _set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch { return false; }
  }

  /* ----------------------------------------------------------------
   * FILE PERSISTENCE
   * All data is saved to data/database.json via PHP on every write.
   * Reads come from localStorage (populated from file on startup).
   * ---------------------------------------------------------------- */
  let _saveTimer = null;
  let _saving    = false;

  function _buildSnapshot() {
    return {
      version:    2,
      savedAt:    new Date().toISOString(),
      users:      _get(KEYS.users)      || [],
      products:   _get(KEYS.products)   || [],
      orders:     _get(KEYS.orders)     || [],
      customers:  _get(KEYS.customers)  || [],
      categories: _get(KEYS.categories) || [],
      settings:   _get(KEYS.settings)   || {},
      shifts:     _get(KEYS.shifts)     || [],
      stockLog:   _get(KEYS.stockLog)   || [],
      audit:      _get(KEYS.audit)      || [],
    };
  }

  async function _saveToFile() {
    if (_saving) return;
    _saving = true;
    try {
      const res = await fetch('data/save.php', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(_buildSnapshot()),
      });
      if (!res.ok) {
        console.warn('OrangePOS: file save returned', res.status);
      }
    } catch (err) {
      console.warn('OrangePOS: file save failed (offline or PHP unavailable)', err.message);
    } finally {
      _saving = false;
    }
  }

  // Debounce saves — wait 800ms after last write before hitting disk.
  // Immediate writes (sales, critical data) can call _saveToFile() directly.
  function _scheduleSave() {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(_saveToFile, 800);
  }

  // Call after any write that should persist immediately
  function _saveCritical() {
    clearTimeout(_saveTimer);
    _saveToFile();
  }

  /**
   * Load the full database from the file into localStorage.
   * Called ONCE on app startup before anything else runs.
   * Returns true if file data was found, false if first run.
   */
  async function loadFromFile() {
    try {
      const res  = await fetch('data/load.php', { cache: 'no-store' });
      const data = await res.json();

      if (data._empty) {
        console.info('OrangePOS: No database file yet — first run, will seed defaults');
        return false;
      }

      if (data.error) {
        console.error('OrangePOS: Database load error:', data.error);
        return false;
      }

      if (data._restoredFromBackup) {
        console.warn('OrangePOS: Restored from backup —', data._warning);
      }

      // Populate localStorage from file data
      const map = {
        [KEYS.users]:      data.users,
        [KEYS.products]:   data.products,
        [KEYS.orders]:     data.orders,
        [KEYS.customers]:  data.customers,
        [KEYS.categories]: data.categories,
        [KEYS.settings]:   data.settings,
        [KEYS.shifts]:     data.shifts,
        [KEYS.stockLog]:   data.stockLog,
        [KEYS.audit]:      data.audit,
      };

      Object.entries(map).forEach(([key, val]) => {
        if (val !== undefined && val !== null) _set(key, val);
      });

      console.info('OrangePOS: Database loaded from file —',
        (data.products || []).length, 'products,',
        (data.orders || []).length, 'orders,',
        (data.customers || []).length, 'customers');

      return true;
    } catch (err) {
      console.warn('OrangePOS: Could not load from file (PHP unavailable?):', err.message);
      console.info('OrangePOS: Falling back to localStorage');
      return false;
    }
  }

  /* ---- Users ---- */
  function getUsers() { return _get(KEYS.users) || []; }
  function saveUsers(arr) { _set(KEYS.users, arr); _scheduleSave(); }
  function getUserByPin(pinHash) {
    return getUsers().find(u => u.pinHash === pinHash && u.active !== false) || null;
  }
  function upsertUser(user) {
    const users = getUsers();
    const idx = users.findIndex(u => u.id === user.id);
    if (idx >= 0) users[idx] = user; else users.push(user);
    saveUsers(users);
  }
  function deleteUser(id) { saveUsers(getUsers().filter(u => u.id !== id)); }

  /* ---- Products ---- */
  function getProducts() { return _get(KEYS.products) || []; }
  function saveProducts(arr) { _set(KEYS.products, arr); _scheduleSave(); }
  function upsertProduct(product) {
    const products = getProducts();
    const idx = products.findIndex(p => p.id === product.id);
    if (idx >= 0) products[idx] = product; else products.push(product);
    saveProducts(products);
  }
  function deleteProduct(id) { saveProducts(getProducts().filter(p => p.id !== id)); }
  function decrementStock(items) {
    const products = getProducts();
    items.forEach(item => {
      const p = products.find(x => x.id === item.productId);
      if (p && p.trackStock !== false) p.stock = Math.max(0, (p.stock || 0) - item.qty);
    });
    saveProducts(products);
  }
  function incrementStock(items) {
    const products = getProducts();
    items.forEach(item => {
      const p = products.find(x => x.id === item.productId);
      if (p && p.trackStock !== false) p.stock = (p.stock || 0) + item.qty;
    });
    saveProducts(products);
  }

  /* ---- Stock Adjustment Log ---- */
  function getStockLog() { return _get(KEYS.stockLog) || []; }
  function addStockEntry(entry) {
    const log = getStockLog();
    log.unshift(entry);
    if (log.length > 2000) log.splice(2000);
    _set(KEYS.stockLog, log);
    _scheduleSave();
  }

  /* ---- Orders ---- */
  function getOrders() { return _get(KEYS.orders) || []; }
  function saveOrders(arr) { _set(KEYS.orders, arr); _saveCritical(); }
  function addOrder(order) {
    const orders = getOrders();
    orders.push(order);
    saveOrders(orders); // critical — save immediately
  }
  function updateOrderStatus(id, status, extra = {}) {
    const orders = getOrders();
    const o = orders.find(x => x.id === id);
    if (o) { Object.assign(o, { status, updatedAt: Date.now(), ...extra }); saveOrders(orders); }
  }
  function updateOrder(id, fields) {
    const orders = getOrders();
    const o = orders.find(x => x.id === id);
    if (o) { Object.assign(o, fields); saveOrders(orders); }
  }

  /* ---- Customers ---- */
  function getCustomers() { return _get(KEYS.customers) || []; }
  function saveCustomers(arr) { _set(KEYS.customers, arr); _scheduleSave(); }
  function upsertCustomer(customer) {
    const customers = getCustomers();
    const idx = customers.findIndex(c => c.id === customer.id);
    if (idx >= 0) customers[idx] = customer; else customers.push(customer);
    saveCustomers(customers);
  }
  function deleteCustomer(id) { saveCustomers(getCustomers().filter(c => c.id !== id)); }
  function updateCustomerStats(customerId, total, points) {
    const customers = getCustomers();
    const c = customers.find(x => x.id === customerId);
    if (c) {
      c.totalSpent = (c.totalSpent || 0) + total;
      c.points     = (c.points || 0) + points;
      c.visits     = (c.visits || 0) + 1;
      c.lastVisit  = Date.now();
      saveCustomers(customers);
    }
  }

  /* ---- Categories ---- */
  function getCategories() { return _get(KEYS.categories) || []; }
  function saveCategories(arr) { _set(KEYS.categories, arr); _scheduleSave(); }

  /* ---- Settings — always merges with defaults so new fields are never undefined ---- */
  function getSettings() {
    const saved = _get(KEYS.settings) || {};
    return Object.assign({}, SETTINGS_DEFAULTS, saved);
  }
  function saveSettings(settings) { _set(KEYS.settings, settings); _scheduleSave(); }

  /* ---- Shifts ---- */
  function getShifts() { return _get(KEYS.shifts) || []; }
  function saveShifts(arr) { _set(KEYS.shifts, arr); _saveCritical(); }
  function addShift(shift) { const s = getShifts(); s.push(shift); saveShifts(s); }
  function getOpenShift() { return getShifts().find(s => s.status === 'open') || null; }

  /* ---- Audit Log ---- */
  function getAuditLog() { return _get(KEYS.audit) || []; }
  function addAuditEntry(entry) {
    const log = getAuditLog();
    log.unshift(entry);
    if (log.length > 2000) log.splice(2000);
    _set(KEYS.audit, log);
    _scheduleSave();
  }

  /* ---- Held Orders ---- */
  function getHeld() { return _get(KEYS.held) || []; }
  function saveHeld(arr) { _set(KEYS.held, arr); }  // held orders: localStorage only (ephemeral)
  function addHeld(order) { const h = getHeld(); h.push(order); saveHeld(h); }
  function removeHeld(id) { saveHeld(getHeld().filter(h => h.id !== id)); }

  /* ---- Session (localStorage only — intentionally not persisted to file) ---- */
  function getSession() { return _get(KEYS.session); }
  function setSession(user) { _set(KEYS.session, user); }
  function clearSession() { localStorage.removeItem(KEYS.session); }

  /* ---- Export / Import / Clear ---- */
  function exportAll() {
    return {
      version:    2,
      exportedAt: new Date().toISOString(),
      users:      getUsers(),
      products:   getProducts(),
      orders:     getOrders(),
      customers:  getCustomers(),
      categories: getCategories(),
      settings:   getSettings(),
      shifts:     getShifts(),
      stockLog:   getStockLog(),
    };
  }

  function importAll(data) {
    if (!data || (data.version !== 1 && data.version !== 2)) throw new Error('Invalid backup format');
    if (data.users)      { _set(KEYS.users, data.users); }
    if (data.products)   { _set(KEYS.products, data.products); }
    if (data.orders)     { _set(KEYS.orders, data.orders); }
    if (data.customers)  { _set(KEYS.customers, data.customers); }
    if (data.categories) { _set(KEYS.categories, data.categories); }
    if (data.settings)   { _set(KEYS.settings, data.settings); }
    if (data.shifts)     { _set(KEYS.shifts, data.shifts); }
    if (data.stockLog)   { _set(KEYS.stockLog, data.stockLog); }
    _saveCritical(); // write the imported data to file immediately
  }

  function clearAll() {
    Object.values(KEYS).forEach(k => localStorage.removeItem(k));
    _saveCritical(); // overwrite file with empty data
  }

  return {
    loadFromFile,
    getUsers, saveUsers, getUserByPin, upsertUser, deleteUser,
    getProducts, saveProducts, upsertProduct, deleteProduct, decrementStock, incrementStock,
    getStockLog, addStockEntry,
    getOrders, saveOrders, addOrder, updateOrderStatus, updateOrder,
    getCustomers, saveCustomers, upsertCustomer, deleteCustomer, updateCustomerStats,
    getCategories, saveCategories,
    getSettings, saveSettings,
    getShifts, saveShifts, addShift, getOpenShift,
    getAuditLog, addAuditEntry,
    getHeld, addHeld, removeHeld,
    getSession, setSession, clearSession,
    exportAll, importAll, clearAll,
  };
})();
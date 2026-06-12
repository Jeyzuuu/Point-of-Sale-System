/**
 * OrangePOS — Store Module
 * All data persistence via localStorage
 */

const Store = (() => {
  const KEYS = {
    users: 'opos_users',
    products: 'opos_products',
    orders: 'opos_orders',
    customers: 'opos_customers',
    categories: 'opos_categories',
    settings: 'opos_settings',
    audit: 'opos_audit',
    held: 'opos_held',
    session: 'opos_session',
    shifts: 'opos_shifts',
    stockLog: 'opos_stock_log',
  };

  const SETTINGS_DEFAULTS = {
    bizName: 'My Store',
    bizAddress: '',
    bizPhone: '',
    bizTin: '',
    receiptFooter: 'Thank you for your purchase!',
    taxRate: 12,
    pricesTaxInclusive: true,
    currency: '₱',
    lowStockAlert: true,
    lowStockQty: 5,
    wholesaleEnabled: true,
    retailLabel: 'Retail',
    wholesaleLabel: 'Wholesale',
    wholesaleDiscount: 15,
  };

  function _get(key) {
    try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : null; }
    catch { return null; }
  }
  function _set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch { return false; }
  }

  /* ---- Users ---- */
  function getUsers() { return _get(KEYS.users) || []; }
  function saveUsers(arr) { _set(KEYS.users, arr); }
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
  function saveProducts(arr) { _set(KEYS.products, arr); }
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
  }

  /* ---- Orders ---- */
  function getOrders() { return _get(KEYS.orders) || []; }
  function saveOrders(arr) { _set(KEYS.orders, arr); }
  function addOrder(order) {
    const orders = getOrders();
    orders.push(order);
    saveOrders(orders);
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
  function saveCustomers(arr) { _set(KEYS.customers, arr); }
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
      c.points = (c.points || 0) + points;
      c.visits = (c.visits || 0) + 1;
      c.lastVisit = Date.now();
      saveCustomers(customers);
    }
  }

  /* ---- Categories ---- */
  function getCategories() { return _get(KEYS.categories) || []; }
  function saveCategories(arr) { _set(KEYS.categories, arr); }

  /* ---- Settings — always merges with defaults so new fields are never undefined ---- */
  function getSettings() {
    const saved = _get(KEYS.settings) || {};
    return Object.assign({}, SETTINGS_DEFAULTS, saved);
  }
  function saveSettings(settings) { _set(KEYS.settings, settings); }

  /* ---- Shifts / Z-Report ---- */
  function getShifts() { return _get(KEYS.shifts) || []; }
  function saveShifts(arr) { _set(KEYS.shifts, arr); }
  function addShift(shift) {
    const shifts = getShifts();
    shifts.push(shift);
    _set(KEYS.shifts, shifts);
  }
  function getOpenShift() {
    return getShifts().find(s => s.status === 'open') || null;
  }

  /* ---- Audit Log ---- */
  function getAuditLog() { return _get(KEYS.audit) || []; }
  function addAuditEntry(entry) {
    const log = getAuditLog();
    log.unshift(entry);
    if (log.length > 2000) log.splice(2000);
    _set(KEYS.audit, log);
  }

  /* ---- Held Orders ---- */
  function getHeld() { return _get(KEYS.held) || []; }
  function saveHeld(arr) { _set(KEYS.held, arr); }
  function addHeld(order) { const h = getHeld(); h.push(order); saveHeld(h); }
  function removeHeld(id) { saveHeld(getHeld().filter(h => h.id !== id)); }

  /* ---- Session ---- */
  function getSession() { return _get(KEYS.session); }
  function setSession(user) { _set(KEYS.session, user); }
  function clearSession() { localStorage.removeItem(KEYS.session); }

  /* ---- Export / Import ---- */
  function exportAll() {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      users: getUsers(),
      products: getProducts(),
      orders: getOrders(),
      customers: getCustomers(),
      categories: getCategories(),
      settings: getSettings(),
      shifts: getShifts(),
      stockLog: getStockLog(),
    };
  }
  function importAll(data) {
    if (!data || data.version !== 1) throw new Error('Invalid backup format');
    if (data.users) saveUsers(data.users);
    if (data.products) saveProducts(data.products);
    if (data.orders) saveOrders(data.orders);
    if (data.customers) saveCustomers(data.customers);
    if (data.categories) saveCategories(data.categories);
    if (data.settings) saveSettings(data.settings);
    if (data.shifts) saveShifts(data.shifts);
    if (data.stockLog) _set(KEYS.stockLog, data.stockLog);
  }
  function clearAll() { Object.values(KEYS).forEach(k => localStorage.removeItem(k)); }

  return {
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
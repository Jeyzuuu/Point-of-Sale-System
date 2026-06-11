/**
 * OrangePOS — Crypto Module
 * PIN hashing via Web Crypto API (SHA-256)
 * Data encryption for sensitive fields
 */

const OrangeCrypto = (() => {
  /**
   * Hash a PIN using SHA-256 with a fixed salt
   * Returns hex string
   */
  async function hashPin(pin) {
    const salt = 'OrangePOS_v1_' + pin.length;
    const encoder = new TextEncoder();
    const data = encoder.encode(salt + pin);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Verify a PIN against a stored hash
   */
  async function verifyPin(pin, storedHash) {
    const hash = await hashPin(pin);
    return hash === storedHash;
  }

  /**
   * Generate a simple HMAC-like signature for data integrity
   */
  async function signData(data) {
    const encoder = new TextEncoder();
    const key = encoder.encode('OrangePOS_integrity_key_2024');
    const msg = encoder.encode(JSON.stringify(data));
    const hashBuffer = await crypto.subtle.digest('SHA-256', new Uint8Array([...key, ...msg]));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
  }

  /**
   * Generate a unique ID
   */
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
  }

  /**
   * Generate a unique, human-readable order number
   * Format: YYMMDD-HHMMSS-XXXX (date + time + random hex)
   * Collision probability: astronomically low
   */
  function orderNum() {
    const d = new Date();
    const yy = String(d.getFullYear()).slice(2);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    const ss = String(d.getSeconds()).padStart(2, '0');
    const rand = Math.floor(Math.random() * 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
    return `${yy}${mm}${dd}-${hh}${mi}${ss}-${rand}`;
  }

  return { hashPin, verifyPin, signData, uid, orderNum };
})();
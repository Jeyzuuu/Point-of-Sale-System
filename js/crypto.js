/**
 * OrangePOS — Crypto Module
 * PIN hashing via Web Crypto API (SHA-256), with a pure-JS SHA-256
 * fallback for insecure contexts (e.g. accessing via a LAN IP over
 * plain HTTP, where window.crypto.subtle is unavailable).
 */

const OrangeCrypto = (() => {

  /* ---------------------------------------------------------
   * Pure JavaScript SHA-256 implementation (fallback only)
   * Used when crypto.subtle is not available (insecure context:
   * http://<lan-ip> instead of https:// or http://localhost)
   * --------------------------------------------------------- */
  function sha256Fallback(message) {
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }

    const utf8 = unescape(encodeURIComponent(message));
    const bytes = [];
    for (let i = 0; i < utf8.length; i++) bytes.push(utf8.charCodeAt(i));

    const h = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];
    const k = [
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ];

    // Pre-processing: padding
    const bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    for (let i = 7; i >= 0; i--) bytes.push((bitLen / Math.pow(2, i * 8)) & 0xff);

    // Process in 512-bit (64-byte) chunks
    for (let chunkStart = 0; chunkStart < bytes.length; chunkStart += 64) {
      const w = new Array(64).fill(0);
      for (let i = 0; i < 16; i++) {
        w[i] = (bytes[chunkStart + i*4] << 24) | (bytes[chunkStart + i*4+1] << 16) |
               (bytes[chunkStart + i*4+2] << 8) | (bytes[chunkStart + i*4+3]);
      }
      for (let i = 16; i < 64; i++) {
        const s0 = rightRotate(w[i-15], 7) ^ rightRotate(w[i-15], 18) ^ (w[i-15] >>> 3);
        const s1 = rightRotate(w[i-2], 17) ^ rightRotate(w[i-2], 19) ^ (w[i-2] >>> 10);
        w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
      }

      let [a,b,c,d,e,f,g,hh] = h;

      for (let i = 0; i < 64; i++) {
        const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (hh + S1 + ch + k[i] + w[i]) | 0;
        const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) | 0;

        hh = g; g = f; f = e; e = (d + temp1) | 0;
        d = c; c = b; b = a; a = (temp1 + temp2) | 0;
      }

      h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
      h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0;
    }

    return h.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }

  /**
   * Compute SHA-256 hex digest of a string.
   * Uses Web Crypto API when available (secure contexts),
   * falls back to pure JS implementation otherwise.
   */
  async function sha256Hex(str) {
    if (window.crypto && window.crypto.subtle) {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch {
        // fall through to JS fallback
      }
    }
    return sha256Fallback(str);
  }

  /**
   * Hash a PIN using SHA-256 with a fixed salt
   * Returns hex string
   */
  async function hashPin(pin) {
    const salt = 'OrangePOS_v1_' + pin.length;
    return sha256Hex(salt + pin);
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
    const key = 'OrangePOS_integrity_key_2024';
    const msg = JSON.stringify(data);
    const full = await sha256Hex(key + msg);
    return full.substring(0, 16);
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
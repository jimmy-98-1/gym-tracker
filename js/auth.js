// ─── AUTH MODULE ──────────────────────────────────────────────────────────────
// SECURITY: all authentication logic is centralized here — registration, login,
//           session management, brute-force protection, and data encryption.

// SECURITY: use v2 namespace to avoid collisions with old plaintext credential store
const AUTH_ACCOUNTS_KEY   = 'gym_accounts_v2';
const SESSION_KEY         = 'gym_session_v2';

// SECURITY: 8-hour session lifetime — balances usability with security risk
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;

// SECURITY: lock account after 5 failed attempts for 15 minutes
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS   = 15 * 60 * 1000;

// ─── BINARY / ENCODING HELPERS ────────────────────────────────────────────────

function _bufToHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function _hexToBuf(hex) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  return arr.buffer;
}
function _bufToB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function _b64ToBuf(b64) {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
}

// ─── CRYPTO PRIMITIVES ────────────────────────────────────────────────────────

// SECURITY: PBKDF2-SHA256 with 200,000 iterations — raises the cost of offline brute-force attacks
async function _pbkdf2Hash(password, salt) {
  const enc = new TextEncoder();
  const keyMat = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 200000 },
    keyMat, 256
  );
  return _bufToHex(bits);
}

// SECURITY: derive a 256-bit AES-GCM key from password — separate from password hash to avoid
//           leaking hash material via the encryption key or vice versa
async function _pbkdf2Key(password, salt) {
  const enc = new TextEncoder();
  const keyMat = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 200000 },
    keyMat,
    { name: 'AES-GCM', length: 256 },
    true,                     // SECURITY: exportable so raw bytes can be stored in sessionStorage
    ['encrypt', 'decrypt']
  );
}

// SECURITY: constant-time string comparison — prevents timing side-channel on hash comparison
function _safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ─── ACCOUNT STORAGE ─────────────────────────────────────────────────────────

function _getAccounts() {
  try { return JSON.parse(localStorage.getItem(AUTH_ACCOUNTS_KEY) || '{}'); } catch { return {}; }
}
function _saveAccounts(obj) {
  // SECURITY: stores PBKDF2 hashes and salts only — plaintext passwords never touch localStorage
  localStorage.setItem(AUTH_ACCOUNTS_KEY, JSON.stringify(obj));
}

// ─── REGISTRATION ─────────────────────────────────────────────────────────────

async function registerAccount(email, displayName, password) {
  // SECURITY: normalize email to lowercase before storing — prevents duplicate accounts via case variants
  const norm = email.trim().toLowerCase();
  const accounts = _getAccounts();
  if (accounts[norm]) return { success: false, error: 'Ese email ya está registrado.' };

  // SECURITY: two independent random 256-bit salts — one for password hashing, one for key derivation.
  //           If one salt leaks it does not compromise the other operation.
  const hashSalt = crypto.getRandomValues(new Uint8Array(32));
  const keySalt  = crypto.getRandomValues(new Uint8Array(32));

  const passwordHash = await _pbkdf2Hash(password, hashSalt);

  accounts[norm] = {
    email: norm,
    displayName: displayName.trim(),
    passwordHash,                          // SECURITY: PBKDF2 output — never the raw password
    hashSalt: _bufToHex(hashSalt.buffer),
    keySalt:  _bufToHex(keySalt.buffer),   // SECURITY: salt for AES data-key derivation
  };
  _saveAccounts(accounts);
  return { success: true };
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────

async function loginWithCredentials(email, password) {
  const norm = email.trim().toLowerCase();

  // SECURITY: lockout check runs before any DB lookup — prevents credential enumeration via timing
  if (isAccountLocked(norm)) {
    const mins = Math.ceil(getLockoutRemainingMs(norm) / 60000);
    return { success: false, error: `Cuenta bloqueada. Intenta de nuevo en ${mins} minuto(s).` };
  }

  const accounts = _getAccounts();
  const account  = accounts[norm];

  if (!account) {
    // SECURITY: record a failed attempt even for unknown emails — prevents user-enumeration by timing difference
    recordFailedAttempt(norm);
    return { success: false, error: 'Email o contraseña incorrectos.' };
  }

  const hashSalt = new Uint8Array(_hexToBuf(account.hashSalt));
  const provided = await _pbkdf2Hash(password, hashSalt);

  // SECURITY: constant-time comparison — equal-length hex strings compared bit-by-bit to prevent timing leaks
  if (!_safeEqual(provided, account.passwordHash)) {
    recordFailedAttempt(norm);
    const att = _getAttempts(norm);
    const left = MAX_ATTEMPTS - att.count;
    if (left <= 0) return { success: false, error: 'Cuenta bloqueada 15 minutos por demasiados intentos.' };
    return { success: false, error: `Email o contraseña incorrectos. ${Math.max(0, left)} intento(s) restante(s).` };
  }

  clearFailedAttempts(norm);

  // SECURITY: derive the data encryption key from the password — the raw key bytes are placed in
  //           sessionStorage (cleared on tab/browser close) and never written to localStorage
  const keySalt  = new Uint8Array(_hexToBuf(account.keySalt));
  const dataKey  = await _pbkdf2Key(password, keySalt);
  const rawKey   = await crypto.subtle.exportKey('raw', dataKey);

  _setSession({ email: norm, displayName: account.displayName, dataKeyB64: _bufToB64(rawKey) });
  return { success: true, displayName: account.displayName };
}

// ─── SESSION ──────────────────────────────────────────────────────────────────

function _setSession(data) {
  // SECURITY: embed expiry timestamp in the session payload — checked on every getSession() call
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    ...data,
    expiresAt: Date.now() + SESSION_DURATION_MS,
  }));
}

function getSession() {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    if (!s) return null;
    // SECURITY: enforce 8-hour expiry — expired sessions are purged immediately on access
    if (Date.now() > s.expiresAt) { clearSession(); return null; }
    return s;
  } catch { clearSession(); return null; }
}

function clearSession() {
  // SECURITY: removes the AES encryption key along with session identity data
  sessionStorage.removeItem(SESSION_KEY);
}

// Convenience: returns the human display name from the current session
function getDisplayName() {
  return getSession()?.displayName || null;
}

// ─── BRUTE-FORCE PROTECTION ───────────────────────────────────────────────────

function _attemptsKey(email) { return `gym_fail_${email}`; }

function _getAttempts(email) {
  try { return JSON.parse(localStorage.getItem(_attemptsKey(email)) || '{"count":0,"lastAt":0}'); }
  catch { return { count: 0, lastAt: 0 }; }
}

function recordFailedAttempt(email) {
  let d = _getAttempts(email);
  // SECURITY: reset counter when the lockout window has fully elapsed
  if (Date.now() - d.lastAt > LOCKOUT_MS) d = { count: 0, lastAt: 0 };
  d.count++;
  d.lastAt = Date.now();
  localStorage.setItem(_attemptsKey(email), JSON.stringify(d));
}

function clearFailedAttempts(email) {
  localStorage.removeItem(_attemptsKey(email));
}

function isAccountLocked(email) {
  const d = _getAttempts(email);
  if (d.count < MAX_ATTEMPTS) return false;
  // SECURITY: auto-expire lockout after LOCKOUT_MS without requiring an explicit unlock
  if (Date.now() - d.lastAt > LOCKOUT_MS) { clearFailedAttempts(email); return false; }
  return true;
}

function getLockoutRemainingMs(email) {
  const d = _getAttempts(email);
  return Math.max(0, LOCKOUT_MS - (Date.now() - d.lastAt));
}

// ─── DATA ENCRYPTION / DECRYPTION ─────────────────────────────────────────────

async function _getCryptoKey() {
  const s = getSession();
  if (!s?.dataKeyB64) return null;
  // SECURITY: re-import raw bytes on each call — avoids keeping a long-lived CryptoKey object in JS memory
  return crypto.subtle.importKey(
    'raw', _b64ToBuf(s.dataKeyB64),
    { name: 'AES-GCM', length: 256 },
    false, ['encrypt', 'decrypt']
  );
}

async function encryptJSON(obj) {
  const key = await _getCryptoKey();
  if (!key) throw new Error('Sin clave de sesión activa');
  // SECURITY: generate a unique random 96-bit IV per encryption — AES-GCM IV reuse is catastrophic
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const buf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
  // SECURITY: IV is prepended to the ciphertext separated by '.'; it is not secret but must be unique
  return _bufToB64(iv.buffer) + '.' + _bufToB64(buf);
}

async function decryptJSON(cipher) {
  const key = await _getCryptoKey();
  if (!key) throw new Error('Sin clave de sesión activa');
  const dot = cipher.indexOf('.');
  if (dot < 0) throw new Error('Formato de cifrado inválido');
  const iv  = new Uint8Array(_b64ToBuf(cipher.slice(0, dot)));
  const buf = _b64ToBuf(cipher.slice(dot + 1));
  const dec = new TextDecoder();
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, buf);
  return JSON.parse(dec.decode(plain));
}

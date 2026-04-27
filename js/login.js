// SECURITY: redirect to tracker immediately if a valid session already exists
if (getCurrentUser()) {
  window.location.href = 'tracker.html';
}

// ─── RENDER ───────────────────────────────────────────────────────────────────

function renderLogin() {
  const card = document.getElementById('login-card');
  // SECURITY: all static HTML — no user data interpolated here
  card.innerHTML = `
    <div class="login-tabs">
      <button class="login-tab login-tab-active" id="tab-login" onclick="switchTab('login')">Iniciar sesión</button>
      <button class="login-tab" id="tab-register" onclick="switchTab('register')">Crear cuenta</button>
    </div>

    <div id="login-form">
      <label class="login-label" for="login-email">Alias</label>
      <input class="login-input" id="login-email" type="text"
             placeholder="Ej: carlos99"
             autocomplete="off" autocapitalize="none" spellcheck="false"
             maxlength="100"/>
      <label class="login-label" for="login-pass" style="margin-top:14px">Contraseña</label>
      <input class="login-input" id="login-pass" type="password"
             placeholder="••••••••"
             autocomplete="off"
             maxlength="128"/>
      <div class="login-error" id="login-error" role="alert" aria-live="polite"></div>
      <button class="login-btn" id="login-submit-btn" onclick="handleLogin()">Entrar al Tracker</button>
    </div>

    <div id="register-form" style="display:none">
      <label class="login-label" for="reg-name">Tu nombre</label>
      <input class="login-input" id="reg-name" type="text"
             placeholder="Ej: Carlos"
             autocomplete="off" autocapitalize="words"
             maxlength="30"/>
      <label class="login-label" for="reg-email" style="margin-top:14px">Alias</label>
      <input class="login-input" id="reg-email" type="text"
             placeholder="Ej: carlos99"
             autocomplete="off" autocapitalize="none" spellcheck="false"
             maxlength="100"/>
      <label class="login-label" for="reg-pass" style="margin-top:14px">Contraseña</label>
      <input class="login-input" id="reg-pass" type="password"
             placeholder="Mínimo 8 caracteres"
             autocomplete="off"
             maxlength="128"
             oninput="updateStrength(this.value)"/>
      <div class="pass-strength-wrap" id="pass-strength-wrap" style="display:none">
        <div class="pass-strength-bar">
          <div class="pass-strength-fill" id="pass-strength-fill"></div>
        </div>
        <span class="pass-strength-label" id="pass-strength-label"></span>
      </div>
      <label class="login-label" for="reg-pass2" style="margin-top:14px">Repetir contraseña</label>
      <input class="login-input" id="reg-pass2" type="password"
             placeholder="Repite la contraseña"
             autocomplete="off"
             maxlength="128"/>
      <div class="login-error" id="register-error" role="alert" aria-live="polite"></div>
      <button class="login-btn" id="register-submit-btn" onclick="handleRegister()">Crear cuenta</button>
    </div>
  `;

  document.getElementById('login-email').focus();
  document.getElementById('login-pass')
    .addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
}

function switchTab(tab) {
  document.getElementById('tab-login').classList.toggle('login-tab-active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('login-tab-active', tab === 'register');
  document.getElementById('login-form').style.display     = tab === 'login'    ? '' : 'none';
  document.getElementById('register-form').style.display  = tab === 'register' ? '' : 'none';
  clearError('login-error');
  clearError('register-error');
  if (tab === 'login')    document.getElementById('login-email').focus();
  if (tab === 'register') document.getElementById('reg-name').focus();
}

// ─── INPUT HELPERS ────────────────────────────────────────────────────────────

// SECURITY: strip ASCII control characters and trim whitespace before processing
function sanitize(value, maxLen) {
  return String(value).replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, maxLen);
}

// Alias: cualquier texto no vacío es válido (validación de vacío ya cubierta arriba)
function isValidEmail() { return true; }

function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) el.textContent = msg;
}
function clearError(id) { showError(id, ''); }

function setLoading(btnId, loading, defaultText) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.textContent = loading ? 'Un momento…' : defaultText;
}

// ─── PASSWORD STRENGTH INDICATOR ─────────────────────────────────────────────

function updateStrength(pw) {
  const wrap  = document.getElementById('pass-strength-wrap');
  const fill  = document.getElementById('pass-strength-fill');
  const label = document.getElementById('pass-strength-label');
  if (!pw) { wrap.style.display = 'none'; return; }
  wrap.style.display = 'flex';

  let score = 0;
  if (pw.length >= 8)  score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  const levels = [
    { pct: 20, color: '#e53935', text: 'Muy débil' },
    { pct: 40, color: '#fb8c00', text: 'Débil' },
    { pct: 60, color: '#fdd835', text: 'Aceptable' },
    { pct: 80, color: '#7cb342', text: 'Fuerte' },
    { pct: 100, color: '#43a047', text: 'Muy fuerte' },
  ];
  const lvl = levels[Math.min(score, 4)];
  fill.style.width      = lvl.pct + '%';
  fill.style.background = lvl.color;
  label.textContent     = lvl.text;
  label.style.color     = lvl.color;
}

// ─── HANDLERS ─────────────────────────────────────────────────────────────────

async function handleLogin() {
  // SECURITY: sanitize email input; do NOT strip password characters (reduces entropy)
  const email    = sanitize(document.getElementById('login-email').value, 100);
  const password = document.getElementById('login-pass').value;

  clearError('login-error');

  if (!email || !password) {
    showError('login-error', 'Por favor completa todos los campos.');
    return;
  }
  if (!isValidEmail(email)) {
    showError('login-error', 'Introduce un email válido.');
    return;
  }

  setLoading('login-submit-btn', true, 'Entrar al Tracker');

  const result = await loginWithCredentials(email, password);

  if (result.success) {
    window.location.href = 'tracker.html';
  } else {
    showError('login-error', result.error);
    // SECURITY: clear the password field after every failed attempt — prevents shoulder-surfing recovery
    document.getElementById('login-pass').value = '';
    document.getElementById('login-pass').focus();
    setLoading('login-submit-btn', false, 'Entrar al Tracker');
  }
}

async function handleRegister() {
  // SECURITY: sanitize all text fields; password is NOT sanitized (preserving full entropy)
  const displayName = sanitize(document.getElementById('reg-name').value, 30);
  const email       = sanitize(document.getElementById('reg-email').value, 100);
  const password    = document.getElementById('reg-pass').value;
  const password2   = document.getElementById('reg-pass2').value;

  clearError('register-error');

  if (!displayName || !email || !password || !password2) {
    showError('register-error', 'Por favor completa todos los campos.');
    return;
  }
  if (!isValidEmail(email)) {
    showError('register-error', 'Introduce un email válido.');
    return;
  }
  // SECURITY: enforce minimum password length — mitigates brute-force risk
  if (password.length < 8) {
    showError('register-error', 'La contraseña debe tener al menos 8 caracteres.');
    return;
  }
  if (password !== password2) {
    showError('register-error', 'Las contraseñas no coinciden.');
    return;
  }

  setLoading('register-submit-btn', true, 'Crear cuenta');

  const result = await registerAccount(email, displayName, password);

  if (!result.success) {
    showError('register-error', result.error);
    setLoading('register-submit-btn', false, 'Crear cuenta');
    return;
  }

  // Auto-login immediately after successful registration
  const loginResult = await loginWithCredentials(email, password);
  if (loginResult.success) {
    window.location.href = 'tracker.html';
  } else {
    showError('register-error', 'Cuenta creada. Por favor inicia sesión.');
    setLoading('register-submit-btn', false, 'Crear cuenta');
    switchTab('login');
    document.getElementById('login-email').value = email;
  }
}

renderLogin();

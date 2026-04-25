// Redirect if already logged in
if (getCurrentUser()) {
  window.location.href = 'tracker.html';
}

function renderLogin() {
  const users = getKnownUsers();
  const card = document.getElementById('login-card');

  let html = `
    <label class="login-label" for="username-input">Tu nombre</label>
    <input class="login-input" id="username-input" type="text" placeholder="Ej: Carlos" autocomplete="off" autocapitalize="words" maxlength="30"/>
    <button class="login-btn" onclick="handleLogin()">Entrar al Tracker</button>
  `;

  if (users.length > 0) {
    html += `<div class="login-divider">o elige un perfil</div><div class="users-list">`;
    users.forEach(u => {
      const initial = u.charAt(0).toUpperCase();
      html += `<button class="user-chip" onclick="quickLogin('${u}')">
        <div class="user-chip-avatar">${initial}</div>
        <span>${u}</span>
      </button>`;
    });
    html += `</div>`;
  }

  card.innerHTML = html;

  const input = document.getElementById('username-input');
  input.addEventListener('keydown', e => { if (e.key === 'Enter') handleLogin(); });
  input.focus();
}

function handleLogin() {
  const input = document.getElementById('username-input');
  const name = input.value.trim();
  if (!name) {
    input.style.borderColor = '#e74c3c';
    input.focus();
    setTimeout(() => { input.style.borderColor = ''; }, 1200);
    return;
  }
  loginAs(name);
}

function quickLogin(name) {
  loginAs(name);
}

function loginAs(name) {
  registerUser(name);
  setCurrentUser(name);
  window.location.href = 'tracker.html';
}

renderLogin();

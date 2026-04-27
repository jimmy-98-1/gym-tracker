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

  // SECURITY: user-controlled names go into a separate container built via DOM, not innerHTML
  if (users.length > 0) {
    html += `<div class="login-divider">o elige un perfil</div><div class="users-list" id="users-list-container"></div>`;
  }

  card.innerHTML = html;

  if (users.length > 0) {
    const container = document.getElementById('users-list-container');
    users.forEach(u => {
      // SECURITY: textContent assignment prevents XSS from malicious usernames
      const btn = document.createElement('button');
      btn.className = 'user-chip';
      btn.onclick = () => quickLogin(u);
      const avatar = document.createElement('div');
      avatar.className = 'user-chip-avatar';
      avatar.textContent = u.charAt(0).toUpperCase(); // SECURITY: textContent, not innerHTML
      const span = document.createElement('span');
      span.textContent = u; // SECURITY: textContent, not innerHTML
      btn.appendChild(avatar);
      btn.appendChild(span);
      container.appendChild(btn);
    });
  }

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

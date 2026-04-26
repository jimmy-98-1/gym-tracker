(function () {
  var STORAGE_KEY = 'gymtracker-theme';

  function applyTheme(dark) {
    document.body.classList.toggle('dark', dark);
    var btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = dark ? '☀️' : '🌙';
  }

  function toggleTheme() {
    var dark = !document.body.classList.contains('dark');
    localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
    applyTheme(dark);
  }

  // Apply saved theme immediately to avoid flash
  var saved = localStorage.getItem(STORAGE_KEY);
  if (saved === 'dark') document.body.classList.add('dark');

  window.toggleTheme = toggleTheme;

  document.addEventListener('DOMContentLoaded', function () {
    applyTheme(document.body.classList.contains('dark'));
  });
})();

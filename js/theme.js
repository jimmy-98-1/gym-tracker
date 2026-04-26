(function () {
  var STORAGE_KEY = 'gymtracker-theme';

  function applyTheme(dark) {
    document.body.classList.toggle('dark', dark);
    var btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = dark ? '☀️' : '🌙';
  }

  function toggleTheme() {
    var dark = !document.body.classList.contains('dark');
    try { localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light'); } catch (e) {}
    applyTheme(dark);
  }

  // Apply saved theme immediately (script is at end of body, DOM is ready)
  var saved;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) {}
  var isDark = saved === 'dark';
  if (isDark) document.body.classList.add('dark');

  window.toggleTheme = toggleTheme;

  // Run once DOM is fully ready (handles both sync and async load timing)
  function init() { applyTheme(document.body.classList.contains('dark')); }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

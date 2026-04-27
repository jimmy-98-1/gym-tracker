// ─── UTILS ───────────────────────────────────────────────────────────────────

const TIMER_STATE_KEY = 'gymTimerState';

function formatTodayDate() {
  return new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}
// Nota: showToast asume que existe un elemento con id="toast" en el DOM.

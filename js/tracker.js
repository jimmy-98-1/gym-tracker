const user = requireUser('index.html');

function formatTodayDate() {
  const now = new Date();
  return now.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

const MOTIVATIONS = [
  '💪 ¡A por ello, {name}!',
  '🔥 ¡Tú puedes, {name}!',
  '⚡ ¡Hoy toca dar el máximo, {name}!',
  '🚀 ¡Vamos allá, {name}!',
  '🏆 ¡Un día más, {name}!',
  '💥 ¡Sin excusas, {name}!',
  '😤 ¡Que no te pare nada, {name}!',
  '🎯 ¡Enfocado y a por ello, {name}!',
  '⚔️ ¡El gym te espera, {name}!',
  '🦾 ¡Modo bestia activado, {name}!',
];

function getDayMotivation(name) {
  const idx = new Date().getDate() % MOTIVATIONS.length;
  return MOTIVATIONS[idx].replace('{name}', name);
}
let currentDay = getTodayKey();
let R = getEffectiveRoutine(user);

// Per-exercise rest overrides: { exId: seconds }
let exRestOverrides = {};
let pickerTargetEx = null; // { id, defaultRest }

// ─── RENDER ───────────────────────────────────────────────────────────────────

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function render() {
  R = getEffectiveRoutine(user);
  const data = loadData(user);
  const wk = getWeekKey();
  if (!data[wk]) { data[wk] = {}; saveData(user, data); }

  const weekNum = getWeekNumber(user);
  document.getElementById('week-badge').textContent = formatTodayDate();

  renderDayNav();
  renderSession(data, wk, weekNum);
}

function renderDayNav() {
  const nav = document.getElementById('day-nav');
  nav.innerHTML = '';
  DAYS.forEach(d => {
    const btn = document.createElement('button');
    const info = R[d];
    btn.className = 'day-pill' + (d === currentDay ? ' active' : info.rest ? ' rest-day' : ' inactive');
    btn.textContent = info.label;
    btn.onclick = () => { currentDay = d; exRestOverrides = {}; render(); };
    nav.appendChild(btn);
  });
}

function renderSession(data, wk, weekNum) {
  const app = document.getElementById('app');
  const info = R[currentDay];
  const dayData = data[wk][currentDay] || {};

  let html = `<div class="session-header">
    <div class="session-day-label">${getDayMotivation(user)}</div>
    <div class="session-title">${info.name}</div>`;

  if (info.rest) {
    html += `</div><div class="cards-wrap"><div class="rest-card">
      <div class="rest-icon">💤</div>
      <div class="rest-title">${info.name}</div>
      <div class="rest-desc">${info.restDesc}</div>
    </div></div>`;
    app.innerHTML = html;
    return;
  }

  const exercises = info.exercises || [];
  if (exercises.length === 0) {
    html += `</div><div class="cards-wrap"><div class="rest-card">
      <div class="rest-icon">📋</div>
      <div class="rest-title">Sin ejercicios</div>
      <div class="rest-desc">Ve a <a href="rutina.html" style="color:#111;font-weight:700">Rutina</a> para añadir ejercicios a este día.</div>
    </div></div>`;
    app.innerHTML = html;
    return;
  }

  const done = exercises.filter(ex => isExDone(ex, dayData)).length;
  const pct = Math.round((done / exercises.length) * 100);

  html += `<div class="session-meta">${info.duration ?? ''} · ${exercises.length} ejercicios</div>
  <div class="progress-wrap">
    <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
    <div class="progress-label"><span>${done} de ${exercises.length} completados</span><span>${pct}%</span></div>
  </div></div><div class="cards-wrap">`;

  const allDone = exercises.every(ex => isExDone(ex, dayData));
  if (allDone) {
    html += `<div class="completed-overlay">
      <div class="co-title">Sesión completada 💪</div>
      <div class="co-sub">Todos los ejercicios registrados.<br>Descansa bien, aquí es donde creces.</div>
    </div><br>`;
  }

  exercises.forEach(ex => {
    const exData = dayData[ex.id] || {};
    const lastSession = getLastSessionData(ex.id, data);
    html += renderExCard(ex, exData, lastSession, isExDone(ex, dayData));
  });

  const isSaved = !!dayData._saved;
  const notes = dayData._notes || '';
  html += `<div class="save-wrap">
    <button class="save-btn${isSaved ? ' saved' : ''}" onclick="saveSession()">
      ${isSaved ? '✓ Sesión guardada' : 'Guardar sesión'}
    </button>
    ${isSaved ? `<button class="edit-session-btn" onclick="unlockSession()">✏️ Editar sesión</button>` : ''}
    ${allDone ? `<button class="share-session-btn" onclick="openShareOverlay()">📤 Compartir sesión</button>` : ''}
  </div>
  <div class="notes-wrap">
    <div class="notes-label">Notas</div>
    <textarea class="notes-input" rows="2" placeholder="¿Cómo fue? Sensaciones, ajustes para la próxima..." onchange="saveNotes(this.value)">${notes.replace(/</g,'&lt;')}</textarea>
  </div></div>`;

  app.innerHTML = html;
}

function renderExCard(ex, exData, lastSession, done) {
  let rows = '';
  for (let i = 0; i < ex.sets; i++) {
    const kg = exData[`s${i}_kg`] || '';
    const rep = exData[`s${i}_rep`] || '';
    const rpe = exData[`s${i}_rpe`] || '';
    const isDone = exData[`s${i}_done`] || false;
    const lastKg = lastSession?.[`s${i}_kg`] || '';
    const lastRep = lastSession?.[`s${i}_rep`] || '';
    const refText = lastKg && lastRep ? `${lastKg}×${lastRep}` : '—';
    rows += `<div class="series-row">
      <span class="s-num">${i + 1}</span>
      <span class="s-ref ${refText === '—' ? 'empty' : ''}">${refText}</span>
      <input class="s-input s-kg${isDone ? ' completed' : ''}" type="text" inputmode="decimal" placeholder="kg" value="${kg}"
        onchange="updateSerie('${ex.id}',${i},'kg',this.value)" ${isDone ? 'readonly' : ''}/>
      <input class="s-input s-rep${isDone ? ' completed' : ''}" type="number" inputmode="numeric" placeholder="rep" value="${rep}"
        onchange="updateSerie('${ex.id}',${i},'rep',this.value)" ${isDone ? 'readonly' : ''}/>
      <input class="s-input s-rpe${isDone ? ' completed' : ''}" type="number" inputmode="numeric" min="1" max="10" placeholder="RPE" value="${rpe}"
        onchange="updateSerie('${ex.id}',${i},'rpe',this.value)" ${!isDone ? 'disabled' : ''}/>
      <div class="s-check${isDone ? ' done' : ''}" onclick="toggleSerie('${ex.id}',${i})">
        <svg width="13" height="13" viewBox="0 0 13 13">
          <path d="M2 6.5l3.5 3.5 5.5-6" stroke="${isDone ? '#fff' : '#ccc'}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
      </div>
    </div>`;
  }

  const noteEsc = (ex.note || '').replace(/'/g, '&#39;');
  const restOverride = exRestOverrides[ex.id];
  const restDisplay = restOverride !== undefined ? formatSeconds(restOverride) : ex.rest;
  const restIsCustom = restOverride !== undefined;
  return `<div class="ex-card${done ? ' done' : ''}">
    <div class="ex-card-header">
      <div class="ex-name">${ex.name}</div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;margin-left:6px;margin-top:1px">
        <button class="ex-info-btn" onclick="showTechnique('${ex.id}','${ex.name.replace(/'/g,"&#39;")}','${noteEsc}')" aria-label="Técnica">💡</button>
        ${done ? '<span class="ex-done-badge">✓</span>' : ''}
      </div>
    </div>
    <div class="ex-meta-chips">
      <span class="meta-chip">🔁 ${ex.sets} series</span>
      <span class="meta-chip">📊 ${ex.reps} reps</span>
      <span class="meta-chip">🎯 RPE ${ex.rpe}</span>
      <button class="meta-chip meta-chip-timer${restIsCustom ? ' custom' : ''}" onclick="openRestPicker('${ex.id}','${ex.rest}')">⏱ ${restDisplay} ▾</button>
    </div>
    <div class="series-header">
      <span class="sh-label">#</span>
      <span class="sh-label" style="text-align:left">Anterior</span>
      <span class="sh-label">kg</span>
      <span class="sh-label">reps</span>
      <span class="sh-label">RPE</span>
      <span class="sh-label"></span>
    </div>
    ${rows}
  </div>`;
}

function updateSerie(exId, setIdx, field, value) {
  const data = loadData(user);
  const wk = getWeekKey();
  if (!data[wk]) data[wk] = {};
  if (!data[wk][currentDay]) data[wk][currentDay] = {};
  if (!data[wk][currentDay][exId]) data[wk][currentDay][exId] = {};
  if (field === 'kg') value = value.replace(',', '.');
  data[wk][currentDay][exId][`s${setIdx}_${field}`] = value;
  saveData(user, data);
}

function toggleSerie(exId, setIdx) {
  const data = loadData(user);
  const wk = getWeekKey();
  if (!data[wk]) data[wk] = {};
  if (!data[wk][currentDay]) data[wk][currentDay] = {};
  if (!data[wk][currentDay][exId]) data[wk][currentDay][exId] = {};
  const exData = data[wk][currentDay][exId];
  const wasDone = exData[`s${setIdx}_done`];
  exData[`s${setIdx}_done`] = !wasDone;
  saveData(user, data);

  if (!wasDone) {
    const ex = R[currentDay]?.exercises?.find(e => e.id === exId);
    if (ex) {
      const secs = exRestOverrides[exId] !== undefined ? exRestOverrides[exId] : parseRestSeconds(ex.rest);
      startTimer(secs, ex.name);
    }
  }

  render();
}

function saveSession() {
  const data = loadData(user);
  const wk = getWeekKey();
  if (!data[wk]) data[wk] = {};
  if (!data[wk][currentDay]) data[wk][currentDay] = {};
  data[wk][currentDay]._saved = true;
  saveData(user, data);
  showToast('Sesión guardada 💪');
  render();
}

function unlockSession() {
  const data = loadData(user);
  const wk = getWeekKey();
  if (data[wk]?.[currentDay]) {
    delete data[wk][currentDay]._saved;
    saveData(user, data);
    render();
  }
}

function saveNotes(value) {
  const data = loadData(user);
  const wk = getWeekKey();
  if (!data[wk]) data[wk] = {};
  if (!data[wk][currentDay]) data[wk][currentDay] = {};
  if (value.trim()) {
    data[wk][currentDay]._notes = value;
  } else {
    delete data[wk][currentDay]._notes;
  }
  saveData(user, data);
}

// ─── REST PICKER ──────────────────────────────────────────────────────────────

const REST_OPTIONS = [
  { label: '30 seg',      secs: 30 },
  { label: '45 seg',      secs: 45 },
  { label: '1 min',       secs: 60 },
  { label: '90 seg',      secs: 90 },
  { label: '2 min',       secs: 120 },
  { label: '3 min',       secs: 180 },
];

function openRestPicker(exId, defaultRestStr) {
  pickerTargetEx = { id: exId, defaultRest: defaultRestStr };
  const current = exRestOverrides[exId];
  const recommended = parseRestSeconds(defaultRestStr);

  const opts = document.getElementById('rest-picker-options');
  let html = `<button class="rest-opt-btn${current === undefined ? ' active' : ''}" onclick="setRestOverride(null)">
    <span class="rest-opt-label">⭐ Recomendado</span>
    <span class="rest-opt-sub">${defaultRestStr}</span>
  </button>`;
  REST_OPTIONS.forEach(o => {
    const isRec = o.secs === recommended;
    html += `<button class="rest-opt-btn${current === o.secs ? ' active' : ''}" onclick="setRestOverride(${o.secs})">
      <span class="rest-opt-label">${o.label}</span>
      ${isRec ? '<span class="rest-opt-sub">recom.</span>' : ''}
    </button>`;
  });
  opts.innerHTML = html;
  document.getElementById('rest-picker-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeRestPicker() {
  document.getElementById('rest-picker-overlay').classList.remove('open');
  document.body.style.overflow = '';
  pickerTargetEx = null;
}

function setRestOverride(secs) {
  if (!pickerTargetEx) return;
  if (secs === null) {
    delete exRestOverrides[pickerTargetEx.id];
  } else {
    exRestOverrides[pickerTargetEx.id] = secs;
  }
  closeRestPicker();
  render();
}

// ─── TIMER ────────────────────────────────────────────────────────────────────

let timerInterval = null;
let timerSeconds = 0;
let timerTotal = 0;
let timerPaused = false;

function parseRestSeconds(restStr) {
  const segMatch = restStr.match(/(\d+)\s*seg/);
  if (segMatch) return parseInt(segMatch[1]);
  const minRange = restStr.match(/(\d+)[–\-](\d+)\s*min/);
  if (minRange) return Math.round((parseInt(minRange[1]) + parseInt(minRange[2])) / 2) * 60;
  const minMatch = restStr.match(/(\d+)\s*min/);
  if (minMatch) return parseInt(minMatch[1]) * 60;
  return 90;
}

function formatSeconds(secs) {
  if (secs < 60) return `${secs} seg`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return s === 0 ? `${m} min` : `${m}:${s.toString().padStart(2,'0')} min`;
}

function startTimer(secsOrStr, exName) {
  clearInterval(timerInterval);
  timerSeconds = typeof secsOrStr === 'number' ? secsOrStr : parseRestSeconds(secsOrStr);
  timerTotal = timerSeconds;
  timerPaused = false;

  document.getElementById('timer-popup-ex').textContent = exName ?? 'Descanso';
  document.getElementById('timer-pause-btn').textContent = '⏸ Pausar';
  const overlay = document.getElementById('timer-popup-overlay');
  overlay.classList.remove('done');
  overlay.classList.add('open');
  updateTimerDisplay();

  timerInterval = setInterval(tickTimer, 1000);
}

function tickTimer() {
  if (timerPaused) return;
  timerSeconds--;
  updateTimerDisplay();
  if (timerSeconds <= 0) {
    clearInterval(timerInterval);
    timerFinished();
  }
}

function updateTimerDisplay() {
  const m = Math.floor(Math.abs(timerSeconds) / 60);
  const s = Math.abs(timerSeconds) % 60;
  document.getElementById('timer-popup-time').textContent = `${m}:${s.toString().padStart(2, '0')}`;
  const pct = timerTotal > 0 ? Math.max(0, timerSeconds / timerTotal) * 100 : 0;
  document.getElementById('timer-popup-fill').style.width = pct + '%';
}

function timerFinished() {
  const overlay = document.getElementById('timer-popup-overlay');
  overlay.classList.add('done');
  document.getElementById('timer-popup-time').textContent = '¡Venga! 💪';
  document.getElementById('timer-popup-fill').style.width = '0%';
  if (navigator.vibrate) navigator.vibrate([200, 100, 300]);
  setTimeout(closeTimer, 3000);
}

function toggleTimerPause() {
  timerPaused = !timerPaused;
  document.getElementById('timer-pause-btn').textContent = timerPaused ? '▶ Reanudar' : '⏸ Pausar';
}

function closeTimer() {
  clearInterval(timerInterval);
  document.getElementById('timer-popup-overlay').classList.remove('open', 'done');
}

// ─── TECHNIQUE ────────────────────────────────────────────────────────────────

function showTechnique(exId, fallbackName, fallbackNote) {
  const catalog = typeof CATALOG_BY_ID !== 'undefined' ? CATALOG_BY_ID[exId] : null;
  document.getElementById('technique-name').textContent = catalog?.name ?? fallbackName;
  document.getElementById('technique-text').textContent = catalog?.note ?? fallbackNote;
  document.getElementById('technique-overlay').classList.add('open');
}

function closeTechnique() {
  document.getElementById('technique-overlay').classList.remove('open');
}

function logout() {
  clearCurrentUser();
  window.location.href = 'index.html';
}

// ─── ONBOARDING ───────────────────────────────────────────────────────────────

function checkOnboarding() {
  if (!isOnboarded(user)) {
    document.getElementById('onboarding-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
  }
}

function closeOnboarding() {
  setOnboarded(user);
  document.getElementById('onboarding-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

// ─── COMPARTIR ────────────────────────────────────────────────────────────────

let shareText = '';

function openShareOverlay() {
  const data = loadData(user);
  const wk = getWeekKey();
  const dayData = data[wk]?.[currentDay] || {};
  const info = R[currentDay];
  const exercises = info.exercises || [];

  let totalSeries = 0, totalVol = 0;
  const exLines = [];

  exercises.forEach(ex => {
    const exData = dayData[ex.id] || {};
    let bestKg = 0, bestRep = 0;
    for (let i = 0; i < ex.sets; i++) {
      if (exData[`s${i}_done`]) {
        totalSeries++;
        const kg = parseFloat(exData[`s${i}_kg`]) || 0;
        const rep = parseInt(exData[`s${i}_rep`]) || 0;
        totalVol += kg * rep;
        if (kg > bestKg) { bestKg = kg; bestRep = rep; }
      }
    }
    if (bestKg > 0) exLines.push({ name: ex.name, kg: bestKg, rep: bestRep });
  });

  const volStr = totalVol >= 1000 ? (totalVol/1000).toFixed(1)+'t' : Math.round(totalVol)+'kg';
  const today = new Date();
  const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  const dateStr = `${today.getDate()} de ${months[today.getMonth()]}`;

  const exChips = exLines.map(e => `<span class="share-card-ex">${e.name} ${e.kg}kg×${e.rep}</span>`).join('');

  document.getElementById('share-card-preview').innerHTML = `
    <div class="share-card-preview">
      <div class="share-card-user">${user} · ${dateStr}</div>
      <div class="share-card-session">${info.name}</div>
      <div class="share-card-stats">
        <div class="share-card-stat"><div class="share-card-stat-val">${totalSeries}</div><div class="share-card-stat-label">Series</div></div>
        <div class="share-card-stat"><div class="share-card-stat-val">${volStr}</div><div class="share-card-stat-label">Volumen</div></div>
        <div class="share-card-stat"><div class="share-card-stat-val">${exercises.length}</div><div class="share-card-stat-label">Ejercicios</div></div>
      </div>
      <div class="share-card-exs">${exChips}</div>
    </div>`;

  shareText = `💪 ${user} · ${info.name} · ${dateStr}\n`
    + `📊 ${totalSeries} series · ${volStr} levantados\n`
    + exLines.map(e => `• ${e.name}: ${e.kg}kg × ${e.rep} reps`).join('\n')
    + `\n\n🏋️ Gym Tracker`;

  document.getElementById('share-native-btn').style.display = navigator.share ? 'block' : 'none';
  document.getElementById('share-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeShareOverlay() {
  document.getElementById('share-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function handleShareOverlayClick(e) {
  if (e.target === document.getElementById('share-overlay')) closeShareOverlay();
}

function shareNative() {
  if (navigator.share) navigator.share({ text: shareText }).catch(() => {});
}

function copyShareText() {
  navigator.clipboard?.writeText(shareText)
    .then(() => showToast('Copiado al portapapeles 📋'))
    .catch(() => showToast('No se pudo copiar'));
}

render();
checkOnboarding();

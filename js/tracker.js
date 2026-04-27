// SECURITY: requireUser validates the session and its 8-hour expiry; redirects to login if invalid
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
  return MOTIVATIONS[idx].replace('{name}', escapeHTML(name)); // SECURITY: escape display name before HTML interpolation
}

let currentDay = getTodayKey();
// SECURITY: R is populated async in render() — never used before first await completes
let R = {};

// Per-exercise rest overrides: { exId: seconds }
let exRestOverrides = {};
let pickerTargetEx = null;

// ─── RENDER ───────────────────────────────────────────────────────────────────

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

async function render() {
  // SECURITY: getEffectiveRoutine decrypts custom routine from localStorage via session key
  R = await getEffectiveRoutine(user);
  const data = await loadData(user); // SECURITY: AES-GCM decrypted with session key
  const wk = getWeekKey();
  if (!data[wk]) { data[wk] = {}; await saveData(user, data); }

  const weekNum = await getWeekNumber(user);
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
  // SECURITY: getDisplayName() returns the human display name; user variable holds email (storage key)
  const displayName = getDisplayName() || '';

  let html = `<div class="session-header">
    <div class="session-day-label">${getDayMotivation(displayName)}</div>
    <div class="session-title">${escapeHTML(info.name)}</div>`; // SECURITY: info.name may be user-renamed

  if (info.rest) {
    html += `</div><div class="cards-wrap"><div class="rest-card">
      <div class="rest-icon">💤</div>
      <div class="rest-title">${escapeHTML(info.name)}</div>
      <div class="rest-desc">${info.restDesc}</div>
    </div></div>`; // SECURITY: escapeHTML on user-renameable day name
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
    <div class="progress-label"><span id="progress-done-label">${done} de ${exercises.length} completados</span><span>${pct}%</span></div>
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
    <textarea class="notes-input" rows="2" placeholder="¿Cómo fue? Sensaciones, ajustes para la próxima..." onchange="saveNotes(this.value)">${escapeHTML(notes)}</textarea>
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
    rows += `<div class="series-row" data-exid="${escapeHTML(ex.id)}" data-setidx="${i}">
      <span class="s-num">${i + 1}</span>
      <span class="s-ref ${refText === '—' ? 'empty' : ''}">${refText}</span>
      <input class="s-input s-kg${isDone ? ' completed' : ''}" type="text" inputmode="decimal" placeholder="kg" value="${escapeHTML(String(kg))}"
        onclick="showPlateCalc(this)"
        onchange="updateSerie('${ex.id}',${i},'kg',this.value)" ${isDone ? 'readonly' : ''}/>
      <input class="s-input s-rep${isDone ? ' completed' : ''}" type="number" inputmode="numeric" placeholder="rep" value="${escapeHTML(String(rep))}"
        onchange="updateSerie('${ex.id}',${i},'rep',this.value)" ${isDone ? 'readonly' : ''}/>
      <input class="s-input s-rpe${isDone ? ' completed' : ''}" type="number" inputmode="numeric" min="1" max="10" placeholder="RPE" value="${escapeHTML(String(rpe))}"
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
      <span class="meta-chip">📊 ${escapeHTML(String(ex.reps))} reps</span>
      <span class="meta-chip">🎯 RPE ${escapeHTML(String(ex.rpe))}</span>
      <button class="meta-chip meta-chip-timer${restIsCustom ? ' custom' : ''}" data-exid="${escapeHTML(ex.id)}" data-rest="${escapeHTML(String(ex.rest))}" onclick="openRestPicker(this.dataset.exid,this.dataset.rest)">⏱ ${escapeHTML(restDisplay)} ▾</button>
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

async function updateSerie(exId, setIdx, field, value) {
  const data = await loadData(user); // SECURITY: decrypt before mutation
  const wk = getWeekKey();
  if (!data[wk]) data[wk] = {};
  if (!data[wk][currentDay]) data[wk][currentDay] = {};
  if (!data[wk][currentDay][exId]) data[wk][currentDay][exId] = {};
  if (field === 'kg') value = value.replace(',', '.');
  data[wk][currentDay][exId][`s${setIdx}_${field}`] = value;
  await saveData(user, data); // SECURITY: encrypt before writing to localStorage
}

let pendingFlash = null;

async function toggleSerie(exId, setIdx) {
  const data = await loadData(user);
  const wk = getWeekKey();
  if (!data[wk]) data[wk] = {};
  if (!data[wk][currentDay]) data[wk][currentDay] = {};
  if (!data[wk][currentDay][exId]) data[wk][currentDay][exId] = {};
  const exData = data[wk][currentDay][exId];
  const wasDone = exData[`s${setIdx}_done`];
  exData[`s${setIdx}_done`] = !wasDone;
  await saveData(user, data);

  if (!wasDone) {
    const currentKg = parseFloat(exData[`s${setIdx}_kg`]) || 0;
    const prDetected = currentKg > 0 && detectPR(exId, currentKg, data, wk);
    pendingFlash = { exId, setIdx, isPR: prDetected };

    const ex = R[currentDay]?.exercises?.find(e => e.id === exId);
    if (ex) {
      const secs = exRestOverrides[exId] !== undefined ? exRestOverrides[exId] : parseRestSeconds(ex.rest);
      startTimer(secs, ex.name);
    }
  } else {
    pendingFlash = null;
  }

  await render();
  applyFlashAnimation();
}

async function saveSession() {
  const data = await loadData(user);
  const wk = getWeekKey();
  if (!data[wk]) data[wk] = {};
  if (!data[wk][currentDay]) data[wk][currentDay] = {};
  data[wk][currentDay]._saved = true;
  await saveData(user, data);
  showToast('Sesión guardada 💪');
  await render();
}

async function unlockSession() {
  const data = await loadData(user);
  const wk = getWeekKey();
  if (data[wk]?.[currentDay]) {
    delete data[wk][currentDay]._saved;
    await saveData(user, data);
    await render();
  }
}

async function saveNotes(value) {
  const data = await loadData(user);
  const wk = getWeekKey();
  if (!data[wk]) data[wk] = {};
  if (!data[wk][currentDay]) data[wk][currentDay] = {};
  if (value.trim()) {
    data[wk][currentDay]._notes = value;
  } else {
    delete data[wk][currentDay]._notes;
  }
  await saveData(user, data);
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

// ─── TIMER (Floating FAB + Web Worker) ────────────────────────────────────────

let timerWorker = null;
let timerTotal = 0;
let timerPaused = false;
let timerCurrentSecs = 0;
let _beepedAt = new Set();
let _audioCtx = null;
let timerFallbackInterval = null;

function initTimerWorker() {
  if (timerWorker) return;
  try {
    timerWorker = new Worker('js/timer-worker.js');
    timerWorker.onmessage = function(e) {
      const { type, seconds } = e.data;
      if (type === 'tick') {
        timerCurrentSecs = seconds;
        updateTimerDisplay(seconds);
        saveTimerState();
        if ([3, 2, 1].includes(seconds) && !_beepedAt.has(seconds)) {
          _beepedAt.add(seconds);
          playBeep();
        }
      } else if (type === 'done') {
        timerFinished();
      }
    };
  } catch(e) {
    console.warn('Web Worker unavailable, using setInterval fallback');
  }
}

function playBeep() {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = _audioCtx.createOscillator();
    const gain = _audioCtx.createGain();
    osc.connect(gain);
    gain.connect(_audioCtx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.25, _audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + 0.25);
    osc.start(_audioCtx.currentTime);
    osc.stop(_audioCtx.currentTime + 0.25);
  } catch(e) {}
}

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
  const secs = typeof secsOrStr === 'number' ? secsOrStr : parseRestSeconds(secsOrStr);
  timerTotal = secs;
  timerPaused = false;
  timerCurrentSecs = secs;
  _beepedAt.clear();

  const fab = document.getElementById('timer-fab');
  document.getElementById('timer-fab-ex').textContent = exName ?? 'Descanso';
  document.getElementById('timer-fab-pause-btn').textContent = '⏸';
  fab.classList.remove('done');
  fab.classList.add('open');
  updateTimerDisplay(secs);
  saveTimerState(exName, secs, false);

  initTimerWorker();
  if (timerWorker) {
    timerWorker.postMessage({ type: 'start', data: { seconds: secs } });
  } else {
    clearInterval(timerFallbackInterval);
    let remaining = secs;
    timerFallbackInterval = setInterval(() => {
      if (timerPaused) return;
      remaining--;
      timerCurrentSecs = remaining;
      updateTimerDisplay(remaining);
      saveTimerState();
      if ([3, 2, 1].includes(remaining) && !_beepedAt.has(remaining)) {
        _beepedAt.add(remaining);
        playBeep();
      }
      if (remaining <= 0) { clearInterval(timerFallbackInterval); timerFinished(); }
    }, 1000);
  }
}

function updateTimerDisplay(secs) {
  const m = Math.floor(Math.abs(secs) / 60);
  const s = Math.abs(secs) % 60;
  document.getElementById('timer-fab-time').textContent = `${m}:${s.toString().padStart(2, '0')}`;
  const pct = timerTotal > 0 ? Math.max(0, secs / timerTotal) * 100 : 0;
  document.getElementById('timer-fab-fill').style.width = pct + '%';
}

function timerFinished() {
  const fab = document.getElementById('timer-fab');
  fab.classList.add('done');
  document.getElementById('timer-fab-time').textContent = '¡Venga! 💪';
  document.getElementById('timer-fab-fill').style.width = '0%';
  if (navigator.vibrate) navigator.vibrate([200, 100, 300]);
  clearTimerState();
  setTimeout(closeTimer, 3000);
}

function toggleTimerPause() {
  timerPaused = !timerPaused;
  document.getElementById('timer-fab-pause-btn').textContent = timerPaused ? '▶' : '⏸';
  if (timerWorker) {
    timerWorker.postMessage({ type: timerPaused ? 'pause' : 'resume' });
  }
  saveTimerState(null, null, timerPaused);
}

function timerAdjust(delta) {
  if (timerWorker) {
    timerWorker.postMessage({ type: 'adjust', data: { delta } });
  } else {
    timerCurrentSecs = Math.max(0, timerCurrentSecs + delta);
    updateTimerDisplay(timerCurrentSecs);
  }
  timerTotal = Math.max(timerTotal, timerCurrentSecs + Math.max(0, delta));
}

function closeTimer() {
  if (timerWorker) timerWorker.postMessage({ type: 'stop' });
  clearInterval(timerFallbackInterval);
  document.getElementById('timer-fab').classList.remove('open', 'done');
  clearTimerState();
}

// ─── TIMER STATE PERSISTENCE (cross-page banner) ──────────────────────────────

function saveTimerState(exName, totalSecs, paused) {
  const fab = document.getElementById('timer-fab');
  if (!fab.classList.contains('open')) return;
  const isPaused = paused ?? timerPaused;
  const state = {
    exName: exName ?? document.getElementById('timer-fab-ex').textContent,
    endTime: isPaused ? null : Date.now() + timerCurrentSecs * 1000,
    pausedRemaining: isPaused ? timerCurrentSecs : null,
    totalSecs: totalSecs ?? timerTotal,
  };
  sessionStorage.setItem('gymTimerState', JSON.stringify(state));
}

function clearTimerState() {
  sessionStorage.removeItem('gymTimerState');
}

// ─── PLATE CALCULATOR ─────────────────────────────────────────────────────────

function calculatePlates(totalKg, barKg = 20) {
  const perSide = (totalKg - barKg) / 2;
  if (perSide < 0) return null;
  const plateTypes = [20, 15, 10, 5, 2.5, 1.25];
  const result = [];
  let rem = perSide;
  for (const p of plateTypes) {
    const count = Math.floor(rem / p + 0.0001);
    if (count > 0) { result.push({ kg: p, count }); rem -= count * p; }
  }
  return { perSide, plates: result };
}

let _plateDismissHandler = null;

function showPlateCalc(inputEl) {
  const val = parseFloat(String(inputEl.value).replace(',', '.'));
  if (!val || val <= 0) { hidePlateCalc(); return; }

  const result = calculatePlates(val);
  const popover = document.getElementById('plate-popover');
  const content = document.getElementById('plate-popover-content');

  if (!result) {
    content.innerHTML = `<div class="pc-note">Peso menor que la barra (20 kg)</div>`;
  } else {
    let html = `<div class="pc-title">${val} kg — Distribución</div>`;
    html += `<div class="pc-row"><span class="pc-label">Barra</span><span class="pc-val">20 kg</span></div>`;
    if (result.plates.length > 0) {
      html += `<div class="pc-divider"></div><div class="pc-label-sm">Cada lado:</div>`;
      result.plates.forEach(p => {
        html += `<div class="pc-row"><span class="pc-label">${p.count} × ${p.kg} kg</span><span class="pc-val">${(p.count * p.kg).toFixed(2).replace(/\.?0+$/, '')} kg</span></div>`;
      });
    } else {
      html += `<div class="pc-note">Solo la barra</div>`;
    }
    content.innerHTML = html;
  }

  const rect = inputEl.getBoundingClientRect();
  const popW = 200;
  let left = rect.left;
  if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
  popover.style.left = left + 'px';
  popover.style.top = (rect.bottom + window.scrollY + 8) + 'px';
  popover.classList.add('open');

  if (_plateDismissHandler) document.removeEventListener('click', _plateDismissHandler);
  _plateDismissHandler = function(e) {
    if (!e.target.closest('#plate-popover') && !e.target.classList.contains('s-kg')) {
      hidePlateCalc();
    }
  };
  setTimeout(() => document.addEventListener('click', _plateDismissHandler), 0);
}

function hidePlateCalc() {
  document.getElementById('plate-popover').classList.remove('open');
  if (_plateDismissHandler) {
    document.removeEventListener('click', _plateDismissHandler);
    _plateDismissHandler = null;
  }
}

// ─── PR DETECTION ─────────────────────────────────────────────────────────────

function detectPR(exId, currentKg, data, currentWk) {
  let bestKg = 0;
  const weeks = Object.keys(data).sort();
  for (const wk of weeks) {
    for (const day of DAYS) {
      if (wk === currentWk && day === currentDay) continue;
      const exData = data[wk]?.[day]?.[exId];
      if (!exData) continue;
      for (let i = 0; i < 20; i++) {
        if (exData[`s${i}_done`] === undefined) break;
        if (exData[`s${i}_done`]) {
          const kg = parseFloat(exData[`s${i}_kg`]) || 0;
          if (kg > bestKg) bestKg = kg;
        }
      }
    }
  }
  return bestKg > 0 && currentKg > bestKg;
}

// ─── SET ANIMATION + CONFETTI ─────────────────────────────────────────────────

function applyFlashAnimation() {
  if (!pendingFlash) return;
  const { exId, setIdx, isPR } = pendingFlash;
  pendingFlash = null;

  const row = document.querySelector(`.series-row[data-exid="${CSS.escape(exId)}"][data-setidx="${setIdx}"]`);
  if (row) {
    row.classList.add('flash-green');
    setTimeout(() => row.classList.remove('flash-green'), 900);
    if (isPR) {
      showToast('¡Nuevo récord personal! 🏆');
      launchConfetti(row);
    }
  }

  const label = document.getElementById('progress-done-label');
  if (label) {
    label.classList.add('bounce-spring');
    setTimeout(() => label.classList.remove('bounce-spring'), 600);
  }
}

function launchConfetti(targetEl) {
  const rect = targetEl.getBoundingClientRect();
  const canvas = document.createElement('canvas');
  canvas.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height + 60}px;pointer-events:none;z-index:500;`;
  canvas.width = rect.width;
  canvas.height = rect.height + 60;
  document.body.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const colors = ['#FF6B35', '#4CAF50', '#2196F3', '#FF9800', '#E91E63', '#FFD700'];
  const particles = Array.from({ length: 35 }, () => ({
    x: Math.random() * rect.width,
    y: rect.height * 0.5,
    vx: (Math.random() - 0.5) * 5,
    vy: -Math.random() * 4 - 2,
    color: colors[Math.floor(Math.random() * colors.length)],
    size: Math.random() * 7 + 3,
    rot: Math.random() * Math.PI * 2,
    rotV: (Math.random() - 0.5) * 0.3,
    life: 1,
  }));

  let frameId;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;
    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.18;
      p.life -= 0.018;
      p.rot += p.rotV;
      if (p.life > 0) {
        alive = true;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillRect(-p.size / 2, -p.size * 0.3, p.size, p.size * 0.6);
        ctx.restore();
      }
    }
    ctx.globalAlpha = 1;
    if (alive) frameId = requestAnimationFrame(draw);
    else canvas.remove();
  }
  draw();
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
  clearCurrentUser(); // SECURITY: clears session and AES key from sessionStorage
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

async function openShareOverlay() {
  const data = await loadData(user); // SECURITY: decrypt workout data for share preview
  const wk = getWeekKey();
  const dayData = data[wk]?.[currentDay] || {};
  const info = R[currentDay];
  const exercises = info.exercises || [];
  // SECURITY: getDisplayName() for display; user (email) is the storage key only
  const displayName = getDisplayName() || '';

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

  // SECURITY: escape user-controlled strings before inserting into innerHTML
  const exChips = exLines.map(e => `<span class="share-card-ex">${escapeHTML(e.name)} ${e.kg}kg×${e.rep}</span>`).join('');

  document.getElementById('share-card-preview').innerHTML = `
    <div class="share-card-preview">
      <div class="share-card-user">${escapeHTML(displayName)} · ${dateStr}</div>
      <div class="share-card-session">${escapeHTML(info.name)}</div>
      <div class="share-card-stats">
        <div class="share-card-stat"><div class="share-card-stat-val">${totalSeries}</div><div class="share-card-stat-label">Series</div></div>
        <div class="share-card-stat"><div class="share-card-stat-val">${volStr}</div><div class="share-card-stat-label">Volumen</div></div>
        <div class="share-card-stat"><div class="share-card-stat-val">${exercises.length}</div><div class="share-card-stat-label">Ejercicios</div></div>
      </div>
      <div class="share-card-exs">${exChips}</div>
    </div>`;

  shareText = `💪 ${displayName} · ${info.name} · ${dateStr}\n`
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

// ─── INIT ─────────────────────────────────────────────────────────────────────

// SECURITY: async IIFE — ensures render() awaits decryption before any DOM writes
(async () => {
  await render();
  checkOnboarding();
})().catch(err => console.error('Tracker init error:', err));

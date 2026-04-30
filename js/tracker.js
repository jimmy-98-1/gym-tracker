// SECURITY: requireUser validates the session and its 8-hour expiry; redirects to login if invalid
const user = requireUser('index.html');

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
let _cachedData = null;
let _editing = false;

// Per-exercise rest overrides: { exId: seconds }
let exRestOverrides = {};
// Per-exercise sets overrides: { exId: number } — temporal, se borra al cambiar de día
let _setsOverrides = {};
let pickerTargetEx = null;

// Id de la rutina de usuario cargada en el día actual (temporal, se borra al cambiar de día)
let _loadedRoutineId = null;
// Cache de las rutinas del usuario para no desencriptar en cada render
let _userRoutinesCache = null;
// Asignaciones persistidas { lun: routineId|null, ... }
let _assignments = {};

async function getUserRoutines() {
  if (_userRoutinesCache !== null) return _userRoutinesCache;
  _userRoutinesCache = await loadUserRoutines(user);
  return _userRoutinesCache;
}

async function loadDataCached(user) {
  if (_cachedData !== null) return _cachedData;
  _cachedData = await loadData(user);
  return _cachedData;
}

async function saveDataAndCache(user, data) {
  _cachedData = data;
  await saveData(user, data);
}

// ─── RENDER ───────────────────────────────────────────────────────────────────

async function render() {
  try {
    _cachedData = null;
    // SECURITY: getEffectiveRoutine decrypts custom routine from localStorage via session key
    R = await getEffectiveRoutine(user);

    // Load persisted assignments on first render
    if (Object.keys(_assignments).length === 0) {
      _assignments = await loadRoutineAssignments(user);
    }

    // Session override takes priority over persisted assignment
    const effectiveRoutineId = _loadedRoutineId ?? _assignments[currentDay] ?? null;
    if (effectiveRoutineId !== null) {
      const routines = await getUserRoutines();
      const routine = routines.find(r => r.id === effectiveRoutineId);
      if (routine) {
        R[currentDay] = { ...R[currentDay], exercises: routine.exercises.map(ex => ({ ...ex })), name: routine.name };
      } else {
        // Routine was deleted — clean up stale references
        if (_loadedRoutineId === effectiveRoutineId) _loadedRoutineId = null;
        if (_assignments[currentDay] === effectiveRoutineId) {
          _assignments[currentDay] = null;
          await saveRoutineAssignments(user, _assignments);
        }
      }
    }

    const data = await loadDataCached(user); // SECURITY: AES-GCM decrypted with session key
    const wk = getWeekKey();
    if (!data[wk]) { data[wk] = {}; await saveDataAndCache(user, data); }

    const weekNum = await getWeekNumber(user);
    document.getElementById('week-badge').textContent = formatTodayDate();

    renderDayNav();
    renderSession(data, wk, weekNum);
    if (sessionStarted()) _tickSessionTimer();
  } catch (err) {
    console.error('render() error:', err);
    const app = document.getElementById('app');
    if (app) app.innerHTML = `<div style="padding:32px 20px;text-align:center;color:var(--text3)">Error al cargar la sesión. Recarga la página.</div>`;
  }
}

function renderDayNav() {
  const nav = document.getElementById('day-nav');
  nav.innerHTML = '';
  DAYS.forEach(d => {
    const btn = document.createElement('button');
    const info = R[d];
    btn.className = 'day-pill' + (d === currentDay ? ' active' : info.rest ? ' rest-day' : ' inactive');
    btn.textContent = info.label;
    btn.onclick = () => { currentDay = d; exRestOverrides = {}; _setsOverrides = {}; _loadedRoutineId = null; render(); };
    nav.appendChild(btn);
  });
}

function renderSession(data, wk, weekNum) {
  const app = document.getElementById('app');
  const info = R[currentDay];
  const dayData = data[wk][currentDay] || {};
  // SECURITY: getDisplayName() returns the human display name; user variable holds email (storage key)
  const displayName = getDisplayName() || '';

  const isTimerActive = sessionStarted();
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
      <button class="load-routine-btn" onclick="openRoutineLoader()" style="margin-top:16px">📋 Cargar rutina</button>
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

  const isSaved = !!dayData._saved;
  const isEditing = _editing;
  const notes = dayData._notes || '';

  exercises.forEach(ex => {
    const exData = dayData[ex.id] || {};
    const lastSession = getLastSessionData(ex.id, data);
    html += renderExCard(ex, exData, lastSession, isExDone(ex, dayData), isSaved, isEditing);
  });

  let saveAreaHtml;
  if (isSaved && !isEditing) {
    saveAreaHtml = `<button class="save-btn saved" onclick="saveSession()">✓ Sesión guardada</button>
      <button class="edit-session-btn" onclick="unlockSession()">✏️ Editar sesión</button>
      ${allDone ? `<button class="share-session-btn" onclick="openShareOverlay()">📤 Compartir sesión</button>` : ''}`;
  } else if (isEditing) {
    saveAreaHtml = `<button class="save-btn" onclick="saveSession()">💾 Guardar cambios</button>
      <button class="edit-session-btn cancel-edit-btn" onclick="cancelEdit()">✕ Cancelar edición</button>`;
  } else if (isTimerActive) {
    saveAreaHtml = `<button class="save-btn finish-btn" onclick="openWorkoutSummary()">🏁 Fin del entreno</button>
      ${allDone ? `<button class="share-session-btn" onclick="openShareOverlay()">📤 Compartir sesión</button>` : ''}`;
  } else {
    const hasAssignment = _loadedRoutineId !== null || (_assignments[currentDay] ?? null) !== null;
    saveAreaHtml = `<button class="start-entreno-btn" onclick="startSessionTimer();render()">▶ Iniciar entreno</button>
    <button class="load-routine-btn" onclick="openRoutineLoader()">📋 Cargar rutina</button>
    ${hasAssignment ? `<button class="clear-assignment-btn" onclick="clearDayAssignment()">✕ Quitar rutina</button>` : ''}
    ${allDone ? `<button class="share-session-btn" onclick="openShareOverlay()">📤 Compartir sesión</button>` : ''}`;
  }

  if (isTimerActive) {
    html = html.replace(
      `<div class="session-title">${escapeHTML(info.name)}</div>`,
      `<div class="session-title">${escapeHTML(info.name)}</div>
      <div class="session-stopwatch-row"><span class="session-stopwatch-icon">⏱</span><span class="session-stopwatch" id="session-stopwatch">00:00</span></div>`
    );
  }

  html += `<div class="save-wrap">${saveAreaHtml}</div>
  <div class="notes-wrap">
    <div class="notes-label">Notas</div>
    <textarea class="notes-input" rows="2" placeholder="¿Cómo fue? Sensaciones, ajustes para la próxima..." onchange="saveNotes(this.value)">${escapeHTML(notes)}</textarea>
  </div></div>`;

  app.innerHTML = html;
}

function renderExCard(ex, exData, lastSession, done, isSaved, isEditing) {
  if (ex.type === 'cardio') return renderCardioCard(ex, exData, done);
  const locked = isSaved && !isEditing;
  const sessionActive = isSessionActive();
  const effectiveSets = _setsOverrides[ex.id] ?? ex.sets;
  let rows = '';
  for (let i = 0; i < effectiveSets; i++) {
    const kg = exData[`s${i}_kg`] || '';
    const rep = exData[`s${i}_rep`] || '';
    const rpe = exData[`s${i}_rpe`] || '';
    const isDone = exData[`s${i}_done`] || false;
    const lastKg = lastSession?.[`s${i}_kg`] || '';
    const lastRep = lastSession?.[`s${i}_rep`] || '';
    const lastKgNum = parseFloat(String(lastKg).replace(',', '.')) || 0;
    const refText = lastRep ? (lastKgNum > 0 ? `${lastKg}×${lastRep}` : `PC×${lastRep}`) : '—';
    const inputRo = (locked || (isDone && !isEditing) || (!sessionActive && !isSaved)) ? 'readonly' : '';
    const inputDis = (!sessionActive && !isSaved) ? 'disabled' : '';
    const rpeRo   = locked ? 'readonly' : '';
    const rpeDis  = (!isDone && !isEditing) ? 'disabled' : (locked ? 'disabled' : '');
    const checkClick = locked ? '' : `onclick="toggleSerie('${ex.id}',${i})"`;
    const checkStyle = (!sessionActive && !isSaved) ? ' style="pointer-events:none;opacity:0.4"' : '';
    rows += `<div class="series-row" data-exid="${escapeHTML(ex.id)}" data-setidx="${i}">
      <span class="s-num">${i + 1}</span>
      <span class="s-ref ${refText === '—' ? 'empty' : ''}">${refText}</span>
      <input class="s-input s-kg${isDone ? ' completed' : ''}" type="text" inputmode="decimal" placeholder="kg" value="${escapeHTML(String(kg))}"
        onclick="showPlateCalc(this)"
        oninput="updateSerie('${ex.id}',${i},'kg',this.value)" onchange="updateSerie('${ex.id}',${i},'kg',this.value)" ${inputRo} ${inputDis}/>
      <input class="s-input s-rep${isDone ? ' completed' : ''}" type="number" inputmode="numeric" placeholder="rep" value="${escapeHTML(String(rep))}"
        oninput="updateSerie('${ex.id}',${i},'rep',this.value)" onchange="updateSerie('${ex.id}',${i},'rep',this.value)" ${inputRo} ${inputDis}/>
      <input class="s-input s-rpe${isDone ? ' completed' : ''}" type="number" inputmode="numeric" min="1" max="10" placeholder="RPE" value="${escapeHTML(String(rpe))}"
        onchange="updateSerie('${ex.id}',${i},'rpe',this.value)" ${rpeDis} ${rpeRo}/>
      <div class="s-check${isDone ? ' done' : ''}${locked ? ' s-check-locked' : ''}" ${checkClick}${checkStyle}>
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
  const cardClick = (!sessionActive && !isSaved) ? `onclick="showToast('Pulsa ▶ Iniciar entreno para empezar')"` : '';
  return `<div class="ex-card${done ? ' done' : ''}" ${cardClick}>
    <div class="ex-card-header">
      <div class="ex-name">${ex.name}</div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;margin-left:6px;margin-top:1px">
        <button class="sets-adj-btn" onclick="adjustSets('${ex.id}',-1);event.stopPropagation()" aria-label="Quitar serie" ${locked ? 'disabled' : ''}>−</button>
        <button class="sets-adj-btn" onclick="adjustSets('${ex.id}',+1);event.stopPropagation()" aria-label="Añadir serie" ${locked ? 'disabled' : ''}>+</button>
        <button class="ex-info-btn" onclick="showTechnique('${ex.id}','${ex.name.replace(/'/g,"&#39;")}','${noteEsc}');event.stopPropagation()" aria-label="Técnica">💡</button>
        ${done ? '<span class="ex-done-badge">✓</span>' : ''}
      </div>
    </div>
    <div class="ex-meta-chips">
      <span class="meta-chip">🔁 ${effectiveSets} series</span>
      <span class="meta-chip">📊 ${escapeHTML(String(ex.reps))} reps</span>
      <span class="meta-chip">🎯 RPE ${escapeHTML(String(ex.rpe))}</span>
      <button class="meta-chip meta-chip-timer${restIsCustom ? ' custom' : ''}" data-exid="${escapeHTML(ex.id)}" data-rest="${escapeHTML(String(ex.rest))}" onclick="openRestPicker(this.dataset.exid,this.dataset.rest);event.stopPropagation()">⏱ ${escapeHTML(restDisplay)} ▾</button>
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
  const data = await loadDataCached(user); // SECURITY: decrypt before mutation
  const wk = getWeekKey();
  if (!data[wk]) data[wk] = {};
  if (!data[wk][currentDay]) data[wk][currentDay] = {};
  if (!data[wk][currentDay][exId]) data[wk][currentDay][exId] = {};
  if (field === 'kg') value = value.replace(',', '.');
  data[wk][currentDay][exId][`s${setIdx}_${field}`] = value;
  await saveDataAndCache(user, data); // SECURITY: encrypt before writing to localStorage
}

function isSessionActive() {
  const data = _cachedData;
  const wk = getWeekKey();
  const isSaved = !!(data?.[wk]?.[currentDay]?._saved);
  return sessionStarted() || isSaved;
}

let pendingFlash = null;

async function toggleSerie(exId, setIdx) {
  if (!isSessionActive()) {
    showToast('Pulsa ▶ Iniciar entreno para empezar');
    return;
  }
  // Flush DOM values before render() destroys the inputs (fixes mobile onchange/blur race)
  const rowEl = document.querySelector(`.series-row[data-exid="${CSS.escape(exId)}"][data-setidx="${setIdx}"]`);
  if (rowEl) {
    const kgInput  = rowEl.querySelector('.s-kg');
    const repInput = rowEl.querySelector('.s-rep');
    const rpeInput = rowEl.querySelector('.s-rpe');
    if (kgInput  && !kgInput.readOnly) await updateSerie(exId, setIdx, 'kg',  kgInput.value.trim());
    if (repInput && repInput.value.trim() !== '') await updateSerie(exId, setIdx, 'rep', repInput.value.trim());
    if (rpeInput && rpeInput.value.trim() !== '' && !rpeInput.disabled) await updateSerie(exId, setIdx, 'rpe', rpeInput.value.trim());
  }

  const data = await loadDataCached(user);
  const wk = getWeekKey();
  if (!data[wk]) data[wk] = {};
  if (!data[wk][currentDay]) data[wk][currentDay] = {};
  if (!data[wk][currentDay][exId]) data[wk][currentDay][exId] = {};
  const exData = data[wk][currentDay][exId];
  const wasDone = exData[`s${setIdx}_done`];
  exData[`s${setIdx}_done`] = !wasDone;
  await saveDataAndCache(user, data);

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
  _editing = false;
  const data = await loadDataCached(user);
  const wk = getWeekKey();
  if (!data[wk]) data[wk] = {};
  if (!data[wk][currentDay]) data[wk][currentDay] = {};
  data[wk][currentDay]._saved = true;
  await saveDataAndCache(user, data);
  _cachedData = null;
  showToast('Sesión guardada 💪');
  await render();
}

async function unlockSession() {
  _editing = true;
  await render();
}

async function cancelEdit() {
  _editing = false;
  _cachedData = null;
  _setsOverrides = {};
  await render();
}

async function saveNotes(value) {
  const data = await loadDataCached(user);
  const wk = getWeekKey();
  if (!data[wk]) data[wk] = {};
  if (!data[wk][currentDay]) data[wk][currentDay] = {};
  if (value.trim()) {
    data[wk][currentDay]._notes = value;
  } else {
    delete data[wk][currentDay]._notes;
  }
  await saveDataAndCache(user, data);
}

// ─── ADJUST SETS (Feature 2 — temporal, no persiste rutina) ──────────────────

async function adjustSets(exId, delta) {
  if (_cachedData) {
    const wk = getWeekKey();
    if (_cachedData[wk]?.[currentDay]?._saved && !_editing) return;
  }
  const ex = R[currentDay]?.exercises?.find(e => e.id === exId);
  if (!ex) return;
  const current = _setsOverrides[exId] ?? ex.sets;
  const next = Math.min(10, Math.max(1, current + delta));
  if (next === current) return;
  if (delta < 0) {
    const data = await loadDataCached(user);
    const wk = getWeekKey();
    const exData = data[wk]?.[currentDay]?.[exId];
    if (exData) {
      delete exData[`s${current - 1}_kg`];
      delete exData[`s${current - 1}_rep`];
      delete exData[`s${current - 1}_rpe`];
      delete exData[`s${current - 1}_done`];
      await saveDataAndCache(user, data);
    }
  }
  _setsOverrides[exId] = next;
  await render();
}

// ─── CARDIO CARD (Feature 3) ──────────────────────────────────────────────────

function renderCardioCard(ex, exData, done) {
  const durVal  = exData._dur  ?? ex.duration_min ?? '';
  const distVal = exData._dist ?? ex.distance_m   ?? '';
  const lvlVal  = exData._lvl  ?? ex.level        ?? '';
  const ro = done ? 'readonly' : '';
  const noteEsc = (ex.note || '').replace(/'/g, '&#39;');
  return `<div class="ex-card cardio-card${done ? ' done' : ''}">
    <div class="ex-card-header">
      <div style="display:flex;align-items:center;gap:8px">
        <span class="cardio-badge">Cardio</span>
        <div class="ex-name">${escapeHTML(ex.name)}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;margin-left:6px">
        <button class="ex-info-btn" onclick="showTechnique('${ex.id}','${ex.name.replace(/'/g,"&#39;")}','${noteEsc}')" aria-label="Técnica">💡</button>
      </div>
    </div>
    <div class="cardio-inputs" data-exid="${escapeHTML(ex.id)}">
      <div class="cardio-field">
        <label class="cardio-label">Tiempo (min)</label>
        <input class="s-input cardio-input" type="number" inputmode="numeric" placeholder="${ex.duration_min}" value="${escapeHTML(String(durVal))}"
          oninput="updateCardio('${ex.id}','_dur',this.value)" onchange="updateCardio('${ex.id}','_dur',this.value)" ${ro}/>
      </div>
      <div class="cardio-field">
        <label class="cardio-label">Distancia (m)</label>
        <input class="s-input cardio-input" type="number" inputmode="numeric" placeholder="${ex.distance_m}" value="${escapeHTML(String(distVal))}"
          oninput="updateCardio('${ex.id}','_dist',this.value)" onchange="updateCardio('${ex.id}','_dist',this.value)" ${ro}/>
      </div>
      <div class="cardio-field">
        <label class="cardio-label">Nivel</label>
        <input class="s-input cardio-input" type="number" inputmode="numeric" min="1" max="20" placeholder="${ex.level}" value="${escapeHTML(String(lvlVal))}"
          oninput="updateCardio('${ex.id}','_lvl',this.value)" onchange="updateCardio('${ex.id}','_lvl',this.value)" ${ro}/>
      </div>
    </div>
    <button class="cardio-done-btn${done ? ' done' : ''}" onclick="toggleCardio('${ex.id}')">
      ${done ? '✓ Completado' : 'Marcar como completado'}
    </button>
  </div>`;
}

async function updateCardio(exId, field, value) {
  const data = await loadDataCached(user);
  const wk = getWeekKey();
  if (!data[wk]) data[wk] = {};
  if (!data[wk][currentDay]) data[wk][currentDay] = {};
  if (!data[wk][currentDay][exId]) data[wk][currentDay][exId] = {};
  data[wk][currentDay][exId][field] = value;
  await saveDataAndCache(user, data);
}

async function toggleCardio(exId) {
  if (!isSessionActive()) {
    showToast('Pulsa ▶ Iniciar entreno para empezar');
    return;
  }
  const cardioEl = document.querySelector(`.cardio-inputs[data-exid="${CSS.escape(exId)}"]`);
  if (cardioEl) {
    const inputs = cardioEl.querySelectorAll('.cardio-input');
    const fields = ['_dur', '_dist', '_lvl'];
    inputs.forEach((inp, i) => {
      if (inp.value.trim() !== '') updateCardio(exId, fields[i], inp.value.trim());
    });
    await new Promise(r => setTimeout(r, 0));
  }
  const data = await loadDataCached(user);
  const wk = getWeekKey();
  if (!data[wk]) data[wk] = {};
  if (!data[wk][currentDay]) data[wk][currentDay] = {};
  if (!data[wk][currentDay][exId]) data[wk][currentDay][exId] = {};
  data[wk][currentDay][exId]._done = !data[wk][currentDay][exId]._done;
  await saveDataAndCache(user, data);
  await render();
}

// ─── SESSION STOPWATCH (Feature 1) ────────────────────────────────────────────

const SESSION_START_KEY = 'gymSessionStart';
let _sessionTickInterval = null;

function sessionStarted() {
  return !!sessionStorage.getItem(SESSION_START_KEY);
}

function startSessionTimer() {
  if (!sessionStorage.getItem(SESSION_START_KEY)) {
    sessionStorage.setItem(SESSION_START_KEY, String(Date.now()));
  }
  _tickSessionTimer();
}

function stopSessionTimer() {
  sessionStorage.removeItem(SESSION_START_KEY);
  clearInterval(_sessionTickInterval);
  _sessionTickInterval = null;
}

function _tickSessionTimer() {
  clearInterval(_sessionTickInterval);
  _updateSessionTimerDisplay();
  _sessionTickInterval = setInterval(_updateSessionTimerDisplay, 1000);
}

function _updateSessionTimerDisplay() {
  const el = document.getElementById('session-stopwatch');
  if (!el) { clearInterval(_sessionTickInterval); return; }
  const start = parseInt(sessionStorage.getItem(SESSION_START_KEY) || '0', 10);
  const elapsed = Math.floor((Date.now() - start) / 1000);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  el.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function _getElapsedStr() {
  const start = parseInt(sessionStorage.getItem(SESSION_START_KEY) || '0', 10);
  if (!start) return '—';
  const elapsed = Math.floor((Date.now() - start) / 1000);
  const m = Math.floor(elapsed / 60);
  const s = elapsed % 60;
  return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function openWorkoutSummary() {
  const data = _cachedData;
  if (!data) return;
  const wk = getWeekKey();
  const dayData = data[wk]?.[currentDay] || {};
  const exercises = R[currentDay]?.exercises || [];

  let totalSeries = 0, totalVol = 0, totalPRs = 0;
  let starEx = null, starVol = 0;

  exercises.forEach(ex => {
    if (ex.type === 'cardio') {
      if (dayData[ex.id]?._done) totalSeries++;
      return;
    }
    const exData = dayData[ex.id] || {};
    const effectiveSets = _setsOverrides[ex.id] ?? ex.sets;
    let exVol = 0;
    for (let i = 0; i < effectiveSets; i++) {
      if (exData[`s${i}_done`]) {
        totalSeries++;
        const kg = parseFloat(exData[`s${i}_kg`]) || 0;
        const rep = parseInt(exData[`s${i}_rep`]) || 0;
        const vol = kg * rep;
        totalVol += vol;
        exVol += vol;
        if (kg > 0 && detectPR(ex.id, kg, data, wk)) totalPRs++;
      }
    }
    if (exVol > starVol) { starVol = exVol; starEx = ex; }
  });

  const volStr = totalVol >= 1000 ? (totalVol / 1000).toFixed(1) + 't' : Math.round(totalVol) + ' kg';
  const durStr = _getElapsedStr();
  const starVolStr = starVol >= 1000 ? (starVol / 1000).toFixed(1) + 't' : Math.round(starVol) + ' kg';

  document.getElementById('ws-dur').textContent   = durStr;
  document.getElementById('ws-series').textContent = totalSeries;
  document.getElementById('ws-vol').textContent    = volStr;
  document.getElementById('ws-prs').textContent    = totalPRs;

  const starEl = document.getElementById('ws-star');
  if (starEx) {
    starEl.innerHTML = `<div class="ws-star-name">${escapeHTML(starEx.name)}</div>
      <div class="ws-star-vol">${starVolStr}</div>
      ${totalPRs > 0 ? '<div class="ws-pr-badge">🔥 ¡Nuevo récord!</div>' : ''}`;
  } else {
    starEl.innerHTML = '<div class="ws-star-name">—</div>';
  }

  document.getElementById('workout-summary-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeWorkoutSummary() {
  document.getElementById('workout-summary-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

async function finishWorkout() {
  closeWorkoutSummary();
  stopSessionTimer();
  await saveSession();
}

function continueWorkout() {
  closeWorkoutSummary();
  startSessionTimer();
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

function generateBeep() {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = _audioCtx.createOscillator();
    const gain = _audioCtx.createGain();
    osc.connect(gain);
    gain.connect(_audioCtx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.4, _audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, _audioCtx.currentTime + 0.3);
    osc.start(_audioCtx.currentTime);
    osc.stop(_audioCtx.currentTime + 0.3);
  } catch(e) {}
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
  const timeEl = document.getElementById('timer-fab-time');
  const fill = document.getElementById('timer-fab-fill');
  timeEl.textContent = `${m}:${s.toString().padStart(2, '0')}`;
  const pct = timerTotal > 0 ? Math.max(0, secs / timerTotal) * 100 : 0;
  fill.style.width = pct + '%';

  if (secs <= 10 && timerTotal > 0) {
    const ratio = secs / 10;
    if (ratio <= 0.3) {
      fill.style.background = '#4CAF50';
      timeEl.style.color = '#4CAF50';
    } else if (ratio <= 0.7) {
      fill.style.background = '#8BC34A';
      timeEl.style.color = '#fff';
    } else {
      fill.style.background = '#FFD700';
      timeEl.style.color = '#fff';
    }
  } else {
    fill.style.background = '';
    timeEl.style.color = '';
  }
}

function timerFinished() {
  generateBeep();
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
  sessionStorage.setItem(TIMER_STATE_KEY, JSON.stringify(state));
}

function clearTimerState() {
  sessionStorage.removeItem(TIMER_STATE_KEY);
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
  const data = await loadDataCached(user); // SECURITY: decrypt workout data for share preview
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

// ─── ROUTINE LOADER ───────────────────────────────────────────────────────────

async function openRoutineLoader() {
  const routines = await getUserRoutines();
  if (!routines || routines.length === 0) {
    showToast('Crea rutinas en la página Rutina primero');
    return;
  }
  renderRoutineLoaderModal(routines);
  document.getElementById('routine-loader-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function renderRoutineLoaderModal(routines) {
  const sheet = document.getElementById('routine-loader-sheet');
  let html = `<div class="picker-header">
    <span class="picker-title">Selecciona una rutina</span>
    <button class="picker-close" onclick="closeRoutineLoader()">✕</button>
  </div>
  <div style="padding:8px 16px 32px;overflow-y:auto;flex:1">`;

  routines.forEach(r => {
    const isLoaded = _loadedRoutineId === r.id;
    const exCount = r.exercises.length;
    const previewNames = r.exercises.slice(0, 3).map(e => escapeHTML(e.name)).join(' · ');
    const countStr = exCount + ' ejercicio' + (exCount !== 1 ? 's' : '');
    const meta = exCount === 0 ? countStr : countStr + ' · ' + previewNames;
    html += `<div class="routine-loader-card${isLoaded ? ' loaded' : ''}" onclick="loadRoutineIntoDay('${r.id}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
        <div class="routine-loader-card-name">${escapeHTML(r.name)}</div>
        ${isLoaded ? '<span class="routine-loaded-badge">Cargada ✓</span>' : ''}
      </div>
      <div class="routine-loader-card-meta">${meta}</div>
    </div>`;
  });

  html += `</div>`;
  sheet.innerHTML = html;
}

async function loadRoutineIntoDay(routineId) {
  const routines = await getUserRoutines();
  const routine = routines ? routines.find(r => r.id === routineId) : null;
  const name = routine ? routine.name : '';
  _loadedRoutineId = routineId;
  _assignments[currentDay] = routineId;
  _userRoutinesCache = null;
  await saveRoutineAssignments(user, _assignments);
  closeRoutineLoader();
  await render();
  if (name) showToast(name + ' cargada ✓');
}

function closeRoutineLoader() {
  document.getElementById('routine-loader-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

async function clearDayAssignment() {
  _assignments[currentDay] = null;
  _loadedRoutineId = null;
  _setsOverrides = {};
  await saveRoutineAssignments(user, _assignments);
  await render();
  showToast('Rutina del día restaurada');
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

// SECURITY: async IIFE — ensures render() awaits decryption before any DOM writes
(async () => {
  await render();
  checkOnboarding();
})().catch(err => console.error('Tracker init error:', err));

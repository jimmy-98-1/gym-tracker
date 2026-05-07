// SECURITY: requireUser validates session expiry; redirects to login if invalid
const user = requireUser('index.html');

let editDays = {};
let openDay = null;
let pickerDay = null;
let pickerFilter = null;
let pickerSearch = '';
let exEditTarget = null;
let userRoutines = [];
let openRoutineId = null;
let routinePickerDay = null;
let exEditRoutineTarget = null;
let weeklyConfigOpen = false;
let myRoutinesOpen = false;

async function init() {
  document.getElementById('week-badge').textContent = formatTodayDate();
  // SECURITY: getEffectiveRoutine decrypts from localStorage via session AES key
  const effective = await getEffectiveRoutine(user);
  DAYS.forEach(d => {
    const info = effective[d];
    editDays[d] = {
      rest: !!info.rest,
      name: info.name || ROUTINE[d].name,
      exercises: (info.exercises || []).map(ex => ({ ...ex })),
    };
  });
  userRoutines = await loadUserRoutines(user);
  renderPage();
}

function toggleWeeklyConfig() {
  weeklyConfigOpen = !weeklyConfigOpen;
  renderPage();
}

function toggleMyRoutines() {
  myRoutinesOpen = !myRoutinesOpen;
  renderUserRoutines();
}

function renderPage() {
  const container = document.getElementById('rutina-container');
  const section = document.getElementById('weekly-config-section');
  const actionsEl = document.getElementById('weekly-config-actions');

  // Collapsible header injected before the days container
  if (section) {
    let headerEl = document.getElementById('weekly-config-header');
    if (!headerEl) {
      headerEl = document.createElement('div');
      headerEl.id = 'weekly-config-header';
      headerEl.className = 'section-collapse-header';
      headerEl.onclick = toggleWeeklyConfig;
      section.insertBefore(headerEl, container);
    }
    headerEl.innerHTML = `<div>
        <div class="bib-section-title-orange">Configuración semanal</div>
        <div class="section-sub">Personaliza los días y ejercicios de tu semana</div>
      </div>
      <span class="rut-chevron section-chevron">${weeklyConfigOpen ? '▲' : '▼'}</span>`;
    container.style.display = weeklyConfigOpen ? '' : 'none';
    if (actionsEl) actionsEl.style.display = weeklyConfigOpen ? '' : 'none';
  }

  let html = '';

  DAYS.forEach(d => {
    const base = ROUTINE[d];
    const day = editDays[d];
    const isOpen = openDay === d;
    const exCount = day.exercises.length;

    html += `<div class="rut-day-card${isOpen && !day.rest ? ' open' : ''}">
      <div class="rut-day-row" onclick="handleDayRowClick('${d}')">
        <div class="rut-day-info">
          <span class="rut-day-label">${base.label}</span>
          <div class="rut-day-name-row">
            <span class="rut-day-name" id="day-name-${d}">${escapeHTML(editDays[d].name)}</span> <!-- SECURITY: escape user-renamed day name -->
            <button class="rut-rename-btn" onclick="startRename(event,'${d}')" title="Renombrar">✏️</button>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <button class="rut-toggle-btn${day.rest ? ' rest' : ' train'}" onclick="toggleRest(event,'${d}')">
            ${day.rest ? '💤 Descanso' : '💪 Entreno'}
          </button>
          ${!day.rest ? `<span class="rut-chevron">${isOpen ? '▲' : '▼'}</span>` : ''}
        </div>
      </div>`;

    if (!day.rest && isOpen) {
      html += `<div class="rut-ex-list">`;
      if (exCount === 0) {
        html += `<div class="rut-empty-day">Sin ejercicios. Añade uno abajo.</div>`;
      } else {
        day.exercises.forEach((ex, idx) => {
          html += `<div class="rut-ex-item">
            <div class="rut-reorder-btns">
              <button class="rut-reorder-btn" onclick="moveEx('${d}',${idx},-1)"${idx === 0 ? ' disabled' : ''}>▲</button>
              <button class="rut-reorder-btn" onclick="moveEx('${d}',${idx},1)"${idx === exCount - 1 ? ' disabled' : ''}>▼</button>
            </div>
            <div class="rut-ex-item-info">
              <div class="rut-ex-item-name">${escapeHTML(ex.name)}</div>
              <div class="rut-ex-item-meta">${ex.sets} series · ${escapeHTML(String(ex.reps))} reps · RPE ${escapeHTML(String(ex.rpe))}</div> <!-- SECURITY: escape reps/rpe — editable by user -->
            </div>
            <button class="rut-edit-btn" onclick="openExEdit('${d}',${idx})" title="Editar">✏️</button>
            <button class="rut-remove-btn" onclick="removeExercise('${d}',${idx})" aria-label="Eliminar">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2l10 10M12 2L2 12" stroke="#c0392b" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>`;
        });
      }
      html += `<button class="rut-add-btn" onclick="openPicker('${d}')">+ Añadir ejercicio</button>
      </div>`;
    }

    html += `</div>`;
  });

  container.innerHTML = html;
  renderUserRoutines();
}

function handleDayRowClick(d) {
  if (editDays[d].rest) return;
  openDay = openDay === d ? null : d;
  renderPage();
}

function toggleRest(e, d) {
  e.stopPropagation();
  editDays[d].rest = !editDays[d].rest;
  if (openDay === d && editDays[d].rest) openDay = null;
  renderPage();
}

function removeExercise(d, idx) {
  editDays[d].exercises.splice(idx, 1);
  renderPage();
}

function moveEx(d, idx, dir) {
  const exs = editDays[d].exercises;
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= exs.length) return;
  [exs[idx], exs[newIdx]] = [exs[newIdx], exs[idx]];
  renderPage();
}

// ─── RENOMBRAR DÍA ────────────────────────────────────────────────────────────

function startRename(e, d) {
  e.stopPropagation();
  const span = document.getElementById('day-name-' + d);
  if (!span || span.querySelector('input')) return;
  const current = editDays[d].name;
  span.innerHTML = `<input class="rut-rename-input" id="rename-input-${d}" type="text" value="${escapeHTML(current)}" maxlength="40"/>`; // SECURITY: full escapeHTML instead of partial quote-only escaping
  const input = document.getElementById('rename-input-' + d);
  input.focus();
  input.select();
  input.addEventListener('keydown', function(ev) {
    if (ev.key === 'Enter') { ev.preventDefault(); applyRename(d, input.value); }
    if (ev.key === 'Escape') { renderPage(); }
  });
  input.addEventListener('blur', function() { applyRename(d, input.value); });
}

async function applyRename(d, value) {
  const trimmed = value.trim();
  if (trimmed) editDays[d].name = trimmed;
  await saveRoutine();
  renderPage();
}

// ─── EDITAR EJERCICIO ─────────────────────────────────────────────────────────

function openExEdit(d, idx) {
  exEditTarget = { d, idx };
  const ex = editDays[d].exercises[idx];
  document.getElementById('ex-edit-name').textContent = ex.name;
  document.getElementById('ex-edit-sets').value = ex.sets;
  document.getElementById('ex-edit-reps').value = ex.reps;
  document.getElementById('ex-edit-rpe').value = ex.rpe;
  document.getElementById('ex-edit-rest').value = ex.rest;
  document.getElementById('ex-edit-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeExEdit() {
  document.getElementById('ex-edit-overlay').classList.remove('open');
  document.body.style.overflow = '';
  exEditTarget = null;
  exEditRoutineTarget = null;
}

function saveExEdit() {
  if (exEditRoutineTarget) {
    saveRoutineExerciseEdit(exEditRoutineTarget.routineId, exEditRoutineTarget.exIdx);
    return;
  }
  if (!exEditTarget) return;
  const { d, idx } = exEditTarget;
  const ex = editDays[d].exercises[idx];
  ex.sets = Math.max(1, parseInt(document.getElementById('ex-edit-sets').value) || ex.sets);
  ex.reps = document.getElementById('ex-edit-reps').value.trim() || ex.reps;
  ex.rpe  = document.getElementById('ex-edit-rpe').value.trim()  || ex.rpe;
  ex.rest = document.getElementById('ex-edit-rest').value.trim() || ex.rest;
  closeExEdit();
  renderPage();
}

function handleExEditOverlayClick(e) {
  if (e.target === document.getElementById('ex-edit-overlay')) closeExEdit();
}

// ─── PICKER ───────────────────────────────────────────────────────────────────

function openPicker(d) {
  pickerDay = d;
  pickerFilter = null;
  pickerSearch = '';
  renderPicker();
  document.getElementById('picker-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('picker-search-input')?.focus(), 80);
}

function closePicker() {
  document.getElementById('picker-overlay').classList.remove('open');
  document.body.style.overflow = '';
  pickerDay = null;
  routinePickerDay = null;
  pickerSearch = '';
}

function setPickerSearch(value) {
  pickerSearch = value;
  renderPicker();
  const inp = document.getElementById('picker-search-input');
  if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
}

function setPickerFilter(group) {
  pickerFilter = pickerFilter === group ? null : group;
  renderPicker();
}

function renderPicker() {
  const groups = Object.keys(EXERCISE_CATALOG);
  const currentExIds = new Set(
    pickerDay && pickerDay.startsWith('rut_')
      ? (userRoutines.find(r => r.id === pickerDay)?.exercises || []).map(e => e.id)
      : (editDays[pickerDay]?.exercises || []).map(e => e.id)
  );
  const searchTerm = pickerSearch.trim();
  const normalize = str => str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  // Search input always visible in its own non-scrollable wrapper
  document.getElementById('picker-search-wrap').innerHTML = `<div class="picker-search-row">
    <span class="picker-search-icon">🔍</span>
    <input class="picker-search-input" id="picker-search-input" type="text" placeholder="Buscar ejercicio..."
      value="${escapeHTML(pickerSearch)}" oninput="setPickerSearch(this.value)" autocomplete="off"/>
  </div>`;

  // Chips only when not searching, in the scrollable chips container
  if (!searchTerm) {
    let chipsHtml = `<div class="picker-chips">
      <button class="picker-chip${!pickerFilter ? ' active' : ''}" onclick="setPickerFilter(null)">Todos</button>`;
    groups.forEach(g => {
      chipsHtml += `<button class="picker-chip${pickerFilter === g ? ' active' : ''}" onclick="setPickerFilter('${g}')">${g}</button>`;
    });
    chipsHtml += `</div>`;
    document.getElementById('picker-chips-wrap').innerHTML = chipsHtml;
  } else {
    document.getElementById('picker-chips-wrap').innerHTML = '';
  }

  // Build list
  const buildItem = (ex) => {
    const added = currentExIds.has(ex.id);
    return `<div class="picker-ex-item${added ? ' added' : ''}" onclick="${added ? '' : `addExercise('${pickerDay}','${ex.id}')`}">
      <div class="picker-ex-info">
        <div class="picker-ex-name">${ex.name}</div>
        <div class="picker-ex-meta">${ex.sets} series · ${ex.reps} reps · RPE ${ex.rpe}</div>
      </div>
      ${added ? '<span class="picker-added-badge">Añadido</span>' : '<span class="picker-add-icon">+</span>'}
    </div>`;
  };

  let listHtml = '';
  if (searchTerm) {
    let hasResults = false;
    Object.entries(EXERCISE_CATALOG).forEach(([group, exercises]) => {
      const matches = exercises.filter(ex => normalize(ex.name).includes(normalize(searchTerm)));
      if (!matches.length) return;
      hasResults = true;
      listHtml += `<div class="picker-group-title">${group}</div>`;
      matches.forEach(ex => { listHtml += buildItem(ex); });
    });
    if (!hasResults) listHtml = `<div class="picker-no-results">No se encontraron ejercicios</div>`;
  } else {
    const filteredGroups = pickerFilter ? { [pickerFilter]: EXERCISE_CATALOG[pickerFilter] } : EXERCISE_CATALOG;
    Object.entries(filteredGroups).forEach(([group, exercises]) => {
      listHtml += `<div class="picker-group-title">${group}</div>`;
      exercises.forEach(ex => { listHtml += buildItem(ex); });
    });
  }
  document.getElementById('picker-list').innerHTML = listHtml;
}

function addExercise(d, exId) {
  if (d && d.startsWith('rut_')) {
    addExerciseToRoutine(d, exId);
    return;
  }
  const ex = CATALOG_BY_ID[exId];
  if (!ex || editDays[d].exercises.find(e => e.id === exId)) return;
  editDays[d].exercises.push({ ...ex });
  renderPicker();
  renderPage();
}

// ─── MIS RUTINAS — LÓGICA ─────────────────────────────────────────────────────

function generateRoutineId() {
  return 'rut_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

async function createNewRoutine() {
  const routine = { id: generateRoutineId(), name: 'Rutina ' + (userRoutines.length + 1), exercises: [] };
  userRoutines.push(routine);
  await saveUserRoutines(user, userRoutines);
  renderUserRoutines();
}

async function deleteRoutine(routineId) {
  if (!confirm('¿Eliminar esta rutina? Esta acción no se puede deshacer.')) return;
  userRoutines = userRoutines.filter(r => r.id !== routineId);
  if (openRoutineId === routineId) openRoutineId = null;
  await saveUserRoutines(user, userRoutines);
  renderUserRoutines();
}

async function renameRoutine(routineId, newName) {
  const trimmed = (newName || '').trim();
  if (!trimmed) { renderUserRoutines(); return; }
  const routine = userRoutines.find(r => r.id === routineId);
  if (routine) routine.name = trimmed;
  await saveUserRoutines(user, userRoutines);
  renderUserRoutines();
}

async function addExerciseToRoutine(routineId, exId) {
  const routine = userRoutines.find(r => r.id === routineId);
  if (!routine) return;
  const ex = CATALOG_BY_ID[exId];
  if (!ex || routine.exercises.find(e => e.id === exId)) return;
  routine.exercises.push({ ...ex });
  await saveUserRoutines(user, userRoutines);
  renderUserRoutines();
  renderPicker();
}

async function removeExerciseFromRoutine(routineId, exIdx) {
  const routine = userRoutines.find(r => r.id === routineId);
  if (!routine) return;
  routine.exercises.splice(exIdx, 1);
  await saveUserRoutines(user, userRoutines);
  renderUserRoutines();
}

async function saveRoutineExerciseEdit(routineId, exIdx) {
  const routine = userRoutines.find(r => r.id === routineId);
  if (!routine) return;
  const ex = routine.exercises[exIdx];
  ex.sets = Math.max(1, parseInt(document.getElementById('ex-edit-sets').value) || ex.sets);
  ex.reps = document.getElementById('ex-edit-reps').value.trim() || ex.reps;
  ex.rpe  = document.getElementById('ex-edit-rpe').value.trim()  || ex.rpe;
  ex.rest = document.getElementById('ex-edit-rest').value.trim() || ex.rest;
  closeExEdit();
  await saveUserRoutines(user, userRoutines);
  renderUserRoutines();
}

// ─── SAVE / CLEAR ─────────────────────────────────────────────────────────────

async function saveRoutine() {
  const customDays = {};
  DAYS.forEach(d => {
    customDays[d] = { rest: editDays[d].rest, name: editDays[d].name, exercises: editDays[d].exercises };
  });
  // SECURITY: saveCustomRoutine encrypts routine data with AES-GCM session key
  await saveCustomRoutine(user, customDays);
  showToast('Rutina guardada ✓');
}

function confirmClear() {
  document.getElementById('confirm-overlay').classList.add('open');
}

function cancelClear() {
  document.getElementById('confirm-overlay').classList.remove('open');
}

async function doClear() {
  DAYS.forEach(d => { editDays[d].exercises = []; });
  // SECURITY: clearCustomRoutine encrypts the cleared state
  await clearCustomRoutine(user);
  cancelClear();
  openDay = null;
  renderPage();
  showToast('Rutina limpiada');
}

function logout() {
  clearCurrentUser(); // SECURITY: removes session and AES key
  window.location.href = 'index.html';
}

document.getElementById('picker-overlay').addEventListener('click', function(e) {
  if (e.target === this) closePicker();
});

// ─── MIS RUTINAS — RENDER ─────────────────────────────────────────────────────

function handleRoutineCardClick(routineId) {
  openRoutineId = openRoutineId === routineId ? null : routineId;
  renderUserRoutines();
}

function startRoutineRename(e, routineId) {
  e.stopPropagation();
  const span = document.getElementById('routine-name-' + routineId);
  if (!span || span.querySelector('input')) return;
  const routine = userRoutines.find(r => r.id === routineId);
  if (!routine) return;
  span.innerHTML = `<input class="rut-rename-input" id="routine-rename-input-${routineId}" type="text" value="${escapeHTML(routine.name)}" maxlength="40"/>`;
  const input = document.getElementById('routine-rename-input-' + routineId);
  input.focus();
  input.select();
  input.addEventListener('keydown', function(ev) {
    if (ev.key === 'Enter') { ev.preventDefault(); renameRoutine(routineId, input.value); }
    if (ev.key === 'Escape') { renderUserRoutines(); }
  });
  input.addEventListener('blur', function() { renameRoutine(routineId, input.value); });
}

function openExEditRoutine(routineId, exIdx) {
  const routine = userRoutines.find(r => r.id === routineId);
  if (!routine) return;
  const ex = routine.exercises[exIdx];
  exEditRoutineTarget = { routineId, exIdx };
  exEditTarget = null;
  document.getElementById('ex-edit-name').textContent = ex.name;
  document.getElementById('ex-edit-sets').value = ex.sets;
  document.getElementById('ex-edit-reps').value = ex.reps;
  document.getElementById('ex-edit-rpe').value = ex.rpe;
  document.getElementById('ex-edit-rest').value = ex.rest;
  document.getElementById('ex-edit-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function openPickerForRoutine(routineId) {
  routinePickerDay = routineId;
  pickerDay = routineId;
  pickerFilter = null;
  pickerSearch = '';
  renderPicker();
  document.getElementById('picker-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('picker-search-input')?.focus(), 80);
}

function renderUserRoutines() {
  const container = document.getElementById('user-routines-container');
  if (!container) return;

  const subText = myRoutinesOpen
    ? (userRoutines.length === 1 ? '1 rutina creada' : `${userRoutines.length} rutinas creadas`)
    : 'Toca para ver tus rutinas personalizadas';

  let html = `<div class="user-routines-section">
    <div class="section-collapse-header" onclick="toggleMyRoutines()">
      <div>
        <div class="bib-section-title-orange">Mis Rutinas</div>
        <div class="section-sub">${subText}</div>
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        ${myRoutinesOpen ? `<button class="new-routine-btn" onclick="event.stopPropagation();createNewRoutine()">+ Nueva rutina</button>` : ''}
        <span class="rut-chevron section-chevron">${myRoutinesOpen ? '▲' : '▼'}</span>
      </div>
    </div>`;

  if (myRoutinesOpen) {
    if (userRoutines.length === 0) {
      html += `<div class="rut-empty-day user-routines-empty">Crea tu primera rutina para usarla en el Tracker.</div>`;
    } else {
      userRoutines.forEach(routine => {
        const isOpen = openRoutineId === routine.id;
        const exCount = routine.exercises.length;
        html += `<div class="rut-day-card${isOpen ? ' open' : ''}">
          <div class="rut-day-row" onclick="handleRoutineCardClick('${routine.id}')">
            <div class="rut-day-info">
              <div class="rut-day-name-row">
                <span class="rut-day-name" id="routine-name-${routine.id}">${escapeHTML(routine.name)}</span>
                <button class="rut-rename-btn" onclick="startRoutineRename(event,'${routine.id}')" title="Renombrar">✏️</button>
              </div>
              <span class="routine-count-label">${exCount} ejercicio${exCount !== 1 ? 's' : ''}</span>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <button class="rut-remove-btn" onclick="event.stopPropagation();deleteRoutine('${routine.id}')" aria-label="Eliminar">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2l10 10M12 2L2 12" stroke="#c0392b" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </button>
              <span class="rut-chevron">${isOpen ? '▲' : '▼'}</span>
            </div>
          </div>`;

        if (isOpen) {
          html += `<div class="rut-ex-list">`;
          if (exCount === 0) {
            html += `<div class="rut-empty-day">Sin ejercicios. Añade uno abajo.</div>`;
          } else {
            routine.exercises.forEach((ex, idx) => {
              html += `<div class="rut-ex-item">
                <div class="rut-ex-item-info">
                  <div class="rut-ex-item-name">${escapeHTML(ex.name)}</div>
                  <div class="rut-ex-item-meta">${ex.sets} series · ${escapeHTML(String(ex.reps))} reps · RPE ${escapeHTML(String(ex.rpe))}</div>
                </div>
                <button class="rut-edit-btn" onclick="openExEditRoutine('${routine.id}',${idx})" title="Editar">✏️</button>
                <button class="rut-remove-btn" onclick="removeExerciseFromRoutine('${routine.id}',${idx})" aria-label="Eliminar">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2 2l10 10M12 2L2 12" stroke="#c0392b" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>`;
            });
          }
          html += `<button class="rut-add-btn" onclick="openPickerForRoutine('${routine.id}')">+ Añadir ejercicio</button>
          </div>`;
        }

        html += `</div>`;
      });
    }
  }

  html += `</div>`;
  container.innerHTML = html;
}

// SECURITY: async init — decrypts routine data before rendering
init().catch(err => console.error('Rutina init error:', err));

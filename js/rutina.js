const user = requireUser('index.html');

let editDays = {};
let openDay = null;
let pickerDay = null;
let pickerFilter = null;
let exEditTarget = null;

function init() {
  document.getElementById('user-label').textContent = user;
  const effective = getEffectiveRoutine(user);
  DAYS.forEach(d => {
    const info = effective[d];
    editDays[d] = {
      rest: !!info.rest,
      name: info.name || ROUTINE[d].name,
      exercises: (info.exercises || []).map(ex => ({ ...ex })),
    };
  });
  renderPage();
}

function renderPage() {
  const container = document.getElementById('rutina-container');
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
            <span class="rut-day-name" id="day-name-${d}">${editDays[d].name}</span>
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
              <div class="rut-ex-item-name">${ex.name}</div>
              <div class="rut-ex-item-meta">${ex.sets} series · ${ex.reps} reps · RPE ${ex.rpe}</div>
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

// ─── RENOMBRAR DÍA ───────────────────────────────────────────────────────────

function startRename(e, d) {
  e.stopPropagation();
  const span = document.getElementById('day-name-' + d);
  if (!span || span.querySelector('input')) return;
  const current = editDays[d].name;
  span.innerHTML = `<input class="rut-rename-input" id="rename-input-${d}" type="text" value="${current.replace(/"/g, '&quot;')}" maxlength="40"/>`;
  const input = document.getElementById('rename-input-' + d);
  input.focus();
  input.select();
  input.addEventListener('keydown', function(ev) {
    if (ev.key === 'Enter') { ev.preventDefault(); applyRename(d, input.value); }
    if (ev.key === 'Escape') { renderPage(); }
  });
  input.addEventListener('blur', function() { applyRename(d, input.value); });
}

function applyRename(d, value) {
  const trimmed = value.trim();
  if (trimmed) editDays[d].name = trimmed;
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
}

function saveExEdit() {
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

// ─── PICKER ──────────────────────────────────────────────────────────────────

function openPicker(d) {
  pickerDay = d;
  pickerFilter = null;
  renderPicker();
  document.getElementById('picker-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePicker() {
  document.getElementById('picker-overlay').classList.remove('open');
  document.body.style.overflow = '';
  pickerDay = null;
}

function setPickerFilter(group) {
  pickerFilter = pickerFilter === group ? null : group;
  renderPicker();
}

function renderPicker() {
  const groups = Object.keys(EXERCISE_CATALOG);
  const currentExIds = new Set((editDays[pickerDay]?.exercises || []).map(e => e.id));

  let chipsHtml = `<button class="picker-chip${!pickerFilter ? ' active' : ''}" onclick="setPickerFilter(null)">Todos</button>`;
  groups.forEach(g => {
    chipsHtml += `<button class="picker-chip${pickerFilter === g ? ' active' : ''}" onclick="setPickerFilter('${g}')">${g}</button>`;
  });
  document.getElementById('picker-chips').innerHTML = chipsHtml;

  const filteredGroups = pickerFilter ? { [pickerFilter]: EXERCISE_CATALOG[pickerFilter] } : EXERCISE_CATALOG;
  let listHtml = '';
  Object.entries(filteredGroups).forEach(([group, exercises]) => {
    listHtml += `<div class="picker-group-title">${group}</div>`;
    exercises.forEach(ex => {
      const added = currentExIds.has(ex.id);
      listHtml += `<div class="picker-ex-item${added ? ' added' : ''}" onclick="${added ? '' : `addExercise('${pickerDay}','${ex.id}')`}">
        <div class="picker-ex-info">
          <div class="picker-ex-name">${ex.name}</div>
          <div class="picker-ex-meta">${ex.sets} series · ${ex.reps} reps · RPE ${ex.rpe}</div>
        </div>
        ${added ? '<span class="picker-added-badge">Añadido</span>' : '<span class="picker-add-icon">+</span>'}
      </div>`;
    });
  });
  document.getElementById('picker-list').innerHTML = listHtml;
}

function addExercise(d, exId) {
  const ex = CATALOG_BY_ID[exId];
  if (!ex || editDays[d].exercises.find(e => e.id === exId)) return;
  editDays[d].exercises.push({ ...ex });
  renderPicker();
  renderPage();
}

// ─── SAVE / CLEAR ─────────────────────────────────────────────────────────────

function saveRoutine() {
  const customDays = {};
  DAYS.forEach(d => {
    customDays[d] = { rest: editDays[d].rest, name: editDays[d].name, exercises: editDays[d].exercises };
  });
  saveCustomRoutine(user, customDays);
  showRutinaToast('Rutina guardada ✓');
}

function confirmClear() {
  document.getElementById('confirm-overlay').classList.add('open');
}

function cancelClear() {
  document.getElementById('confirm-overlay').classList.remove('open');
}

function doClear() {
  DAYS.forEach(d => { editDays[d].exercises = []; });
  clearCustomRoutine(user);
  cancelClear();
  openDay = null;
  renderPage();
  showRutinaToast('Rutina limpiada');
}

function showRutinaToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

function logout() {
  clearCurrentUser();
  window.location.href = 'index.html';
}

document.getElementById('picker-overlay').addEventListener('click', function(e) {
  if (e.target === this) closePicker();
});

init();

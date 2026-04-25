const user = requireUser('index.html');

let calYear, calMonth;

function render() {
  document.getElementById('user-label').textContent = user;
  const now = new Date();
  if (calYear === undefined) { calYear = now.getFullYear(); calMonth = now.getMonth(); }

  const data = loadData(user);
  const weeks = Object.keys(data).sort().reverse();
  const stats = calcStats(data, weeks);

  document.getElementById('bib-sub').textContent =
    stats.totalDays > 0 ? `${stats.totalDays} días entrenados en total` : 'Aún sin sesiones registradas';

  renderCalendar(data);
  renderSideStats(stats);
  renderMuscleVolume(data);
  renderProgression(data);
}

// ─── STATS ────────────────────────────────────────────────────────────────────

function calcStats(data, weeks) {
  let totalDays = 0;
  let totalSeries = 0;
  let totalKg = 0;
  let currentStreak = 0;
  let bestWeekSessions = 0;

  const today = new Date();
  let checkDate = new Date(today);
  let streakRunning = true;
  for (let i = 0; i < 90 && streakRunning; i++) {
    const d = new Date(checkDate);
    d.setDate(d.getDate() - i);
    const wk = getWeekKeyFromDate(d);
    const dayKey = getDayKeyFromDate(d);
    if (ROUTINE[dayKey]?.rest) continue;
    const dayData = data[wk]?.[dayKey];
    if (dayData?._saved || hasDoneData(dayData)) {
      currentStreak++;
    } else if (i > 0) {
      streakRunning = false;
    }
  }

  weeks.forEach(wk => {
    let weekSessions = 0;
    DAYS.forEach(day => {
      const dayData = data[wk]?.[day];
      if (!dayData || ROUTINE[day]?.rest) return;
      if (!hasDoneData(dayData)) return;
      totalDays++;
      weekSessions++;
      Object.entries(dayData).forEach(([k, v]) => {
        if (k === '_saved' || k === '_notes' || typeof v !== 'object') return;
        Object.entries(v).forEach(([sk, sv]) => {
          if (!sk.endsWith('_done') || !sv) return;
          totalSeries++;
          const setIdx = sk.replace('_done', '');
          const kg = parseFloat(v[`${setIdx}_kg`]) || 0;
          const rep = parseInt(v[`${setIdx}_rep`]) || 0;
          totalKg += kg * rep;
        });
      });
    });
    if (weekSessions > bestWeekSessions) bestWeekSessions = weekSessions;
  });

  return { totalDays, totalSeries, totalKg: Math.round(totalKg), currentStreak, bestWeekSessions, weeks: weeks.length };
}

function hasDoneData(dayData) {
  if (!dayData) return false;
  return Object.entries(dayData).some(([k, v]) =>
    k !== '_saved' && k !== '_notes' && typeof v === 'object' &&
    Object.entries(v).some(([sk, sv]) => sk.endsWith('_done') && sv)
  );
}

function funComparison(kg) {
  if (kg <= 0) return null;
  const refs = [
    { name: 'coches', kg: 1400, emoji: '🚗' },
    { name: 'elefantes', kg: 5000, emoji: '🐘' },
    { name: 'vacas', kg: 600, emoji: '🐄' },
    { name: 'neveras', kg: 80, emoji: '🧊' },
  ];
  for (const ref of refs) {
    const n = kg / ref.kg;
    if (n >= 0.5) {
      const val = n >= 10 ? Math.round(n) : n.toFixed(1).replace('.0', '');
      return `${ref.emoji} ${val} ${ref.name}`;
    }
  }
  return `🏋️ ${kg} kg`;
}

function renderSideStats(s) {
  const comparison = funComparison(s.totalKg);
  document.getElementById('side-stats').innerHTML = `
    <div class="sstat-card">
      <div class="sstat-icon">🗓</div>
      <div class="sstat-val">${s.totalDays}</div>
      <div class="sstat-label">Días entrenados</div>
    </div>
    <div class="sstat-card">
      <div class="sstat-icon">🔥</div>
      <div class="sstat-val">${s.currentStreak}</div>
      <div class="sstat-label">Racha actual</div>
    </div>
    <div class="sstat-card">
      <div class="sstat-icon">⚖️</div>
      <div class="sstat-val">${s.totalKg > 0 ? (s.totalKg >= 1000 ? (s.totalKg/1000).toFixed(1)+'t' : s.totalKg+'kg') : '—'}</div>
      <div class="sstat-label">Peso total</div>
    </div>
    ${comparison ? `<div class="sstat-card sstat-fun">
      <div class="sstat-fun-text">Has levantado</div>
      <div class="sstat-fun-val">${comparison}</div>
    </div>` : `<div class="sstat-card">
      <div class="sstat-icon">🏆</div>
      <div class="sstat-val">${s.bestWeekSessions}</div>
      <div class="sstat-label">Mejor semana</div>
    </div>`}
  `;
}

// ─── CALENDAR ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MONTH_NAMES_LONG = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];

function calPrev() { calMonth--; if (calMonth < 0) { calMonth = 11; calYear--; } render(); }
function calNext() { calMonth++; if (calMonth > 11) { calMonth = 0; calYear++; } render(); }

function getWeekKeyFromDate(date) {
  const start = new Date(date.getFullYear(), 0, 1);
  const week = Math.ceil(((date - start) / 86400000 + start.getDay() + 1) / 7);
  return `${date.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function getDayKeyFromDate(date) {
  return DAYS[date.getDay() === 0 ? 6 : date.getDay() - 1];
}

function getDayStatus(date, data) {
  const wk = getWeekKeyFromDate(date);
  const dayKey = getDayKeyFromDate(date);
  if (ROUTINE[dayKey]?.rest) return 'rest';
  const dayData = data[wk]?.[dayKey];
  if (!dayData) return 'empty';
  if (dayData._saved) return 'complete';
  if (hasDoneData(dayData)) return 'partial';
  return 'empty';
}

function renderCalendar(data) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  document.getElementById('cal-month-label').textContent = `${MONTH_NAMES[calMonth]} ${calYear}`;

  const firstDay = new Date(calYear, calMonth, 1);
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  let html = '';
  for (let i = 0; i < startOffset; i++) html += `<div class="cal-cell"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(calYear, calMonth, d);
    const isToday = date.getTime() === today.getTime();
    const isFuture = date > today;
    const status = isFuture ? 'future' : getDayStatus(date, data);
    const tappable = !isFuture && (status === 'complete' || status === 'partial');

    let inner = `<span class="cal-day-num">${d}</span>`;
    if (status === 'complete') inner = `<span class="cal-day-num">${d}</span><span class="cal-check">✓</span>`;
    else if (status === 'partial') inner = `<span class="cal-day-num">${d}</span><span class="cal-dot-sm partial"></span>`;

    const clickAttr = tappable ? ` onclick="openDayDetail(${calYear},${calMonth},${d})"` : '';
    html += `<div class="cal-cell cal-${status}${isToday ? ' cal-today' : ''}${tappable ? ' cal-tappable' : ''}"${clickAttr}>${inner}</div>`;
  }

  document.getElementById('cal-grid').innerHTML = html;
}

// ─── DAY DETAIL ───────────────────────────────────────────────────────────────

const DAY_LABELS_LONG = { lun:'Lunes', mar:'Martes', mie:'Miércoles', jue:'Jueves', vie:'Viernes', sab:'Sábado', dom:'Domingo' };

function getAllPRs(data) {
  const prs = {};
  Object.values(data).forEach(weekData => {
    if (typeof weekData !== 'object') return;
    Object.values(weekData).forEach(dayData => {
      if (typeof dayData !== 'object') return;
      Object.entries(dayData).forEach(([exId, exData]) => {
        if (exId.startsWith('_') || typeof exData !== 'object') return;
        Object.entries(exData).forEach(([sk, sv]) => {
          if (!sk.endsWith('_done') || !sv) return;
          const idx = sk.replace('_done', '');
          const kg = parseFloat(exData[`${idx}_kg`]) || 0;
          const rep = parseInt(exData[`${idx}_rep`]) || 0;
          if (kg > 0 && rep > 0) {
            const orm = Math.round(kg * (1 + rep / 30));
            if (!prs[exId] || orm > prs[exId]) prs[exId] = orm;
          }
        });
      });
    });
  });
  return prs;
}

function getExName(exId) {
  if (typeof CATALOG_BY_ID !== 'undefined' && CATALOG_BY_ID[exId]) return CATALOG_BY_ID[exId].name;
  const R = getEffectiveRoutine(user);
  for (const d of DAYS) {
    const ex = (R[d].exercises || []).find(e => e.id === exId);
    if (ex) return ex.name;
  }
  return exId;
}

function openDayDetail(y, m, d) {
  const date = new Date(y, m, d);
  const wk = getWeekKeyFromDate(date);
  const dayKey = getDayKeyFromDate(date);
  const data = loadData(user);
  const dayData = data[wk]?.[dayKey];

  if (!dayData || (!hasDoneData(dayData) && !dayData._saved)) return;

  const R = getEffectiveRoutine(user);
  const info = R[dayKey];
  const exercises = info?.exercises || [];
  const allPRs = getAllPRs(data);

  document.getElementById('dd-title').textContent = `${DAY_LABELS_LONG[dayKey]} · ${info.name}`;
  document.getElementById('dd-meta').textContent = `${d} de ${MONTH_NAMES_LONG[m]} de ${y}`;

  let totalVol = 0, totalSeriesDone = 0, exDoneCount = 0;
  let exBlocksHtml = '';

  exercises.forEach(ex => {
    const exData = dayData[ex.id];
    if (!exData) return;

    let sets = [];
    let anyDone = false;
    for (let i = 0; i < ex.sets; i++) {
      if (exData[`s${i}_done`]) {
        anyDone = true;
        const kg = parseFloat(exData[`s${i}_kg`]) || 0;
        const rep = parseInt(exData[`s${i}_rep`]) || 0;
        const orm = (kg > 0 && rep > 0) ? Math.round(kg * (1 + rep / 30)) : null;
        const isPR = orm !== null && allPRs[ex.id] && orm >= allPRs[ex.id];
        sets.push({ num: i + 1, kg, rep, orm, isPR });
        totalVol += kg * rep;
        totalSeriesDone++;
      }
    }
    if (!anyDone) return;

    const allSets = Array.from({length: ex.sets}, (_, i) => exData[`s${i}_done`]);
    if (allSets.every(Boolean)) exDoneCount++;

    const dayVol = sets.reduce((a, s) => a + s.kg * s.rep, 0);
    const setsHtml = sets.map(s =>
      `<div class="dd-set-row">
        <span class="dd-set-num">${s.num}</span>
        <span class="dd-set-val">${s.kg > 0 ? s.kg + ' kg × ' + s.rep : '— × ' + s.rep}</span>
        ${s.orm ? `<span class="dd-set-1rm">~${s.orm} 1RM</span>` : ''}
        ${s.isPR ? '<span class="dd-pr-badge">🏆 PR</span>' : ''}
      </div>`
    ).join('');

    exBlocksHtml += `<div class="dd-ex-block">
      <div class="dd-ex-name">${ex.name}</div>
      <div class="dd-ex-sets">${setsHtml}</div>
      ${dayVol > 0 ? `<div class="dd-volume">Vol: ${Math.round(dayVol)} kg</div>` : ''}
    </div>`;
  });

  const summaryHtml = `<div class="dd-summary">
    <div class="dd-sum-item">
      <div class="dd-sum-val">${totalSeriesDone}</div>
      <div class="dd-sum-label">Series</div>
    </div>
    <div class="dd-sum-item">
      <div class="dd-sum-val">${totalVol >= 1000 ? (totalVol/1000).toFixed(1)+'t' : Math.round(totalVol)+'kg'}</div>
      <div class="dd-sum-label">Volumen</div>
    </div>
    <div class="dd-sum-item">
      <div class="dd-sum-val">${exDoneCount}/${exercises.length}</div>
      <div class="dd-sum-label">Ejercicios</div>
    </div>
  </div>`;

  const notesHtml = dayData._notes
    ? `<div class="dd-notes-block">
        <div class="dd-notes-label">Notas</div>
        <div class="dd-notes-text">${dayData._notes.replace(/</g,'&lt;')}</div>
      </div>`
    : '';

  document.getElementById('dd-body').innerHTML = summaryHtml + exBlocksHtml + notesHtml;
  document.getElementById('day-detail-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeDayDetail() {
  document.getElementById('day-detail-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function handleDetailOverlayClick(e) {
  if (e.target === document.getElementById('day-detail-overlay')) closeDayDetail();
}

// ─── PROGRESIÓN ───────────────────────────────────────────────────────────────

function renderProgression(data) {
  const exerciseHistory = {};

  const allWeeks = Object.keys(data).sort();
  allWeeks.forEach(wk => {
    DAYS.forEach(day => {
      const dayData = data[wk]?.[day];
      if (!dayData) return;
      Object.entries(dayData).forEach(([exId, exData]) => {
        if (exId.startsWith('_') || typeof exData !== 'object') return;
        let maxKg = 0;
        let maxOrm = 0;
        Object.entries(exData).forEach(([sk, sv]) => {
          if (!sk.endsWith('_done') || !sv) return;
          const idx = sk.replace('_done', '');
          const kg = parseFloat(exData[`${idx}_kg`]) || 0;
          const rep = parseInt(exData[`${idx}_rep`]) || 0;
          if (kg > maxKg) maxKg = kg;
          if (kg > 0 && rep > 0) {
            const orm = kg * (1 + rep / 30);
            if (orm > maxOrm) maxOrm = orm;
          }
        });
        if (maxKg > 0) {
          if (!exerciseHistory[exId]) exerciseHistory[exId] = [];
          exerciseHistory[exId].push({ wk, day, maxKg, maxOrm: Math.round(maxOrm) });
        }
      });
    });
  });

  const qualified = Object.entries(exerciseHistory)
    .filter(([, hist]) => hist.length >= 2)
    .sort(([, a], [, b]) => {
      const lastA = a[a.length - 1].wk + a[a.length - 1].day;
      const lastB = b[b.length - 1].wk + b[b.length - 1].day;
      return lastB.localeCompare(lastA);
    })
    .slice(0, 6);

  if (qualified.length === 0) {
    document.getElementById('prog-section').innerHTML = '';
    return;
  }

  const allPRs = getAllPRs(data);
  let html = `<div class="prog-section-title">Progresión</div>`;

  qualified.forEach(([exId, hist]) => {
    const last6 = hist.slice(-6);
    const maxVal = Math.max(...last6.map(h => h.maxKg));
    const latest = last6[last6.length - 1];
    const prev = last6[last6.length - 2];
    const trendDir = latest.maxKg > prev.maxKg ? 'up' : latest.maxKg < prev.maxKg ? 'down' : 'eq';
    const trendIcon = trendDir === 'up' ? '↑' : trendDir === 'down' ? '↓' : '–';
    const isPR = allPRs[exId] && latest.maxOrm >= allPRs[exId];
    const exName = getExName(exId);

    const barsHtml = last6.map((h, i) => {
      const pct = maxVal > 0 ? (h.maxKg / maxVal) * 100 : 0;
      const barH = Math.max(Math.round(pct * 0.36), 4);
      const isLatest = i === last6.length - 1;
      return `<div class="prog-bar-wrap">
        <div class="prog-bar${isLatest ? ' latest' : ''}" style="height:${barH}px"></div>
        <div class="prog-bar-label">${h.maxKg}</div>
      </div>`;
    }).join('');

    html += `<div class="prog-card">
      <div class="prog-ex-name">${exName}</div>
      <div class="prog-bars">${barsHtml}</div>
      <div class="prog-footer">
        <div>
          <span class="prog-best">${latest.maxKg} kg</span>
          ${latest.maxOrm > 0 ? `<span class="prog-1rm"> · ~${latest.maxOrm} 1RM est.</span>` : ''}
        </div>
        <div class="prog-right">
          ${isPR ? '<span class="prog-pr">🏆 PR</span>' : ''}
          <span class="prog-trend ${trendDir}">${trendIcon}</span>
        </div>
      </div>
    </div>`;
  });

  document.getElementById('prog-section').innerHTML = html;
}

// ─── VOLUMEN MUSCULAR ─────────────────────────────────────────────────────────

function buildExGroupMap() {
  const map = {};
  if (typeof EXERCISE_CATALOG === 'undefined') return map;
  Object.entries(EXERCISE_CATALOG).forEach(([group, exs]) => {
    exs.forEach(ex => { map[ex.id] = group; });
  });
  return map;
}

function renderMuscleVolume(data) {
  const wk = getWeekKey();
  const weekData = data[wk] || {};
  const groupMap = buildExGroupMap();
  const volume = {};

  DAYS.forEach(day => {
    const dayData = weekData[day];
    if (!dayData) return;
    Object.entries(dayData).forEach(([exId, exData]) => {
      if (exId.startsWith('_') || typeof exData !== 'object') return;
      const group = groupMap[exId];
      if (!group) return;
      Object.entries(exData).forEach(([sk, sv]) => {
        if (sk.endsWith('_done') && sv) volume[group] = (volume[group] || 0) + 1;
      });
    });
  });

  const entries = Object.entries(volume).sort(([,a],[,b]) => b - a);
  if (entries.length === 0) { document.getElementById('muscle-section').innerHTML = ''; return; }

  const max = Math.max(...entries.map(([,v]) => v));
  const COLOR_THRESHOLDS = [
    { min: 10, color: '#E53935' },
    { min: 6,  color: 'var(--orange)' },
    { min: 3,  color: 'var(--gold)' },
    { min: 0,  color: '#ccc' },
  ];

  let rows = entries.map(([group, sets]) => {
    const pct = Math.round((sets / max) * 100);
    const color = COLOR_THRESHOLDS.find(t => sets >= t.min)?.color || '#ccc';
    const label = sets >= 10 ? `${sets} · alto` : sets >= 6 ? `${sets} · óptimo` : sets >= 3 ? `${sets} · bajo` : `${sets} · poco`;
    return `<div class="muscle-row">
      <div class="muscle-name">${group}</div>
      <div class="muscle-bar-wrap"><div class="muscle-bar" style="width:${pct}%;background:${color}"></div></div>
      <div class="muscle-sets">${label}</div>
    </div>`;
  }).join('');

  document.getElementById('muscle-section').innerHTML = `
    <div class="muscle-section-title">Volumen esta semana</div>
    <div class="muscle-card">${rows}</div>`;
}

// ─── MISC ─────────────────────────────────────────────────────────────────────

function logout() {
  clearCurrentUser();
  window.location.href = 'index.html';
}

render();

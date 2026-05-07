// SECURITY: requireUser validates session expiry; redirects to login if invalid
const user = requireUser('index.html');

let calYear, calMonth;
// SECURITY: module-level cache for effective routine — populated async at render time, used sync in helpers
let _libRoutine = null;
let _libData = null;
let _selectedProgressionExId = null;
let _activeStatsTab = 'volumen'; // 'volumen' | 'progresion' | 'records'

async function render() {
  document.getElementById('week-badge').textContent = formatTodayDate();
  const now = new Date();
  if (calYear === undefined) { calYear = now.getFullYear(); calMonth = now.getMonth(); }

  // SECURITY: loadData and getEffectiveRoutine both decrypt from localStorage via session key
  const data = await loadData(user);
  _libRoutine = await getEffectiveRoutine(user);
  const weeks = Object.keys(data).sort().reverse();
  const schedule = await loadTrainingSchedule(user);
  const stats = calcStats(data, weeks, schedule);

  document.getElementById('bib-sub').textContent =
    stats.totalDays > 0 ? `${stats.totalDays} días entrenados en total` : 'Aún sin sesiones registradas';

  _libData = data;
  renderCalendar(data);
  renderSideStats(stats, data, schedule);
  // SCHEDULE PANEL — desactivado temporalmente, pendiente de reubicación en otra pantalla
  // await renderSchedulePanel();
  renderStatsSection(data);
}

// ─── STATS ────────────────────────────────────────────────────────────────────

function calcStats(data, weeks, schedule) {
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
    // Use user schedule if available, otherwise fall back to base ROUTINE
    const dayType = schedule ? (schedule[dayKey] || (ROUTINE[dayKey]?.rest ? 'rest' : 'train')) : (ROUTINE[dayKey]?.rest ? 'rest' : 'train');
    if (dayType === 'rest') continue;
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

// ─── VOLUMEN POR DÍA ──────────────────────────────────────────────────────────

function calcDayVolume(date, data) {
  const wk = getWeekKeyFromDate(date);
  const dayKey = getDayKeyFromDate(date);
  const dayData = data[wk]?.[dayKey];
  if (!dayData) return 0;
  let vol = 0;
  Object.entries(dayData).forEach(([k, v]) => {
    if (k.startsWith('_') || typeof v !== 'object') return;
    Object.entries(v).forEach(([sk, sv]) => {
      if (!sk.endsWith('_done') || !sv) return;
      const idx = sk.replace('_done', '');
      const kg = parseFloat(v[`${idx}_kg`]) || 0;
      const rep = parseInt(v[`${idx}_rep`]) || 0;
      vol += kg * rep;
    });
  });
  return vol;
}

function calcMonthProgress(data, schedule = null) {
  const now = new Date();
  const year = now.getFullYear(), month = now.getMonth(), today = now.getDate();
  let trained = 0, total = 0;
  for (let d = 1; d <= today; d++) {
    const date = new Date(year, month, d);
    const dayKey = getDayKeyFromDate(date);
    const isRest = schedule && schedule[dayKey]
      ? schedule[dayKey] === 'rest'
      : !!ROUTINE[dayKey]?.rest;
    if (isRest) continue;
    total++;
    const wk = getWeekKeyFromDate(date);
    const dayData = data[wk]?.[dayKey];
    if (dayData?._saved || hasDoneData(dayData)) trained++;
  }
  return { trained, total };
}

// ─── CAROUSEL GAMIFICACIÓN ────────────────────────────────────────────────────

const WEIGHT_REFS = [
  { emoji: '🧊', singular: 'nevera',          plural: 'neveras',          kg: 80   },
  { emoji: '🐕', singular: 'Golden Retriever', plural: 'Golden Retrievers', kg: 30   },
  { emoji: '🐄', singular: 'vaca',             plural: 'vacas',             kg: 600  },
  { emoji: '🏍️', singular: 'moto',             plural: 'motos',             kg: 200  },
  { emoji: '🚗', singular: 'coche',            plural: 'coches',            kg: 1300 },
  { emoji: '🐻', singular: 'oso pardo',        plural: 'osos pardos',       kg: 250  },
  { emoji: '🦁', singular: 'león',             plural: 'leones',            kg: 190  },
  { emoji: '🏋️', singular: 'Arnold',           plural: 'Arnolds',           kg: 113  },
  { emoji: '🐘', singular: 'elefante',         plural: 'elefantes',         kg: 4500 },
  { emoji: '🦊', singular: 'zorro',            plural: 'zorros',            kg: 6    },
];

let _carouselTimer = null;
let _carouselIdx = 0;
let _carouselItems = [];

function buildCarouselItems(kg) {
  const items = [];
  WEIGHT_REFS.forEach(ref => {
    const n = kg / ref.kg;
    if (n >= 0.05) {
      const disp = n >= 100 ? Math.round(n) : n >= 1 ? parseFloat(n.toFixed(1)) : parseFloat(n.toFixed(2));
      const label = disp === 1 ? ref.singular : ref.plural;
      items.push(`${ref.emoji} ${disp} ${label}`);
    }
  });
  return items;
}

function startCarousel(items) {
  if (_carouselTimer) { clearInterval(_carouselTimer); _carouselTimer = null; }
  if (!items || items.length <= 1) return;
  _carouselItems = items;
  _carouselIdx = 0;
  _carouselTimer = setInterval(() => {
    _carouselIdx = (_carouselIdx + 1) % _carouselItems.length;
    const el = document.getElementById('stat-carousel-text');
    if (!el) { clearInterval(_carouselTimer); _carouselTimer = null; return; }
    el.style.opacity = '0';
    setTimeout(() => { el.textContent = _carouselItems[_carouselIdx]; el.style.opacity = '1'; }, 300);
  }, 3500);
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

function renderSideStats(s, data, schedule) {
  const mp = calcMonthProgress(data, schedule);
  const pct = mp.total > 0 ? mp.trained / mp.total : 0;
  const r = 20, sw = 4, cx = 26, cy = 26, size = 52;
  const circ = 2 * Math.PI * r;
  const dash = circ * pct;
  const circleSvg = `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" class="circ-prog-svg">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--surface2)" stroke-width="${sw}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--orange)" stroke-width="${sw}"
      stroke-dasharray="${dash.toFixed(1)} ${circ.toFixed(1)}"
      stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>
    <text x="${cx}" y="${cy+4}" text-anchor="middle" font-size="9" font-weight="800"
      fill="var(--text)" font-family="-apple-system,sans-serif">${mp.trained}/${mp.total}</text>
  </svg>`;

  const hot = s.currentStreak >= 5;
  const streakIcon = s.currentStreak >= 7 ? '🔥' : s.currentStreak >= 5 ? '🔥' : '🏃';

  document.getElementById('side-stats').innerHTML = `
    <div class="sstat-row">
      <div class="sstat-card${hot ? ' sstat-streak-hot' : ''}" onclick="this.classList.add('sstat-tap');setTimeout(()=>this.classList.remove('sstat-tap'),150)">
        <div class="sstat-icon">${streakIcon}</div>
        <div class="sstat-val">${s.currentStreak}</div>
        <div class="sstat-label">Racha actual</div>
        ${hot ? '<div class="streak-fire-bar"></div>' : ''}
      </div>
      <div class="sstat-card sstat-circ" onclick="this.classList.add('sstat-tap');setTimeout(()=>this.classList.remove('sstat-tap'),150)">
        ${circleSvg}
        <div class="sstat-label" style="margin-top:3px">Este mes</div>
      </div>
    </div>
    <div class="sstat-card" onclick="this.classList.add('sstat-tap');setTimeout(()=>this.classList.remove('sstat-tap'),150)">
      <div class="sstat-icon">⚖️</div>
      <div class="sstat-val">${s.totalKg > 0 ? (s.totalKg >= 1000 ? (s.totalKg/1000).toFixed(1)+'t' : s.totalKg+'kg') : '—'}</div>
      <div class="sstat-label">Peso total</div>
    </div>
    <div class="sstat-card" onclick="this.classList.add('sstat-tap');setTimeout(()=>this.classList.remove('sstat-tap'),150)">
      <div class="sstat-icon">🏆</div>
      <div class="sstat-val">${s.bestWeekSessions}</div>
      <div class="sstat-label">Mejor semana</div>
    </div>
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

function getDayStatus(date, data, routine = null) {
  const wk = getWeekKeyFromDate(date);
  const dayKey = getDayKeyFromDate(date);
  if ((routine || ROUTINE)[dayKey]?.rest) return 'rest';
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

  // Pre-calc volumes for heatmap
  const dayVols = {};
  let maxVol = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(calYear, calMonth, d);
    if (date > today) continue;
    const status = getDayStatus(date, data, _libRoutine);
    if (status === 'complete' || status === 'partial') {
      const vol = calcDayVolume(date, data);
      dayVols[d] = vol;
      if (vol > maxVol) maxVol = vol;
    }
  }

  let html = '';
  for (let i = 0; i < startOffset; i++) html += `<div class="cal-cell"></div>`;

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(calYear, calMonth, d);
    const isToday = date.getTime() === today.getTime();
    const isFuture = date > today;
    const status = isFuture ? 'future' : getDayStatus(date, data, _libRoutine);
    const tappable = !isFuture && (status === 'complete' || status === 'partial');

    let bgStyle = '', numStyle = '', checkStyle = '';
    if (status === 'complete' || status === 'partial') {
      const vol = dayVols[d] || 0;
      const intensity = maxVol > 0 && vol > 0 ? vol / maxVol : (status === 'complete' ? 0.4 : 0.15);
      const opacity = 0.18 + intensity * 0.82;
      bgStyle = `background:rgba(255,107,0,${opacity.toFixed(2)});`;
      if (intensity > 0.5) { numStyle = 'color:#fff;'; checkStyle = 'color:rgba(255,255,255,0.9);'; }
      else { numStyle = 'color:var(--orange);'; checkStyle = 'color:var(--orange);'; }
    }

    let inner = `<span class="cal-day-num">${d}</span>`;
    if (status === 'complete') {
      inner = `<span class="cal-day-num" style="${numStyle}">${d}</span><span class="cal-check" style="${checkStyle}">✓</span>`;
    } else if (status === 'partial') {
      inner = `<span class="cal-day-num" style="${numStyle}">${d}</span><span class="cal-dot-sm partial"></span>`;
    }

    const styleAttr = bgStyle ? ` style="${bgStyle}"` : '';
    const clickAttr = tappable ? ` onclick="openDayDetail(${calYear},${calMonth},${d})"` : '';
    // Use cal-heat class for done days (no default bg from CSS), keep other classes for rest/future/empty
    const cellClass = (status === 'complete' || status === 'partial')
      ? `cal-cell cal-heat${isToday ? ' cal-today' : ''}${tappable ? ' cal-tappable' : ''}`
      : `cal-cell cal-${status}${isToday ? ' cal-today' : ''}`;
    html += `<div class="${cellClass}"${styleAttr}${clickAttr}>${inner}</div>`;
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
  // SECURITY: uses _libRoutine cached by render() — avoids re-decrypting on every call
  const R = _libRoutine || {};
  for (const d of DAYS) {
    const ex = (R[d]?.exercises || []).find(e => e.id === exId);
    if (ex) return ex.name;
  }
  return exId;
}

async function openDayDetail(y, m, d) {
  const date = new Date(y, m, d);
  const wk = getWeekKeyFromDate(date);
  const dayKey = getDayKeyFromDate(date);
  // SECURITY: decrypt workout data and routine via session key
  const data = _libData || await loadData(user);
  const dayData = data[wk]?.[dayKey];

  if (!dayData || (!hasDoneData(dayData) && !dayData._saved)) return;

  const R = _libRoutine || await getEffectiveRoutine(user);
  const info = R[dayKey];
  const exercises = info?.exercises || [];
  const allPRs = getAllPRs(data);

  const sessionName = dayData._sessionName || info?.name || '';
  document.getElementById('dd-title').textContent = `${DAY_LABELS_LONG[dayKey]} · ${sessionName}`;
  document.getElementById('dd-meta').textContent = `${d} de ${MONTH_NAMES_LONG[m]} de ${y}`;

  const exerciseIds = dayData._sessionExercises || exercises.map(e => e.id);

  let totalVol = 0, totalSeriesDone = 0, exDoneCount = 0;
  let exBlocksHtml = '';

  exerciseIds.forEach(exId => {
    const exData = dayData[exId];
    if (!exData) return;

    const routineEx = exercises.find(e => e.id === exId);
    const exName = routineEx?.name ?? getExName(exId);
    const setsToCheck = routineEx?.sets ?? 20;

    let sets = [];
    let anyDone = false;
    for (let i = 0; i < setsToCheck; i++) {
      if (exData[`s${i}_done`]) {
        anyDone = true;
        const kg = parseFloat(exData[`s${i}_kg`]) || 0;
        const rep = parseInt(exData[`s${i}_rep`]) || 0;
        const orm = (kg > 0 && rep > 0) ? Math.round(kg * (1 + rep / 30)) : null;
        const isPR = orm !== null && allPRs[exId] && orm >= allPRs[exId];
        sets.push({ num: i + 1, kg, rep, orm, isPR });
        totalVol += kg * rep;
        totalSeriesDone++;
      }
    }
    if (!anyDone) return;

    const allSets = Array.from({length: setsToCheck}, (_, i) => exData[`s${i}_done`]);
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
      <div class="dd-ex-name">${escapeHTML(exName)}</div>
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
      <div class="dd-sum-val">${exDoneCount}/${exerciseIds.length}</div>
      <div class="dd-sum-label">Ejercicios</div>
    </div>
  </div>`;

  const notesHtml = dayData._notes
    ? `<div class="dd-notes-block">
        <div class="dd-notes-label">Notas</div>
        <div class="dd-notes-text">${escapeHTML(dayData._notes)}</div> <!-- SECURITY: full escapeHTML on user notes -->
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

// ─── GRÁFICA DE PROGRESIÓN (SVG) ─────────────────────────────────────────────

function selectProgressionEx(exId) {
  _selectedProgressionExId = exId;
  renderStatsSection(_libData);
}

function switchStatsTab(tab) {
  _activeStatsTab = tab;
  renderStatsSection(_libData);
}

function _buildProgressionHtml(data) {
  const exerciseHistory = {};
  const allWeeks = Object.keys(data).sort();

  allWeeks.forEach(wk => {
    DAYS.forEach(day => {
      const dayData = data[wk]?.[day];
      if (!dayData) return;
      Object.entries(dayData).forEach(([exId, exData]) => {
        if (exId.startsWith('_') || typeof exData !== 'object') return;
        let maxKg = 0;
        Object.entries(exData).forEach(([sk, sv]) => {
          if (!sk.endsWith('_done') || !sv) return;
          const idx = sk.replace('_done', '');
          const kg = parseFloat(exData[`${idx}_kg`]) || 0;
          if (kg > maxKg) maxKg = kg;
        });
        if (maxKg > 0) {
          if (!exerciseHistory[exId]) exerciseHistory[exId] = [];
          exerciseHistory[exId].push({ wk, day, maxKg });
        }
      });
    });
  });

  const eligibleExercises = Object.entries(exerciseHistory)
    .filter(([, hist]) => hist.length >= 2)
    .sort(([, a], [, b]) => b.length - a.length);

  if (eligibleExercises.length === 0) {
    return `<div class="prog-card"><div style="text-align:center;padding:20px 0;color:var(--text3);font-size:13px">Entrena más veces para ver tu progresión</div></div>`;
  }

  let selectedEntry;
  if (_selectedProgressionExId && exerciseHistory[_selectedProgressionExId]?.length >= 2) {
    selectedEntry = [_selectedProgressionExId, exerciseHistory[_selectedProgressionExId]];
  } else {
    selectedEntry = eligibleExercises[0];
    _selectedProgressionExId = selectedEntry[0];
  }

  const [exId, fullHist] = selectedEntry;
  const hist = fullHist.slice(-10);
  const exName = getExName(exId);

  const selectOpts = eligibleExercises.map(([eid, ehist]) => {
    const ename = getExName(eid);
    const sel = eid === exId ? ' selected' : '';
    return `<option value="${escapeHTML(eid)}"${sel}>${escapeHTML(ename)} (${ehist.length})</option>`;
  }).join('');
  const selectHtml = `<select class="prog-select" onchange="selectProgressionEx(this.value)">${selectOpts}</select>`;

  const W = 280, H = 80, padL = 28, padR = 8, padT = 8, padB = 18;
  const plotW = W - padL - padR, plotH = H - padT - padB;
  const minKg = Math.min(...hist.map(h => h.maxKg));
  const maxKg = Math.max(...hist.map(h => h.maxKg));
  const range = maxKg - minKg || 1;
  const xOf = i => padL + (hist.length > 1 ? (i / (hist.length - 1)) * plotW : plotW / 2);
  const yOf = kg => padT + plotH - ((kg - minKg) / range) * plotH;

  const pts = hist.map((h, i) => `${xOf(i).toFixed(1)},${yOf(h.maxKg).toFixed(1)}`).join(' ');
  const area = `${xOf(0).toFixed(1)},${(padT + plotH).toFixed(1)} ${pts} ${xOf(hist.length - 1).toFixed(1)},${(padT + plotH).toFixed(1)}`;
  const dots = hist.map((h, i) =>
    `<circle cx="${xOf(i).toFixed(1)}" cy="${yOf(h.maxKg).toFixed(1)}" r="${i === hist.length - 1 ? 4 : 3}" fill="var(--orange)" stroke="var(--surface)" stroke-width="1.5"/>`
  ).join('');
  const yLabels = [[minKg, padT + plotH], [maxKg, padT]].map(([kg, y]) =>
    `<text x="${padL - 4}" y="${(y + 3).toFixed(0)}" text-anchor="end" font-size="8" fill="var(--text3)" font-family="-apple-system,sans-serif">${kg}</text>`
  ).join('');

  const svgHtml = `<svg width="100%" viewBox="0 0 ${W} ${H}" style="overflow:visible;display:block">
    <defs>
      <linearGradient id="prog-area-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FF6B35" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="#FF6B35" stop-opacity="0.03"/>
      </linearGradient>
    </defs>
    <polygon points="${area}" fill="url(#prog-area-grad)"/>
    <polyline points="${pts}" fill="none" stroke="#FF6B35" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    ${dots}
    ${yLabels}
  </svg>`;

  const latest = hist[hist.length - 1];
  const prev = hist[hist.length - 2];
  const trendDir = latest.maxKg > prev.maxKg ? 'up' : latest.maxKg < prev.maxKg ? 'down' : 'eq';
  const trendIcon = { up: '↑', down: '↓', eq: '–' }[trendDir];

  return `<div class="prog-card" style="padding-bottom:14px">
    ${selectHtml}
    <div style="margin-bottom:6px">${svgHtml}</div>
    <div class="prog-footer">
      <span style="font-size:12px;color:var(--text3)">${hist.length} registros</span>
      <div class="prog-right">
        <span class="prog-best">${latest.maxKg} kg</span>
        <span class="prog-trend ${trendDir}">${trendIcon}</span>
      </div>
    </div>
  </div>`;
}

// ─── VOLUMEN SEMANAL COMPARADO + PRs ─────────────────────────────────────────

function buildExGroupMap() {
  const map = {};
  if (typeof EXERCISE_CATALOG === 'undefined') return map;
  Object.entries(EXERCISE_CATALOG).forEach(([group, exs]) => {
    exs.forEach(ex => { map[ex.id] = group; });
  });
  return map;
}

function calcGroupVolumeForWeek(data, weekKey, groupMap) {
  const weekData = data[weekKey] || {};
  const volume = {};
  DAYS.forEach(day => {
    const dayData = weekData[day];
    if (!dayData) return;
    Object.entries(dayData).forEach(([exId, exData]) => {
      if (exId.startsWith('_') || typeof exData !== 'object') return;
      const group = groupMap[exId];
      if (!group) return;
      Object.entries(exData).forEach(([sk, sv]) => {
        if (!sk.endsWith('_done') || !sv) return;
        const idx = sk.replace('_done', '');
        const kg = parseFloat(exData[`${idx}_kg`]) || 0;
        const rep = parseInt(exData[`${idx}_rep`]) || 0;
        volume[group] = (volume[group] || 0) + kg * rep;
      });
    });
  });
  return volume;
}

function findRecentPRs(data) {
  const exHist = {};
  const allWeeks = Object.keys(data).sort();
  allWeeks.forEach(wk => {
    DAYS.forEach(day => {
      const dayData = data[wk]?.[day];
      if (!dayData) return;
      Object.entries(dayData).forEach(([exId, exData]) => {
        if (exId.startsWith('_') || typeof exData !== 'object') return;
        let maxKg = 0;
        Object.entries(exData).forEach(([sk, sv]) => {
          if (!sk.endsWith('_done') || !sv) return;
          const idx = sk.replace('_done', '');
          const kg = parseFloat(exData[`${idx}_kg`]) || 0;
          if (kg > maxKg) maxKg = kg;
        });
        if (maxKg > 0) {
          if (!exHist[exId]) exHist[exId] = [];
          exHist[exId].push({ wk, day, maxKg });
        }
      });
    });
  });

  const prs = [];
  Object.entries(exHist).forEach(([exId, hist]) => {
    if (hist.length < 2) return;
    const last = hist[hist.length - 1];
    const prevBest = Math.max(...hist.slice(0, -1).map(h => h.maxKg));
    if (last.maxKg > prevBest) prs.push({ exId, kg: last.maxKg, wk: last.wk });
  });

  prs.sort((a, b) => b.wk.localeCompare(a.wk));
  return prs.slice(0, 3);
}

function _buildVolumenHtml(data) {
  const wk = getWeekKey();
  const prevD = new Date(); prevD.setDate(prevD.getDate() - 7);
  const prevWk = getWeekKeyFromDate(prevD);
  const groupMap = buildExGroupMap();

  const thisWeek = calcGroupVolumeForWeek(data, wk, groupMap);
  const prevWeek = calcGroupVolumeForWeek(data, prevWk, groupMap);

  const entries = Object.entries(thisWeek).sort(([, a], [, b]) => b - a);

  if (entries.length === 0) {
    return `<div class="prog-card" style="text-align:center;padding:20px;color:var(--text3);font-size:14px">Entrena esta semana para ver tu volumen por grupo muscular</div>`;
  }

  let html = `<div class="muscle-card">`;
  entries.forEach(([group, vol]) => {
    const prev = prevWeek[group] || 0;
    let arrow = '→', arrowClass = 'vol-eq', pctStr = '';
    if (prev > 0) {
      const pct = (vol - prev) / prev * 100;
      if (Math.abs(pct) >= 1) {
        if (pct > 0) { arrow = '↑'; arrowClass = 'vol-up'; pctStr = `+${Math.round(pct)}%`; }
        else { arrow = '↓'; arrowClass = 'vol-down'; pctStr = `${Math.round(pct)}%`; }
      }
    }
    const volStr = vol >= 1000 ? (vol / 1000).toFixed(1) + 't' : Math.round(vol) + 'kg';
    html += `<div class="vol-row">
      <span class="vol-group">${escapeHTML(group)}</span>
      <span class="vol-amount">${volStr}</span>
      <span class="vol-arrow ${arrowClass}">${arrow}${pctStr ? ' ' + pctStr : ''}</span>
    </div>`;
  });
  html += `</div>`;
  return html;
}

// SCHEDULE PANEL — desactivado temporalmente, pendiente de reubicación en otra pantalla
/*
async function renderSchedulePanel() {
  const container = document.getElementById('schedule-section');
  if (!container) return;

  const [schedule, assignments, routines] = await Promise.all([
    loadTrainingSchedule(user),
    loadRoutineAssignments(user),
    loadUserRoutines(user),
  ]);

  const routineMap = {};
  routines.forEach(r => { routineMap[r.id] = r.name; });

  let html = `<div class="schedule-panel">
    <div class="bib-section-title" style="margin-bottom:12px">Mi semana</div>
    <div class="schedule-grid">`;

  DAYS.forEach(d => {
    const state = schedule[d] || (ROUTINE[d].rest ? 'rest' : 'train');
    const isTrain = state === 'train';
    const assignedId = assignments[d] ?? null;
    const routineName = isTrain && assignedId ? (routineMap[assignedId] || null) : null;
    html += `<div class="schedule-day${isTrain ? ' train' : ' rest'}" onclick="toggleScheduleDay('${d}')">
      <div class="schedule-day-icon">${isTrain ? '💪' : '💤'}</div>
      <div class="schedule-day-label">${ROUTINE[d].label}</div>
      ${routineName ? `<div class="schedule-day-routine">${escapeHTML(routineName)}</div>` : ''}
    </div>`;
  });

  html += `</div>
    <div class="schedule-hint">Tu racha solo se rompe si no entrenas un día marcado como 💪 Entreno</div>
  </div>`;

  container.innerHTML = html;
}

async function toggleScheduleDay(dayKey) {
  const schedule = await loadTrainingSchedule(user);
  schedule[dayKey] = schedule[dayKey] === 'rest' ? 'train' : 'rest';
  await saveTrainingSchedule(user, schedule);
  await renderSchedulePanel();
}
*/

// ─── RÉCORDS PERSONALES ───────────────────────────────────────────────────────

function _buildRecordsHtml(data) {
  const exBests = {};
  const allWeeks = Object.keys(data).sort();

  allWeeks.forEach(wk => {
    DAYS.forEach(day => {
      const dayData = data[wk]?.[day];
      if (!dayData) return;
      Object.entries(dayData).forEach(([exId, exData]) => {
        if (exId.startsWith('_') || typeof exData !== 'object') return;
        let maxKg = 0;
        Object.entries(exData).forEach(([sk, sv]) => {
          if (!sk.endsWith('_done') || !sv) return;
          const idx = sk.replace('_done', '');
          const kg = parseFloat(exData[`${idx}_kg`]) || 0;
          if (kg > maxKg) maxKg = kg;
        });
        if (maxKg > 0 && (!exBests[exId] || maxKg > exBests[exId].maxKg)) {
          exBests[exId] = { maxKg, wk, day };
        }
      });
    });
  });

  const entries = Object.entries(exBests).sort(([, a], [, b]) => b.maxKg - a.maxKg).slice(0, 10);

  if (entries.length === 0) {
    return `<div class="prog-card" style="text-align:center;padding:20px;color:var(--text3);font-size:14px">Completa tu primer entreno para ver tus récords aquí</div>`;
  }

  const currentWk = getWeekKey();
  const [curYearStr, curWeekStr] = currentWk.split('-W');
  const curYear = parseInt(curYearStr), curWeekNum = parseInt(curWeekStr);

  function weeksAgo(wk) {
    const [y, wStr] = wk.split('-W');
    return (curYear - parseInt(y)) * 52 + (curWeekNum - parseInt(wStr));
  }

  let html = `<div class="prs-list">`;
  entries.forEach(([exId, best]) => {
    const name = getExName(exId);
    const wa = weeksAgo(best.wk);
    const isRecent = wa <= 1;
    let dateStr;
    if (wa === 0) dateStr = 'esta semana';
    else if (wa === 1) dateStr = 'la semana pasada';
    else if (wa <= 4) dateStr = `hace ${wa} semanas`;
    else {
      const [y, wStr2] = best.wk.split('-W');
      dateStr = `sem. ${wStr2} de ${y}`;
    }
    html += `<div class="pr-card">
      <div class="pr-card-left">
        <div class="pr-ex-name">${escapeHTML(name)}</div>
        <div class="pr-ex-date">${dateStr}</div>
      </div>
      <div class="pr-card-right">
        <span class="pr-kg">${best.maxKg} kg</span>
        ${isRecent ? '<span class="pr-badge">🏆</span>' : ''}
      </div>
    </div>`;
  });
  html += `</div>`;
  return html;
}

function renderStatsSection(data) {
  const container = document.getElementById('stats-section');
  if (!container) return;

  const tabs = [
    { id: 'volumen',    label: '📊 Volumen' },
    { id: 'progresion', label: '📈 Progresión' },
    { id: 'records',    label: '🏆 Récords' },
  ];

  const tabsHtml = tabs.map(t => {
    const active = _activeStatsTab === t.id ? ' active' : '';
    return `<button class="stats-tab${active}" onclick="switchStatsTab('${t.id}')">${t.label}</button>`;
  }).join('');

  let contentHtml = '';
  if (_activeStatsTab === 'volumen') contentHtml = _buildVolumenHtml(data);
  else if (_activeStatsTab === 'progresion') contentHtml = _buildProgressionHtml(data);
  else if (_activeStatsTab === 'records') contentHtml = _buildRecordsHtml(data);

  container.innerHTML = `
    <div class="stats-section-title">Mis Stats</div>
    <div class="stats-tabs">${tabsHtml}</div>
    <div class="stats-tab-content">${contentHtml}</div>
  `;
}

// ─── MISC ─────────────────────────────────────────────────────────────────────

function logout() {
  clearCurrentUser(); // SECURITY: removes session and AES key from sessionStorage
  window.location.href = 'index.html';
}

// SECURITY: async IIFE — ensures render() awaits decryption before any DOM writes
render().catch(err => console.error('Biblioteca init error:', err));
window.onerror = function(msg, src, line) {
  document.body.insertAdjacentHTML('beforeend', 
    `<div style="position:fixed;bottom:0;left:0;right:0;background:red;color:white;padding:10px;font-size:12px;z-index:9999">${msg} (línea ${line})</div>`
  );
};
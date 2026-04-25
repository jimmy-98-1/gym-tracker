// ─── ROUTINE ─────────────────────────────────────────────────────────────────

const ROUTINE = {
  lun: {
    label: 'Lun', name: 'Piernas + Core', duration: '~70 min', rest: false,
    exercises: [
      { id:'LP', name:'Prensa de piernas',           sets:4, reps:'8–12',        rpe:'7–8', rest:'2–3 min', note:'Pies altos y separados, rodilla al pecho' },
      { id:'QE', name:'Extensión de cuádriceps',     sets:3, reps:'10–15',       rpe:'8',   rest:'90 seg',  note:'Bajar lento 3 seg, enfocar el estiramiento' },
      { id:'LC', name:'Curl femoral tumbado',        sets:3, reps:'10–15',       rpe:'8',   rest:'90 seg',  note:'Cadera ligeramente flexionada' },
      { id:'CA', name:'Elevación de talones de pie', sets:4, reps:'12–20',       rpe:'7',   rest:'60 seg',  note:'Rango completo, pausa abajo' },
      { id:'PF', name:'Plancha frontal',             sets:3, reps:'30–45 seg',   rpe:'7',   rest:'60 seg',  note:'Pelvis neutra, no hundir lumbares' },
      { id:'CP', name:'Crunch en polea alta',        sets:3, reps:'12–15',       rpe:'7',   rest:'60 seg',  note:'Flexión de columna controlada' },
    ]
  },
  mar: {
    label: 'Mar', name: 'Pecho + Tríceps', duration: '~65 min', rest: false,
    exercises: [
      { id:'PI', name:'Press inclinado con mancuernas',       sets:4, reps:'8–12',  rpe:'7–8', rest:'2–3 min', note:'30–45°, codos ligeramente cerrados' },
      { id:'AP', name:'Aperturas en polea baja',              sets:3, reps:'12–15', rpe:'8',   rest:'90 seg',  note:'Manos abajo, arco amplio' },
      { id:'FO', name:'Fondos en máquina o banco',            sets:3, reps:'10–15', rpe:'7',   rest:'90 seg',  note:'Torso inclinado para enfatizar pecho' },
      { id:'ET', name:'Extensión de tríceps en polea',        sets:3, reps:'12–15', rpe:'7–8', rest:'60 seg',  note:'Codos pegados al cuerpo' },
      { id:'EC', name:'Extensión sobre cabeza con mancuerna', sets:3, reps:'10–12', rpe:'8',   rest:'90 seg',  note:'Un brazo o bilateral neutro' },
    ]
  },
  mie: {
    label: 'Mié', name: 'Espalda + Bíceps', duration: '~70 min', rest: false,
    exercises: [
      { id:'JP', name:'Jalón al pecho en polea',         sets:4, reps:'8–12',  rpe:'7–8', rest:'2 min',  note:'Pecho arriba, escápulas bajas, agarre ancho' },
      { id:'RP', name:'Remo en polea baja',              sets:4, reps:'10–12', rpe:'7–8', rest:'2 min',  note:'Espalda recta, sin redondear lumbares, agarre neutro' },
      { id:'JN', name:'Jalón con agarre neutro cerrado', sets:3, reps:'10–15', rpe:'7',   rest:'90 seg', note:'Tirón hacia el esternón' },
      { id:'CM', name:'Curl martillo con mancuernas',   sets:3, reps:'10–14', rpe:'8',   rest:'90 seg', note:'Agarre neutro, codo fijo, bilateral' },
      { id:'CB', name:'Curl en polea baja',              sets:3, reps:'12–15', rpe:'8',   rest:'60 seg', note:'Codo adelantado, tensión constante, agarre neutro' },
    ]
  },
  jue: {
    label: 'Jue', name: 'Recuperación activa', rest: true,
    restDesc: 'Paseo 30–40 min o movilidad/estiramientos suaves. El músculo crece en reposo, no en el gym.',
  },
  vie: {
    label: 'Vie', name: 'Hombros + Core', duration: '~65 min', rest: false,
    exercises: [
      { id:'PH', name:'Press de hombros con mancuernas',   sets:4, reps:'8–12',        rpe:'7–8', rest:'2 min',  note:'Sentado, espalda apoyada, sin arquear lumbar' },
      { id:'EL', name:'Elevaciones laterales con mancuerna', sets:4, reps:'15–20',     rpe:'7',   rest:'60 seg', note:'Codo ligeramente doblado, sin trampa' },
      { id:'EP', name:'Elevaciones laterales en polea baja', sets:3, reps:'15–20',     rpe:'8',   rest:'60 seg', note:'Tensión desde abajo, codo alto' },
      { id:'FP', name:'Facepull en polea alta',             sets:3, reps:'15–20',       rpe:'6–7', rest:'60 seg', note:'Codos arriba, manos hacia orejas, cuerda' },
      { id:'DB', name:'Dead bug',                           sets:3, reps:'8–10 por lado', rpe:'6', rest:'60 seg', note:'Lumbar pegada al suelo siempre' },
      { id:'C2', name:'Crunch en polea alta',               sets:3, reps:'12–15',       rpe:'7',   rest:'60 seg', note:'Frecuencia 2x semanal en abdomen' },
    ]
  },
  sab: {
    label: 'Sáb', name: 'Piernas — volumen extra', duration: '~65 min', rest: false,
    exercises: [
      { id:'SS', name:'Sentadilla en máquina Smith',            sets:4, reps:'8–12',        rpe:'7–8', rest:'2–3 min', note:'Pies adelantados, espalda neutra' },
      { id:'PM', name:'Peso muerto en máquina (hack squat inv.)', sets:4, reps:'10–12',     rpe:'7–8', rest:'2 min',   note:'Patrón bisagra de cadera sin carga axial' },
      { id:'ZA', name:'Zancada en máquina o con mancuernas',   sets:3, reps:'10–12 por lado', rpe:'7', rest:'90 seg', note:'Paso largo, rodilla sin sobrepasar el pie' },
      { id:'CS', name:'Curl femoral sentado',                   sets:3, reps:'10–15',       rpe:'8',   rest:'90 seg',  note:'Mayor estiramiento proximal vs tumbado' },
      { id:'TS', name:'Elevación de talones sentado',           sets:4, reps:'15–20',       rpe:'7',   rest:'60 seg',  note:'Sóleo: rodilla doblada' },
    ]
  },
  dom: {
    label: 'Dom', name: 'Descanso completo', rest: true,
    restDesc: 'Descanso total. Aquí es donde el cuerpo supercompensa y creces. Sin gym, sin running intenso.',
  },
};

const DAYS = ['lun','mar','mie','jue','vie','sab','dom'];

// ─── USER ─────────────────────────────────────────────────────────────────────

function getStorageKey(user) {
  return `gymtracker_v1_${user.toLowerCase().trim()}`;
}

function getCurrentUser() {
  return sessionStorage.getItem('gym_user') || null;
}

function setCurrentUser(name) {
  sessionStorage.setItem('gym_user', name.trim());
}

function clearCurrentUser() {
  sessionStorage.removeItem('gym_user');
}

function requireUser(redirectTo = 'index.html') {
  const user = getCurrentUser();
  if (!user) { window.location.href = redirectTo; return null; }
  return user;
}

function getKnownUsers() {
  try { return JSON.parse(localStorage.getItem('gym_users') || '[]'); } catch(e) { return []; }
}

function registerUser(name) {
  const users = getKnownUsers();
  const norm = name.trim();
  if (!users.includes(norm)) {
    users.push(norm);
    localStorage.setItem('gym_users', JSON.stringify(users));
  }
}

// ─── DATA ─────────────────────────────────────────────────────────────────────

function loadData(user) {
  try { return JSON.parse(localStorage.getItem(getStorageKey(user))) || {}; } catch(e) { return {}; }
}

function saveData(user, data) {
  localStorage.setItem(getStorageKey(user), JSON.stringify(data));
}

function getWeekKey() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil(((now - start) / 86400000 + start.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${String(week).padStart(2,'0')}`;
}

function getTodayKey() {
  const d = new Date();
  return DAYS[d.getDay() === 0 ? 6 : d.getDay() - 1];
}

function getWeekNumber(user) {
  const data = loadData(user);
  const wk = getWeekKey();
  if (!data[wk]) { data[wk] = {}; saveData(user, data); }
  const allWeeks = Object.keys(loadData(user)).sort();
  return allWeeks.indexOf(wk) + 1;
}

function getLastSessionData(exId, data) {
  const weeks = Object.keys(data).sort().reverse();
  for (const wk of weeks) {
    for (const day of DAYS) {
      if (data[wk]?.[day]?.[exId]) return data[wk][day][exId];
    }
  }
  return null;
}

function isExDone(ex, dayData) {
  const exData = dayData[ex.id] || {};
  for (let i = 0; i < ex.sets; i++) {
    if (!exData[`s${i}_done`]) return false;
  }
  return true;
}

// ─── CUSTOM ROUTINE ───────────────────────────────────────────────────────────

function getCustomRoutine(user) {
  try { return JSON.parse(localStorage.getItem(`gymroutine_v1_${user.toLowerCase().trim()}`)); } catch(e) { return null; }
}

function saveCustomRoutine(user, customDays) {
  localStorage.setItem(`gymroutine_v1_${user.toLowerCase().trim()}`, JSON.stringify(customDays));
}

function clearCustomRoutine(user) {
  // "Limpiar rutina": keep rest/training config, empty all exercises
  const current = getCustomRoutine(user);
  const cleared = {};
  DAYS.forEach(d => {
    const isRest = current?.[d]?.rest ?? ROUTINE[d].rest;
    cleared[d] = { rest: isRest, exercises: isRest ? [] : [] };
  });
  saveCustomRoutine(user, cleared);
}

const REST_DESC_GENERIC = 'Día de descanso. Recuperación activa o reposo total según cómo te sientas.';

function getOnboardedKey(user) {
  return `gym_onboarded_${user.toLowerCase().trim()}`;
}

function isOnboarded(user) {
  return !!localStorage.getItem(getOnboardedKey(user));
}

function setOnboarded(user) {
  localStorage.setItem(getOnboardedKey(user), '1');
}

function getEffectiveRoutine(user) {
  const custom = getCustomRoutine(user);
  if (!custom) return ROUTINE;
  const merged = {};
  DAYS.forEach(d => {
    const base = ROUTINE[d];
    const c = custom[d];
    if (!c) { merged[d] = base; return; }
    if (c.rest) {
      // Day marked as rest (could be originally training or rest)
      merged[d] = { label: base.label, name: base.rest ? base.name : 'Descanso', rest: true, restDesc: base.restDesc ?? REST_DESC_GENERIC };
    } else {
      // Day marked as training
      merged[d] = { ...base, rest: false, exercises: c.exercises ?? (base.rest ? [] : base.exercises) };
    }
  });
  return merged;
}

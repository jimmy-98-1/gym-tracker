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

// ─── USER SESSION ─────────────────────────────────────────────────────────────

// SECURITY: centralized HTML escaping utility — prevents XSS when interpolating user data into innerHTML
function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getCurrentUser() {
  // SECURITY: reads email from the validated session — returns null when session is absent or expired
  return getSession()?.email || null;
}

function clearCurrentUser() {
  clearSession(); // SECURITY: also removes the AES data-key from sessionStorage
}

function requireUser(redirectTo = 'index.html') {
  const user = getCurrentUser();
  if (!user) { window.location.href = redirectTo; return null; }
  return user;
}

// ─── STORAGE KEYS ─────────────────────────────────────────────────────────────

function getStorageKey(user) {
  // SECURITY: v2 namespace — stores AES-GCM ciphertext; incompatible with old plaintext v1 blobs
  return `gymtracker_v2_${user}`;
}

function _routineStorageKey(user) {
  // SECURITY: v2 namespace for encrypted custom routine
  return `gymroutine_v2_${user}`;
}

// ─── DATA (async, AES-GCM encrypted) ─────────────────────────────────────────

async function loadData(user) {
  try {
    const raw = localStorage.getItem(getStorageKey(user));
    if (!raw) return {};
    // SECURITY: decrypt with per-user AES-GCM key derived from password and stored in sessionStorage
    return await decryptJSON(raw);
  } catch(e) {
    console.error('loadData: decrypt failed', e);
    return {};
  }
}

async function saveData(user, data) {
  try {
    // SECURITY: encrypt before writing — workout data (weights, notes, PRs) never stored in plaintext
    const cipher = await encryptJSON(data);
    localStorage.setItem(getStorageKey(user), cipher);
  } catch(e) {
    console.error('saveData: encrypt failed', e);
  }
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

async function getWeekNumber(user) {
  const data = await loadData(user);
  const wk = getWeekKey();
  if (!data[wk]) { data[wk] = {}; await saveData(user, data); }
  return Object.keys(data).sort().indexOf(wk) + 1;
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
  if (ex.type === 'cardio') return !!dayData[ex.id]?._done;
  const exData = dayData[ex.id] || {};
  for (let i = 0; i < ex.sets; i++) {
    if (!exData[`s${i}_done`]) return false;
  }
  return true;
}

// ─── CUSTOM ROUTINE (async, AES-GCM encrypted) ────────────────────────────────

async function getCustomRoutine(user) {
  try {
    const raw = localStorage.getItem(_routineStorageKey(user));
    if (!raw) return null;
    // SECURITY: decrypt with the same session key used for workout data
    return await decryptJSON(raw);
  } catch(e) {
    return null;
  }
}

async function saveCustomRoutine(user, customDays) {
  // SECURITY: routine data (exercise selection, day names) encrypted at rest
  const cipher = await encryptJSON(customDays);
  localStorage.setItem(_routineStorageKey(user), cipher);
}

async function clearCustomRoutine(user) {
  const current = await getCustomRoutine(user);
  const cleared = {};
  DAYS.forEach(d => {
    const isRest = current?.[d]?.rest ?? ROUTINE[d].rest;
    cleared[d] = { rest: isRest, exercises: [] };
  });
  await saveCustomRoutine(user, cleared);
}

const REST_DESC_GENERIC = 'Día de descanso. Recuperación activa o reposo total según cómo te sientas.';

function getOnboardedKey(user) {
  return `gym_onboarded_${user}`;
}

function isOnboarded(user) {
  return !!localStorage.getItem(getOnboardedKey(user));
}

function setOnboarded(user) {
  localStorage.setItem(getOnboardedKey(user), '1');
}

// ─── USER ROUTINES (async, AES-GCM encrypted) ─────────────────────────────────

async function saveUserRoutines(user, routines) {
  try {
    const cipher = await encryptJSON(routines);
    localStorage.setItem('gym_routines_' + user, cipher);
  } catch(e) {
    console.error('saveUserRoutines: encrypt failed', e);
  }
}

async function loadUserRoutines(user) {
  try {
    const raw = localStorage.getItem('gym_routines_' + user);
    if (!raw) return [];
    return await decryptJSON(raw);
  } catch(e) {
    return [];
  }
}

async function getEffectiveRoutine(user) {
  const custom = await getCustomRoutine(user);
  if (!custom) return ROUTINE;
  const merged = {};
  DAYS.forEach(d => {
    const base = ROUTINE[d];
    const c = custom[d];
    if (!c) { merged[d] = base; return; }
    const customName = c.name || null;
    if (c.rest) {
      merged[d] = { label: base.label, name: customName || (base.rest ? base.name : 'Descanso'), rest: true, restDesc: base.restDesc ?? REST_DESC_GENERIC };
    } else {
      merged[d] = { ...base, rest: false, name: customName || base.name, exercises: c.exercises ?? (base.rest ? [] : base.exercises) };
    }
  });
  return merged;
}

// ─── COACH IA — OpenAI Integration ────────────────────────────────────────────
// Analiza el historial del usuario y sugiere progresos conservadores y seguros.

// OPENAI_API_KEY se define en js/config.js (excluido de git)
const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

let _coachSuggestions = null;

// ─── RECOPILACIÓN DE HISTORIAL ────────────────────────────────────────────────

function _getExerciseHistory(exId, data, currentWk, maxSessions = 4) {
  const sessions = [];
  const weeks = Object.keys(data).sort().reverse();

  for (const wk of weeks) {
    if (wk === currentWk) continue;
    for (const day of DAYS) {
      const exData = data[wk]?.[day]?.[exId];
      if (!exData) continue;

      const sets = [];
      for (let i = 0; i < 15; i++) {
        if (exData[`s${i}_done`] === undefined) break;
        if (exData[`s${i}_done`]) {
          const kg  = parseFloat(exData[`s${i}_kg`])  || 0;
          const rep = parseInt(exData[`s${i}_rep`])    || 0;
          if (kg > 0 || rep > 0) sets.push({ kg, rep });
        }
      }

      if (sets.length > 0) {
        sessions.push({ sets });
        if (sessions.length >= maxSessions) break;
      }
    }
    if (sessions.length >= maxSessions) break;
  }

  return sessions; // orden: más reciente primero
}

// ─── CONSTRUCCIÓN DEL PROMPT ──────────────────────────────────────────────────

function _buildPrompt(exercisesHistory) {
  const lines = [];

  for (const ex of exercisesHistory) {
    if (ex.sessions.length < 2) continue;

    const sessionLines = ex.sessions.map((s, idx) => {
      const label = idx === 0 ? 'Sesión más reciente' : `Hace ${idx} sesión(es)`;
      const setsStr = s.sets.map(set => `${set.kg}kg×${set.rep}rep`).join(' | ');
      return `    ${label}: ${setsStr}`;
    }).join('\n');

    lines.push(`Ejercicio: "${ex.name}"\n${sessionLines}`);
  }

  if (lines.length === 0) return null;

  return `Eres un entrenador personal de fuerza altamente cualificado, prudente y especializado en progresión segura. Analiza el historial de entrenamiento y decide si el atleta está objetivamente preparado para progresar.

=== HISTORIAL DE ENTRENAMIENTOS ===
${lines.join('\n\n')}

=== CRITERIOS PARA SUGERIR PROGRESIÓN ===
1. PESO: Sugiere subir peso SOLO si el atleta ha completado TODAS las series previstas con las MISMAS reps durante las últimas 2 sesiones consecutivas y el esfuerzo parece controlado (reps consistentes, no decrecientes entre series).
2. REPS: Sugiere añadir reps SOLO si el peso es estable pero las reps varían hacia arriba en las últimas 2 sesiones. Máximo +1 o +2 reps.
3. INCREMENTOS SEGUROS de peso: 2.5 kg para ejercicios de tren superior (press, curl, remo, jalón, pullover, aperturas). 5 kg para tren inferior (sentadilla, prensa, peso muerto, extensiones).
4. NO sugieras nada si hay progresión natural reciente (la última sesión ya fue mejor que la anterior).
5. NO sugieras nada si solo hay una sesión de datos o los datos son inconsistentes.
6. NO sugieras cambios de peso Y reps a la vez en el mismo ejercicio. Elige uno.
7. Sé conservador: ante la duda, NO sugieras.

=== FORMATO DE RESPUESTA ===
Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin markdown, sin bloques de código. Exactamente así:
{"suggestions":[{"exerciseName":"nombre exacto del ejercicio","message":"mensaje corto y específico en español, máx 55 caracteres","type":"weight"}]}

Si no hay sugerencias claras y seguras, devuelve exactamente: {"suggestions":[]}`;
}

// ─── LLAMADA A LA API ─────────────────────────────────────────────────────────

async function _callOpenAI(prompt) {
  const res = await fetch(OPENAI_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + OPENAI_API_KEY
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      max_tokens: 600,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!res.ok) throw new Error(`OpenAI HTTP ${res.status}`);

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error('Empty OpenAI response');

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in response');

  return JSON.parse(match[0]);
}

// ─── PUNTO DE ENTRADA PRINCIPAL ───────────────────────────────────────────────

async function runCoachAnalysis(exercises, data) {
  try {
    if (!OPENAI_API_KEY) return;

    const currentWk = getWeekKey();

    const exercisesHistory = exercises
      .filter(ex => ex.type !== 'cardio')
      .map(ex => ({
        name: ex.name,
        id: ex.id,
        sessions: _getExerciseHistory(ex.id, data, currentWk, 4)
      }))
      .filter(ex => ex.sessions.length >= 2);

    if (exercisesHistory.length === 0) return;

    const prompt = _buildPrompt(exercisesHistory);
    if (!prompt) return;

    const result = await _callOpenAI(prompt);
    const suggestions = (result.suggestions || []).filter(
      s => s.exerciseName && s.message
    );

    if (suggestions.length > 0) {
      _coachSuggestions = suggestions;
      _showCoachBadge();
    }
  } catch (e) {
    // Fallo silencioso — el entrenador IA es opcional, no debe romper el entreno
    console.warn('Coach IA:', e.message);
  }
}

// ─── UI ───────────────────────────────────────────────────────────────────────

function _showCoachBadge() {
  const badge = document.getElementById('coach-badge');
  if (badge) badge.classList.add('visible');
}

function openCoachModal() {
  if (!_coachSuggestions || _coachSuggestions.length === 0) return;

  const list = document.getElementById('coach-suggestions-list');
  list.innerHTML = _coachSuggestions.map(s => {
    const icon = s.type === 'weight' ? '⬆️' : '🔁';
    return `<div class="coach-item">
      <div class="coach-item-name">${escapeHTML(s.exerciseName)}</div>
      <div class="coach-item-msg">${icon} ${escapeHTML(s.message)}</div>
    </div>`;
  }).join('');

  document.getElementById('coach-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeCoachModal() {
  document.getElementById('coach-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function resetCoach() {
  _coachSuggestions = null;
  const badge = document.getElementById('coach-badge');
  if (badge) badge.classList.remove('visible');
  closeCoachModal();
}

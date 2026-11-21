// Resumen del mercado en vivo (cuotas de la extensión) para el modelo de picks y para la IA.
import { labelOf } from './livePitch';

const num = (v) => (Number(v) > 1 ? Number(v) : null);

/**
 * Cuotas publicadas ahora mismo: 1X2, líneas principales y todos los mercados con su precio.
 * Devuelve null si la fuente no tiene el 1X2 abierto (por ejemplo, mercados suspendidos).
 */
export function oddsOf(data) {
  const mr = data?.odds?.matchResult;
  if (!data || !num(mr?.home) || !num(mr?.draw) || !num(mr?.away)) return null;
  const tg = data.odds.totalGoals;
  return {
    capturedAt: data.capturedAt,
    matchResult: { home: num(mr.home), draw: num(mr.draw), away: num(mr.away) },
    totalGoals: tg && num(tg.over) && num(tg.under) && tg.line != null ? { line: Number(tg.line), over: num(tg.over), under: num(tg.under) } : null,
    nextGoal: data.odds.nextGoal || null,
    totalCards: data.odds.totalCards || null,
    implied: data.impliedProbabilities || null,
    // Todos los mercados publicados (el 1X2 incluido), cada opción con su nombre completo
    markets: (data.markets || [])
      .filter((m) => m.selections?.length)
      .map((m) => ({
        id: m.id,
        type: m.type,
        name: m.name,
        line: m.line ?? null,
        selections: m.selections.map((s) => ({
          name: s.label && s.label !== s.name && s.name.length <= 2 ? `${s.name} (${s.label})` : s.name,
          price: num(s.price),
        })),
      })),
  };
}

// ---------------------------------------------------------------- Jugadas en vivo para la IA

const SHOT_ON = new Set([1, 20]);
const SHOT_OFF = new Set([2, 22]);
const GOALS = new Set([8, 21]);
const NOTABLE = new Set([1, 2, 3, 5, 8, 9, 10, 11, 12, 15, 20, 21, 22, 27]);

const blankTally = () => ({ attacks: 0, dangerous: 0, shotsOn: 0, shotsOff: 0, woodwork: 0, corners: 0, freeKicks: 0, offsides: 0, yellow: 0, red: 0, goals: 0 });

/**
 * Lo que pasó en los últimos `span` minutos según el flujo de jugadas: ataques y ataques peligrosos
 * (contados por jugada, no por actualización), tiros, córners, tarjetas y las últimas acciones.
 */
export function summarizePlays(log, { teamIds, players } = {}, span = 10) {
  const timed = (log || []).filter((e) => e.minute != null);
  if (!timed.length || !teamIds?.home) return null;
  const to = Math.max(...timed.map((e) => e.minute));
  const first = Math.min(...timed.map((e) => e.minute));
  const from = Math.max(first, to - span);
  const tally = { home: blankTally(), away: blankTally() };
  const sideOf = (e) => (e.teamId === teamIds.home ? 'home' : e.teamId === teamIds.away ? 'away' : null);
  let phase = null; // ataque en curso: { side, kind }
  const recent = [];

  for (const e of timed) {
    if (e.minute < from) continue;
    const side = sideOf(e);
    if (e.type === 0) {
      const kind = e.dangerous ? 'dangerous' : e.attack ? 'attacks' : null;
      if (side && kind && (phase?.side !== side || phase?.kind !== kind)) tally[side][kind] += 1;
      phase = kind && side ? { side, kind } : null;
      continue;
    }
    phase = null;
    if (!side) continue;
    const t = tally[side];
    if (GOALS.has(e.type)) t.goals += 1;
    else if (SHOT_ON.has(e.type)) t.shotsOn += 1;
    else if (SHOT_OFF.has(e.type)) t.shotsOff += 1;
    if (e.type === 11) t.woodwork += 1;
    if (e.type === 12) t.corners += 1;
    if (e.type === 3) t.freeKicks += 1;
    if (e.type === 4) t.offsides += 1;
    if (e.type === 10) t.yellow += 1;
    if (e.type === 9 || e.type === 27) t.red += 1;
    if (NOTABLE.has(e.type)) {
      const p = players?.[e.playerId];
      recent.push({ minute: e.minute, label: labelOf(e).replace(/[¡!]/g, ''), side, player: p?.shortName || p?.name || null });
    }
  }
  return { from, to, home: tally.home, away: tally.away, recent: recent.slice(-6) };
}

/**
 * @param data    salida de parseBetanoSnapshot (useLiveOdds().data)
 * @param history puntos { minute, p, mr } de useLiveOdds().history
 * @param extra   { lock: useMarketLock(), plays: summarizePlays(), lastOdds: oddsOf() de una lectura anterior,
 *                  scoreboard: { home, away, clock, scorers } el marcador que muestra la cabecera }
 * @returns objeto liveMarket o null si no hay 1X2 en vivo ni una lectura anterior del mismo partido
 */
export function toLiveMarket(data, history = [], { lock = null, plays = null, lastOdds = null, scoreboard = null } = {}) {
  if (!data) return null;
  const current = oddsOf(data);
  // Con los mercados cerrados la fuente puede dejar el 1X2 sin precio: se usa la última lectura buena
  const odds = current || (lastOdds?.eventId === data.eventId ? lastOdds : null);
  if (!odds) return null;
  const minute = data.clock?.seconds != null ? data.clock.seconds / 60 : null;

  // Movimiento del 1X2: lectura de hace ~10 minutos de partido contra la actual
  let trend = null;
  const last = history[history.length - 1];
  if (last?.mr && history.length > 1) {
    const past = [...history].reverse().find((h) => h.mr && last.minute - h.minute >= 8) || history.find((h) => h.mr);
    // Solo si hay al menos 2 minutos de partido entre ambas lecturas (si no, no hay movimiento que contar)
    if (past && past !== last && last.minute - past.minute >= 2) {
      trend = { fromMinute: past.minute, toMinute: last.minute, from: past.mr, to: last.mr, pFrom: past.p, pTo: last.p };
    }
  }

  // El marcador es el mismo de la cabecera (ESPN o la fuente, el que vaya adelante). Si ESPN ya tiene
  // un gol que la fuente de cuotas no marca, esas cuotas pueden ser de antes de ese gol.
  const source = { home: Number(data.home?.score) || 0, away: Number(data.away?.score) || 0 };
  const score = scoreboard ? { home: Number(scoreboard.home) || 0, away: Number(scoreboard.away) || 0 } : source;
  const sourceBehind = score.home + score.away > source.home + source.away ? source : null;

  return {
    capturedAt: data.capturedAt,
    oddsAt: odds.capturedAt || data.capturedAt,
    minute,
    clock: scoreboard?.clock || data.clock?.display || null,
    injuryTime: data.clock?.injuryTime ?? null,
    score,
    scorers: scoreboard?.scorers || null,
    sourceBehind,
    matchResult: odds.matchResult,
    totalGoals: odds.totalGoals,
    nextGoal: odds.nextGoal,
    totalCards: odds.totalCards,
    implied: odds.implied,
    markets: odds.markets || [],
    stats: { home: data.home?.stats || {}, away: data.away?.stats || {} },
    trend,
    // Cuotas que pueden no reflejar la última jugada (mercados cerrados o 1X2 sin precio ahora)
    frozen: !current || Boolean(lock?.locked) || Boolean(sourceBehind),
    suspended: lock?.locked ? { by: lock.by, kind: lock.kind || null, side: lock.side || null, minute: lock.minute ?? null } : null,
    plays,
  };
}

/** Devuelve el partido con `liveMarket` si hay cuotas en vivo; si no, el mismo objeto. */
export function withLiveMarket(match, odds) {
  if (!match) return match;
  const liveMarket = toLiveMarket(odds?.data, odds?.history, odds);
  return liveMarket ? { ...match, liveMarket } : match;
}

const f2 = (v) => (v != null ? Number(v).toFixed(2) : '—');

const REASON = { goal: 'gol', penalty: 'penal', var: 'revisión VAR', red: 'tarjeta roja' };

const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

function describeTally(name, t) {
  const parts = [
    count(t.attacks, 'ataque', 'ataques'),
    count(t.dangerous, 'ataque peligroso', 'ataques peligrosos'),
    count(t.shotsOn, 'tiro al arco', 'tiros al arco'),
    count(t.shotsOff, 'tiro desviado', 'tiros desviados'),
    t.woodwork ? count(t.woodwork, 'remate al palo', 'remates al palo') : null,
    count(t.corners, 'córner', 'córners'),
    t.freeKicks ? count(t.freeKicks, 'tiro libre', 'tiros libres') : null,
    t.offsides ? count(t.offsides, 'fuera de juego', 'fueras de juego') : null,
    t.yellow ? count(t.yellow, 'amarilla', 'amarillas') : null,
    t.red ? count(t.red, 'roja', 'rojas') : null,
    t.goals ? count(t.goals, 'gol', 'goles') : null,
  ].filter(Boolean);
  return `${name}: ${parts.join(', ')}`;
}

/**
 * Datos en vivo para la IA, uno por línea con nombre propio, para que pueda citarlos.
 * Nunca incluye valores que no vengan de la fuente en vivo.
 * @returns {Array<{ key, label, text }>}
 */
export function liveFacts(lm, home = 'Local', away = 'Visita') {
  if (!lm) return [];
  const facts = [];
  const add = (key, label, text) => facts.push({ key, label, text });
  const teamOf = (side) => (side === 'home' ? home : side === 'away' ? away : null);
  const when = lm.clock ? `Minuto ${lm.clock}` : 'En vivo';

  const goals = (side) => (lm.scorers?.[side] || []).map((g) => `${g.name} ${g.minutes.join(', ')}`).join('; ');
  const scorers = lm.scorers && (goals('home') || goals('away'))
    ? ` Goles: ${home} ${goals('home') || 'ninguno'}; ${away} ${goals('away') || 'ninguno'}.`
    : '';
  add('live-state', 'Marcador en vivo', `${when}: ${home} ${lm.score.home}-${lm.score.away} ${away}.${scorers}`);

  if (lm.sourceBehind && !lm.suspended) {
    add('live-suspended', 'Cuotas atrasadas', `La fuente de cuotas todavía marca ${lm.sourceBehind.home}-${lm.sourceBehind.away}: sus cuotas pueden ser de antes del último gol y no reflejan el ${lm.score.home}-${lm.score.away}.`);
  } else if (lm.suspended) {
    const s = lm.suspended;
    const why = s.kind
      ? `${REASON[s.kind] || 'una jugada'}${teamOf(s.side) ? ` de ${teamOf(s.side)}` : ''}${s.minute != null ? ` en el minuto ${Math.round(s.minute)}` : ''}`
      : null;
    add('live-suspended', 'Mercados suspendidos', why
      ? `La casa cerró los mercados por ${why}. Las cuotas de esta lista son de antes de esa jugada y ahora no se pueden jugar.`
      : 'La casa tiene los mercados cerrados ahora mismo. Las cuotas de esta lista son la última lectura abierta y ahora no se pueden jugar.');
  } else if (lm.frozen) {
    add('live-suspended', 'Cuotas de la última lectura', 'La fuente no publica el 1X2 en este momento. Las cuotas de esta lista son la última lectura abierta.');
  }

  const mr = lm.matchResult;
  const implied = lm.implied
    ? ` Sin el margen de la casa: ${home} ${lm.implied.home}%, empate ${lm.implied.draw}%, ${away} ${lm.implied.away}% (margen ${lm.implied.bookMargin}%).`
    : '';
  add('live-1x2', 'Resultado del partido en vivo', `${home} ${f2(mr.home)} | Empate ${f2(mr.draw)} | ${away} ${f2(mr.away)}.${implied}`);

  if (lm.trend) {
    const t = lm.trend;
    add('live-trend', 'Movimiento del 1X2', `Entre el minuto ${Math.round(t.fromMinute)} y el ${Math.round(t.toMinute)}: ${home} ${f2(t.from.home)}→${f2(t.to.home)} | Empate ${f2(t.from.draw)}→${f2(t.to.draw)} | ${away} ${f2(t.from.away)}→${f2(t.to.away)}.`);
  }

  // Cada mercado publicado en vivo, con todas sus opciones
  const others = (lm.markets || []).filter((m) => m.type !== 'MRES');
  for (const m of others) {
    const sel = m.selections.map((s) => `${s.name} ${s.price != null ? f2(s.price) : 'cerrada'}`).join(' | ');
    add(`mk-${m.id}`, `En vivo: ${m.name}`, `${m.name}: ${sel}.`);
  }
  if (!others.length) {
    // Lecturas viejas sin la lista de mercados: las líneas principales
    if (lm.totalGoals) add('mk-goals', 'En vivo: goles totales', `Goles totales, línea ${lm.totalGoals.line}: Más ${f2(lm.totalGoals.over)} | Menos ${f2(lm.totalGoals.under)}.`);
    if (lm.nextGoal) add('mk-next', 'En vivo: próximo gol', `${lm.nextGoal.market || 'Próximo gol'}: ${home} ${f2(lm.nextGoal.home)} | Sin gol ${f2(lm.nextGoal.none)} | ${away} ${f2(lm.nextGoal.away)}.`);
    if (lm.totalCards) add('mk-cards', 'En vivo: tarjetas', `Tarjetas, línea ${lm.totalCards.line}: Más ${f2(lm.totalCards.over)} | Menos ${f2(lm.totalCards.under)}.`);
  }

  const s = lm.stats;
  const stat = (label, k) => (s.home?.[k] != null || s.away?.[k] != null ? `${label} ${s.home?.[k] ?? '—'}-${s.away?.[k] ?? '—'}` : null);
  const st = [stat('xG', 'xG'), stat('Tiros', 'shots'), stat('Córners', 'corners'), stat('Amarillas', 'yellowCards'), stat('Rojas', 'redCards')].filter(Boolean);
  if (st.length) add('live-stats', 'Estadísticas en vivo', `${home}-${away}: ${st.join(' | ')}.`);

  const pl = lm.plays;
  if (pl) {
    const span = `minuto ${Math.round(pl.from)} al ${Math.round(pl.to)}`;
    const last = pl.recent.length
      ? ` Últimas acciones: ${pl.recent.map((r) => `${Math.round(r.minute)}' ${r.label} ${teamOf(r.side)}${r.player ? ` (${r.player})` : ''}`).join('; ')}.`
      : '';
    add('live-plays', `Jugadas en vivo, ${span}`, `Del ${span}. ${describeTally(home, pl.home)}. ${describeTally(away, pl.away)}.${last}`);
  }
  return facts;
}

/** Texto plano de los datos en vivo (sin numerar). */
export function describeLiveMarket(lm, home = 'Local', away = 'Visita') {
  const facts = liveFacts(lm, home, away);
  return facts.length ? facts.map((f) => f.text).join('\n- ') : null;
}

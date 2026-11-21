// Convierte el flujo de jugadas en vivo a coordenadas de la cancha (105 x 68),
// siempre con el local atacando hacia la derecha.

const PITCH_W = 105;
const PITCH_H = 68;

const TYPE_LABEL = {
  1: 'Tiro al arco',
  2: 'Tiro desviado',
  3: 'Tiro libre',
  4: 'Fuera de juego',
  5: 'Penal',
  6: 'Cambio',
  7: 'Lesión',
  8: '¡GOL!',
  9: 'Tarjeta roja',
  10: 'Tarjeta amarilla',
  11: 'Al palo',
  12: 'Córner',
  13: 'Saque de arco',
  14: 'Saque de banda',
  15: 'Revisión VAR',
  16: 'Comienza el tiempo',
  17: 'Fin del tiempo',
  18: 'Tiempo añadido',
  19: 'Final del partido',
  20: 'Penal atajado',
  21: 'Penal convertido',
  22: 'Penal fallado',
  23: 'Saque inicial',
  24: 'Partido detenido',
  25: 'Se reanuda',
  27: 'Segunda amarilla',
};

const DANGER_TYPES = new Set([1, 2, 5, 8, 11, 12, 20, 21, 22]);
const IGNORED_TYPES = new Set([26]); // cambios de color de camiseta

// Escena que dibuja la cancha para cada tipo de jugada
const KIND = {
  1: 'shot-on', 2: 'shot-off', 3: 'free-kick', 4: 'offside', 5: 'penalty', 6: 'sub', 7: 'injury',
  8: 'goal', 9: 'red', 10: 'yellow', 11: 'woodwork', 12: 'corner', 13: 'goal-kick', 14: 'throw-in',
  15: 'var', 16: 'kickoff', 17: 'center', 18: 'added-time', 19: 'center', 20: 'penalty-saved',
  21: 'goal', 22: 'penalty-missed', 23: 'kickoff', 24: 'stopped', 25: 'resume', 27: 'second-yellow',
};

// Escenas que se dibujan al centro con ícono y rótulo propios (sin el rótulo junto al balón)
const STAGE_KINDS = new Set(['sub', 'var', 'injury', 'kickoff', 'added-time', 'stopped', 'resume']);
export const isStageKind = (kind) => STAGE_KINDS.has(kind);

export function kindOf(e) {
  if (e.type === 0) return e.dangerous ? 'danger' : e.attack ? 'attack' : 'possession';
  return KIND[e.type] || 'center';
}

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/** Coloca el balón y el destino según la jugada (córner en el banderín, penal en el punto, etc.). */
function sceneGeometry(kind, side, ball) {
  const dir = side === 'away' ? -1 : 1; // hacia dónde ataca
  const goalX = dir === 1 ? PITCH_W : 0; // arco rival
  const ownGoalX = PITCH_W - goalX;
  const top = ball.y < PITCH_H / 2;
  const mid = PITCH_H / 2;
  switch (kind) {
    case 'corner':
      return {
        ball: { x: goalX - dir * 0.6, y: top ? 0.6 : PITCH_H - 0.6 },
        target: { x: goalX - dir * 8, y: mid + (top ? -2.5 : 2.5) },
      };
    case 'shot-on':
      return { ball, target: { x: goalX, y: clamp(ball.y, mid - 2.6, mid + 2.6) } };
    case 'shot-off':
      return { ball, target: { x: goalX, y: top ? mid - 7.5 : mid + 7.5 } };
    case 'woodwork':
      return { ball, target: { x: goalX, y: top ? mid - 3.66 : mid + 3.66 } };
    case 'goal':
      return { ball, target: { x: goalX, y: clamp(ball.y, mid - 2.4, mid + 2.4) } };
    case 'penalty':
    case 'penalty-saved':
    case 'penalty-missed': {
      const spot = { x: goalX - dir * 11, y: mid };
      const t = kind === 'penalty-missed' ? { x: goalX, y: mid - 6.5 } : { x: goalX, y: mid - 1.8 };
      return { ball: spot, target: t };
    }
    case 'goal-kick':
      return { ball: { x: ownGoalX + dir * 5.5, y: mid }, target: { x: PITCH_W / 2 + dir * 12, y: mid + (top ? -10 : 10) } };
    case 'throw-in': {
      const x = clamp(ball.x, 3, PITCH_W - 3);
      return { ball: { x, y: top ? 0 : PITCH_H }, target: { x: x + dir * 7, y: top ? 9 : PITCH_H - 9 } };
    }
    case 'kickoff':
      return { ball: { x: PITCH_W / 2, y: mid }, target: { x: PITCH_W / 2, y: mid } };
    default:
      return null;
  }
}

export function labelOf(e) {
  if (e.type === 0) {
    if (e.dangerous) return 'Ataque peligroso';
    if (e.attack) return 'Ataque';
    return 'Posesión';
  }
  return TYPE_LABEL[e.type] || 'Jugada';
}

/** Dirección por período: +1 si el local ataca a la derecha en las coordenadas crudas, -1 si a la izquierda. */
function directions(events, teamIds) {
  const dir = {};
  const periods = [...new Set(events.map((e) => e.period))];
  for (const period of periods) {
    let score = 0;
    for (const e of events) {
      if (e.period !== period || e.x == null) continue;
      if (!(e.attack || e.dangerous || DANGER_TYPES.has(e.type))) continue;
      const side = e.teamId === teamIds.home ? 1 : e.teamId === teamIds.away ? -1 : 0;
      score += side * (e.x - 50);
    }
    dir[period] = score === 0 ? null : score > 0 ? 1 : -1;
  }
  return dir;
}

/** Últimas posiciones del juego abierto en curso: se corta en el último balón parado o interrupción. */
function openPlayTrail(usable, positioned) {
  let cut = -1;
  for (let i = usable.length - 1; i >= 0; i--) {
    if (usable[i].type !== 0) {
      cut = i;
      break;
    }
  }
  const after = new Set(usable.slice(cut + 1));
  return positioned.filter((p) => after.has(p.e)).slice(-8).map((p) => p.pos);
}

/**
 * @returns {{ current, trail, side, label, player, minute, dangerous } | null}
 */
export function buildLiveView(events, { teamIds, players } = {}) {
  const usable = (events || []).filter((e) => !IGNORED_TYPES.has(e.type));
  if (!usable.length || !teamIds?.home) return null;

  const dir = directions(usable, teamIds);
  const lastKnown = Object.values(dir).filter(Boolean).pop() ?? 1;
  const toPitch = (e, x, y) => {
    if (x == null || y == null) return null;
    const d = dir[e.period] ?? lastKnown;
    const px = d === 1 ? x : 100 - x;
    const py = d === 1 ? 100 - y : y;
    return { x: (px / 100) * PITCH_W, y: (py / 100) * PITCH_H };
  };

  const positioned = usable
    .map((e) => ({ e, pos: toPitch(e, e.x, e.y), end: toPitch(e, e.x2, e.y2) }))
    .filter((p) => p.pos);

  const last = usable[usable.length - 1];
  const lastPos = positioned[positioned.length - 1];
  const side = last.teamId === teamIds.away ? 'away' : last.teamId === teamIds.home ? 'home' : null;

  let ball = lastPos?.e === last ? lastPos.pos : lastPos?.end || lastPos?.pos || { x: PITCH_W / 2, y: PITCH_H / 2 };
  // Saque de arco sin posición: el balón está en el área chica del equipo que saca
  if (last.type === 13 && last.x == null && side) ball = { x: side === 'home' ? 5.5 : PITCH_W - 5.5, y: PITCH_H / 2 };

  const target = (lastPos?.e === last && lastPos.end) || {
    x: side === 'away' ? 0 : PITCH_W,
    y: PITCH_H / 2,
  };

  const player = last.playerId ? players?.[last.playerId] : null;
  const minute = last.minute != null ? `${last.minute}'` : '';
  const kind = kindOf(last);
  const geo = side ? sceneGeometry(kind, side, ball) : null;
  const openPlay = kind === 'possession' || kind === 'attack' || kind === 'danger';

  return {
    key: last.seq ?? last.at,
    kind,
    side,
    label: labelOf(last),
    dangerous: Boolean(last.dangerous || DANGER_TYPES.has(last.type)),
    player: player ? player.shortName || player.name : null,
    minute,
    ball: geo?.ball || ball,
    target: geo?.target || target,
    // La estela solo tiene sentido en juego abierto; en balón parado ensucia la escena
    trail: openPlay ? openPlayTrail(usable, positioned) : [],
    at: last.at,
    isBreak: last.type === 17 || last.type === 19,
  };
}

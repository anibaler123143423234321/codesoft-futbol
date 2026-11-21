import { useEffect, useRef } from 'react';
import { sounds } from '../utils/soundEffects';

function cornerCount(match) {
  const row = (match?.stats?.defense || []).find(r => r.label === 'CÓRNERS GANADOS');
  return row ? (Number(row.home) || 0) + (Number(row.away) || 0) : null;
}

/**
 * Suena cuando cambia algo en el marcador: gol, tarjeta amarilla o roja, córner.
 * Es el respaldo cuando no llegan las jugadas en vivo (`quiet` lo calla para no sonar dos veces).
 * Solo compara contra la lectura anterior del mismo partido, así que al abrirlo no suena nada.
 */
export function useMatchSounds(match, { live = match?.status === 'live', quiet = false } = {}) {
  const prev = useRef(null);
  useEffect(() => {
    if (!match?.id) return;
    const now = {
      id: match.id,
      goals: (Number(match.homeTeam?.score) || 0) + (Number(match.awayTeam?.score) || 0),
      yellow: (Number(match.homeTeam?.yellowCards) || 0) + (Number(match.awayTeam?.yellowCards) || 0),
      red: (Number(match.homeTeam?.redCards) || 0) + (Number(match.awayTeam?.redCards) || 0),
      corners: cornerCount(match),
    };
    const before = prev.current;
    prev.current = now;
    if (!before || before.id !== now.id || !live || quiet) return;
    // Un solo sonido por actualización, el más importante
    if (now.goals > before.goals) sounds.playGoal();
    else if (now.red > before.red) sounds.playCard('red');
    else if (now.yellow > before.yellow) sounds.playCard('yellow');
    else if (now.corners != null && before.corners != null && now.corners > before.corners) sounds.playCorner();
  }, [match, live, quiet]);
}

// Importancia de cada tipo de jugada en vivo (el más alto suena si llegan varias juntas)
const PLAY_SOUND = {
  8: [10, () => sounds.playGoal()],
  21: [10, () => sounds.playGoal()],
  9: [9, () => sounds.playCard('red')],
  27: [9, () => sounds.playCard('red')],
  5: [8, () => sounds.playPenalty()],
  20: [8, () => sounds.playShot(true)],
  22: [8, () => sounds.playShot(false)],
  11: [7, () => sounds.playWoodwork()],
  10: [6, () => sounds.playCard('yellow')],
  1: [5, () => sounds.playShot(true)],
  15: [5, () => sounds.playVar()],
  2: [4, () => sounds.playShot(false)],
  12: [3, () => sounds.playCorner()],
  4: [3, () => sounds.playOffside()],
  16: [3, () => sounds.playPeriod('start')],
  23: [3, () => sounds.playPeriod('start')],
  17: [3, () => sounds.playPeriod('half')],
  19: [3, () => sounds.playPeriod('end')],
  6: [2, () => sounds.playSub()],
};
const rank = (e) => (e.type === 0 ? (e.dangerous ? 1 : 0) : PLAY_SOUND[e.type]?.[0] ?? 0);

/**
 * Suena con cada jugada nueva del flujo en vivo (llega antes que el marcador).
 * Lo que ya estaba al abrir el partido no suena.
 */
export function useLivePlaySounds(events, enabled) {
  const last = useRef(null);
  useEffect(() => {
    if (!enabled || !events?.length) return;
    const lastSeq = events[events.length - 1].seq;
    if (last.current == null || lastSeq < last.current) {
      // Primera lectura o la fuente reinició su contador: se toma como punto de partida
      last.current = lastSeq;
      return;
    }
    const fresh = events.filter((e) => e.seq > last.current);
    last.current = lastSeq;
    if (!fresh.length) return;
    const best = fresh.reduce((a, e) => (rank(e) > rank(a) ? e : a), fresh[0]);
    if (best.type === 0) {
      if (best.dangerous) sounds.playDanger();
      return;
    }
    PLAY_SOUND[best.type]?.[1]();
  }, [events, enabled]);
}

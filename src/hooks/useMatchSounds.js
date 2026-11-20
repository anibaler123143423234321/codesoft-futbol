import { useEffect, useRef } from 'react';
import { sounds } from '../utils/soundEffects';

function cornerCount(match) {
  const row = (match?.stats?.defense || []).find(r => r.label === 'CÓRNERS GANADOS');
  return row ? (Number(row.home) || 0) + (Number(row.away) || 0) : null;
}

/**
 * Suena cuando cambia algo en un partido en vivo: gol, tarjeta amarilla o roja, córner.
 * Solo compara contra la lectura anterior del mismo partido, así que al abrirlo no suena nada.
 */
export function useMatchSounds(match) {
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
    if (!before || before.id !== now.id || match.status !== 'live') return;
    // Un solo sonido por actualización, el más importante
    if (now.goals > before.goals) sounds.playGoal();
    else if (now.red > before.red) sounds.playCard('red');
    else if (now.yellow > before.yellow) sounds.playCard('yellow');
    else if (now.corners != null && before.corners != null && now.corners > before.corners) sounds.playCorner();
  }, [match]);
}

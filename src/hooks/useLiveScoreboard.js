import { useEffect, useMemo, useRef, useState } from 'react';

// Marcador del centro de partido: toma el resultado de la fuente en vivo cuando va adelantada a ESPN,
// arma los goleadores por equipo y avisa durante un minuto cuando entra un gol.

const FLASH_MS = 60000;

// ESPN a veces trae el minuto con el apóstrofo ya puesto ("84'" → "84''")
const minuteText = (m) => String(m || '').replace(/[’′]/g, "'").replace(/'+/g, "'").trim();

const num = (v) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

/** "Katherine Møller Kühl (con Tiro)" → { name: "K. Møller Kühl", tag: null } */
function scorerName(raw = '') {
  const notes = (raw.match(/\(([^)]*)\)/g) || []).join(' ');
  const tag = /penal|\(p\)/i.test(notes) ? 'p' : /propia|autogol|own goal|\(ag\)|\(og\)/i.test(notes) ? 'ag' : null;
  const clean = raw.replace(/\s*\([^)]*\)/g, '').trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  const name = parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : clean;
  return { name, tag };
}

function espnGoals(match) {
  return (match?.scorers || [])
    .filter((s) => s.team === 'home' || s.team === 'away')
    .map((s) => {
      const { name, tag } = scorerName(s.player || '');
      const own = /own goal/i.test(s.text || '');
      return { side: s.team, minute: minuteText(s.minute), name, tag: own ? 'ag' : tag };
    });
}

function liveGoals(data) {
  return (data?.incidents || [])
    .filter((i) => i.type === 'GOAL' && (i.side === 'home' || i.side === 'away'))
    .map((i) => {
      const { name, tag } = scorerName(i.detail || '');
      const minute = i.time || (i.minute != null ? `${i.minute}${i.extraMinute ? `+${i.extraMinute}` : ''}'` : '');
      return { side: i.side, minute: minuteText(minute), name, tag };
    });
}

/** Agrupa por jugador: [{ name, minutes: ["51'", "61'"], tag }] por lado, en orden de aparición. */
function groupBySide(goals) {
  const out = { home: [], away: [] };
  for (const g of goals) {
    const list = out[g.side];
    const key = `${g.name}|${g.tag || ''}`;
    const found = list.find((x) => x.key === key);
    if (found) found.minutes.push(g.minute);
    else list.push({ key, name: g.name, tag: g.tag, minutes: [g.minute] });
  }
  return out;
}

/**
 * @param match      partido de ESPN
 * @param liveData   useLiveOdds().data (o null)
 * @param sourceLive la fuente en vivo está respondiendo
 */
export function useLiveScoreboard(match, liveData, sourceLive) {
  const espnHome = num(match?.homeTeam?.score) ?? 0;
  const espnAway = num(match?.awayTeam?.score) ?? 0;
  const lh = sourceLive ? num(liveData?.home?.score) : null;
  const la = sourceLive ? num(liveData?.away?.score) : null;
  // La fuente en vivo suele marcar el gol antes que ESPN; si va atrasada se queda ESPN
  const useLive = lh != null && la != null && lh + la >= espnHome + espnAway;
  const home = useLive ? lh : espnHome;
  const away = useLive ? la : espnAway;

  const scorers = useMemo(() => {
    const fromEspn = espnGoals(match);
    const fromLive = sourceLive ? liveGoals(liveData) : [];
    return groupBySide(fromLive.length > fromEspn.length ? fromLive : fromEspn);
  }, [match, liveData, sourceLive]);

  const [flash, setFlash] = useState(null);
  const prev = useRef(null);
  const live = match?.status === 'live' || sourceLive;
  useEffect(() => {
    const cur = { id: match?.id, home, away };
    const before = prev.current;
    prev.current = cur;
    if (!before || before.id !== cur.id || !live) return;
    if (home > before.home) setFlash({ side: 'home', at: Date.now() });
    else if (away > before.away) setFlash({ side: 'away', at: Date.now() });
    else if (home < before.home || away < before.away) setFlash(null); // gol anulado
  }, [match?.id, home, away, live]);

  useEffect(() => {
    if (!flash) return undefined;
    const t = setTimeout(() => setFlash(null), Math.max(0, FLASH_MS - (Date.now() - flash.at)));
    return () => clearTimeout(t);
  }, [flash]);

  return { home, away, scorers, goalSide: flash?.side || null, goalKey: flash?.at || null };
}

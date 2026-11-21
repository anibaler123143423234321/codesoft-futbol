import { useEffect, useState } from 'react';
import { parseBetanoSnapshot } from '../api/betanoParser';
import { detectExtension, sharedBridgeRequest, teamsOf } from '../utils/liveBridge';

const EVERY_MS = 15000;
const HISTORY_MAX = 400;

const historyKey = (eventId) => `codesoft:odds-history:${eventId}`;
const EMPTY = { status: 'searching', data: null, history: [], previous: null, error: null };
// Último estado bueno por partido: el panel, el pick y la página de picks arrancan con datos al instante
const lastByKey = new Map();

function loadHistory(eventId) {
  try {
    return JSON.parse(sessionStorage.getItem(historyKey(eventId)) || '[]');
  } catch {
    return [];
  }
}

function saveHistory(eventId, history) {
  try {
    sessionStorage.setItem(historyKey(eventId), JSON.stringify(history));
  } catch {
    /* sin almacenamiento: el historial vive solo en memoria */
  }
}

/**
 * Cuotas y estadísticas en vivo desde la extensión, cada 15 s, más el historial
 * de probabilidades del partido (para dibujar su evolución).
 *
 * status: 'checking' | 'no-extension' | 'searching' | 'opening' | 'not-found' | 'ok' | 'error'
 */
export function useLiveOdds(match, enabled, { everyMs = EVERY_MS } = {}) {
  const [extension, setExtension] = useState(undefined); // undefined = comprobando, null = no instalada
  const teams = teamsOf(match);
  const key = `${teams.home.join('|')}::${teams.away.join('|')}::${teams.women ? 'w' : 'm'}`;
  const [state, setState] = useState(() => lastByKey.get(key) || EMPTY);

  useEffect(() => {
    let alive = true;
    detectExtension().then((v) => alive && setExtension(v));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    setState(lastByKey.get(key) || EMPTY);
  }, [key]);

  useEffect(() => {
    if (!extension || !enabled || !teams.home.length || !teams.away.length) return undefined;
    let alive = true;

    const run = async () => {
      // Compartida: si otra pantalla pidió este partido hace segundos, se reutiliza la respuesta
      const res = await sharedBridgeRequest('codesoft:odds', key, { teams }, Math.min(8000, everyMs - 1000));
      if (!alive) return;
      if (res.status !== 'ok') {
        // Mantener los últimos datos buenos si hay un fallo puntual
        setState((s) => ({ ...s, status: s.data && res.status !== 'not-found' ? 'ok' : res.status, error: res.error || null }));
        return;
      }
      try {
        const data = parseBetanoSnapshot(res.snapshot);
        setState((s) => {
          // Otra pantalla pudo haber guardado puntos nuevos: se parte del historial más largo
          const stored = loadHistory(data.eventId);
          const mine = s.data?.eventId === data.eventId ? s.history : [];
          const base = stored.length > mine.length ? stored : mine;
          const fresh = data.capturedAt !== base[base.length - 1]?.at; // la misma captura no se suma dos veces
          const point = fresh && data.impliedProbabilities && {
            at: data.capturedAt,
            t: Date.now(),
            minute: Math.round(((data.clock.seconds ?? 0) / 60) * 10) / 10,
            p: data.impliedProbabilities,
            mr: data.odds.matchResult,
          };
          const history = point ? [...base, point].slice(-HISTORY_MAX) : base;
          if (point) saveHistory(data.eventId, history);
          const changed = s.data?.odds?.matchResult &&
            JSON.stringify(s.data.odds.matchResult) !== JSON.stringify(data.odds.matchResult);
          const next = {
            status: 'ok',
            data,
            history,
            previous: changed ? s.data.odds.matchResult : s.previous,
            error: null,
          };
          lastByKey.set(key, next);
          return next;
        });
      } catch (e) {
        setState((s) => ({ ...s, status: 'error', error: e.message }));
      }
    };

    run();
    const id = setInterval(run, everyMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // key resume los nombres y el tipo de torneo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extension, enabled, key, everyMs]);

  if (extension === undefined) return { ...state, status: 'checking', extension };
  if (extension === null) return { status: 'no-extension', data: null, history: [], previous: null, error: null, extension };
  return { ...state, extension };
}

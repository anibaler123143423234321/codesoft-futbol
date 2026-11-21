import { useEffect, useRef, useState } from 'react';

const MAX = 3000;

/**
 * Registro de todas las jugadas en vivo del partido desde que se abrió. El flujo en vivo solo
 * guarda las últimas 60; acá se acumulan (compactas) para que la IA pueda leer los últimos minutos.
 */
export function useLivePlayLog(events, eventId) {
  const [log, setLog] = useState([]);
  const lastSeq = useRef(null);
  const owner = useRef(null);

  useEffect(() => {
    if (!events?.length) return;
    const top = events[events.length - 1].seq;
    // Otro partido o la fuente reinició su contador: se empieza de nuevo
    const reset = owner.current !== eventId || (lastSeq.current != null && top < lastSeq.current);
    const since = reset ? -1 : lastSeq.current ?? -1;
    owner.current = eventId;
    lastSeq.current = top;
    const fresh = events
      .filter((e) => e.seq > since)
      .map((e) => ({
        seq: e.seq,
        type: e.type,
        period: e.period,
        minute: e.minute,
        teamId: e.teamId,
        playerId: e.playerId,
        attack: Boolean(e.attack),
        dangerous: Boolean(e.dangerous),
        at: e.at,
      }));
    if (!fresh.length && !reset) return;
    setLog((cur) => (reset ? fresh : [...cur, ...fresh]).slice(-MAX));
  }, [events, eventId]);

  return log;
}

import { useEffect, useMemo, useRef, useState } from 'react';

// Jugadas con las que la casa cierra los mercados al instante
const LOCK_TYPES = {
  8: 'goal',
  21: 'goal',
  5: 'penalty',
  15: 'var',
  9: 'red',
  27: 'red',
};
// Jugadas que indican que el partido volvió a rodar
const RESTART_TYPES = new Set([23, 25]);

const MIN_MS = 8000; // antes de esto ninguna lectura reabre: la fuente puede no haber reaccionado aún
const MAX_MS = 90000; // tope si las cuotas no se mueven ni llega el saque
const FRESH_MS = 30000; // una jugada más vieja que esto (al abrir el partido) ya no bloquea

const toMs = (iso) => Date.parse(iso) || 0;

/** Firma de todas las cuotas publicadas: si cambia, la fuente ya repreció. */
function priceKey(data) {
  return (data?.markets || []).map((m) => m.selections.map((s) => s.price ?? '-').join(',')).join('|');
}

const hasPrices = (data) => (data?.markets || []).some((m) => m.selections.some((s) => s.price != null));

/**
 * Mercados suspendidos en vivo, como en la casa: se cierran apenas llega un gol, penal, VAR o roja
 * por el flujo de jugadas (segundos antes que las cuotas) y se reabren cuando la fuente publica
 * cuotas nuevas o el partido vuelve a rodar. También cuenta como suspendido cuando la fuente
 * deja todas las cuotas sin precio o retira los mercados que ya tenía.
 *
 * @returns {{ locked: boolean, by: 'play' | 'source' | null, kind?: string, side?: 'home'|'away'|null, minute?: number|null, since?: number }}
 */
export function useMarketLock(events, data) {
  const [lock, setLock] = useState(null); // { seq, kind, side, since, ref, restarted }
  const [now, setNow] = useState(() => Date.now());
  const [pricedEvent, setPricedEvent] = useState(null); // partido en el que ya se vieron cuotas
  const lastSeq = useRef(null);
  const dataRef = useRef(data);

  useEffect(() => {
    dataRef.current = data;
    if (data?.eventId != null && hasPrices(data)) setPricedEvent(data.eventId);
  }, [data]);

  // Una jugada nueva que cierra mercados
  useEffect(() => {
    if (!events?.length) {
      // Otro partido o sin conexión: se empieza de cero
      lastSeq.current = null;
      setLock(null);
      return;
    }
    const top = events[events.length - 1].seq;
    const since = lastSeq.current;
    lastSeq.current = top;
    // La fuente reinició su contador: todo cuenta como nuevo, pero solo bloquea lo reciente
    const fresh = since == null || top < since ? events : events.filter((e) => e.seq > since);
    const t = Date.now();
    const hit = [...fresh].reverse().find((e) => LOCK_TYPES[e.type] && t - (e.at || 0) < FRESH_MS);
    setLock((cur) => {
      let next = cur;
      if (hit && (!cur || hit.seq > cur.seq)) {
        const ids = dataRef.current?.teamIds || {};
        const side = hit.teamId == null ? null : hit.teamId === ids.home ? 'home' : hit.teamId === ids.away ? 'away' : null;
        next = { seq: hit.seq, kind: LOCK_TYPES[hit.type], side, minute: hit.minute ?? null, since: Math.min(t, hit.at || t), ref: priceKey(dataRef.current), restarted: false };
      }
      // Saque o reanudación posterior a la jugada que cerró
      if (next && !next.restarted && fresh.some((e) => RESTART_TYPES.has(e.type) && e.seq > next.seq)) {
        next = { ...next, restarted: true };
      }
      return next;
    });
  }, [events]);

  // Reloj mientras está cerrado: decide la reapertura aunque no lleguen datos
  useEffect(() => {
    if (!lock) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [lock]);

  // Reapertura: cuotas nuevas leídas después del cierre, partido en juego otra vez o tope de tiempo
  useEffect(() => {
    if (!lock) return;
    const elapsed = now - lock.since;
    if (elapsed < MIN_MS) return;
    const repriced = toMs(data?.capturedAt) >= lock.since + MIN_MS && hasPrices(data) && priceKey(data) !== lock.ref;
    if (repriced || lock.restarted || elapsed >= MAX_MS) setLock(null);
  }, [lock, data, now]);

  const sourceLocked = Boolean(data) && data.eventId === pricedEvent && !hasPrices(data);

  return useMemo(() => {
    if (lock) return { locked: true, by: 'play', kind: lock.kind, side: lock.side, minute: lock.minute, since: lock.since };
    if (sourceLocked) return { locked: true, by: 'source', kind: null, side: null, minute: null, since: null };
    return { locked: false, by: null };
  }, [lock, sourceLocked]);
}

import { useEffect, useRef, useState } from 'react';
import { bridgeRequest, detectExtension, teamsOf, versionAtLeast } from '../utils/liveBridge';

const EVERY_MS = 2500;
const KEEP = 60;
// Sin jugadas nuevas en este tiempo se pide todo otra vez (por si la fuente reinició su contador)
const STALL_MS = 45000;
export const PITCH_MIN_VERSION = '1.1.0';

/**
 * Jugadas en vivo (posición del balón, equipo, jugador, tipo de acción) desde la extensión.
 * Pide cada 2,5 s solo las jugadas nuevas.
 */
export function useLivePitch(match, enabled) {
  const [extension, setExtension] = useState(undefined);
  // status: 'idle' | 'connecting' | 'ok' | 'opening' | 'not-found' | 'error'
  const [state, setState] = useState({ eventId: null, events: [], connected: false, status: 'idle' });
  const seqRef = useRef(0);
  const eventRef = useRef(null);
  const sessionRef = useRef(null);
  const lastFreshRef = useRef(0);

  const teams = teamsOf(match);
  const key = `${teams.home.join('|')}::${teams.away.join('|')}::${teams.women ? 'w' : 'm'}`;
  const supported = Boolean(extension && versionAtLeast(extension.version, PITCH_MIN_VERSION));

  useEffect(() => {
    let alive = true;
    detectExtension().then((v) => alive && setExtension(v));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    seqRef.current = 0;
    eventRef.current = null;
    sessionRef.current = null;
    lastFreshRef.current = 0;
    setState({ eventId: null, events: [], connected: false, status: 'idle' });
  }, [key]);

  useEffect(() => {
    if (!supported || !enabled || !teams.home.length || !teams.away.length) return undefined;
    let alive = true;
    let busy = false;
    setState((s) => (s.status === 'idle' ? { ...s, status: 'connecting' } : s));

    const run = async () => {
      if (busy) return;
      busy = true;
      const since = seqRef.current;
      const res = await bridgeRequest('codesoft:pitch', { teams, sinceSeq: since }, 6000);
      busy = false;
      if (!alive) return;
      if (res.status !== 'ok') {
        // Conserva las jugadas ya recibidas ante un fallo puntual
        setState((s) => ({ ...s, status: s.events.length && res.status === 'error' ? s.status : res.status || 'error' }));
        return;
      }
      // Otra instancia del script en la fuente (pestaña recargada o distinta): su contador empezó de
      // nuevo, así que pedir "después de #N" no devolvería nada nunca. Se pide todo otra vez.
      const restarted =
        (res.session && sessionRef.current && res.session !== sessionRef.current) ||
        (typeof res.lastSeq === 'number' && res.lastSeq < since);
      if (res.session) sessionRef.current = res.session;
      if (restarted) {
        seqRef.current = 0;
        run();
        return;
      }
      const fresh = res.events || [];
      const now = Date.now();
      if (fresh.length || !lastFreshRef.current) lastFreshRef.current = now;
      else if (since > 0 && now - lastFreshRef.current > STALL_MS) {
        // Mucho tiempo sin jugadas: resincroniza en el próximo pedido (cubre extensiones sin `session`)
        seqRef.current = 0;
        lastFreshRef.current = now;
        return;
      }
      const sameEvent = eventRef.current === res.eventId;
      eventRef.current = res.eventId;
      if (fresh.length) seqRef.current = fresh[fresh.length - 1].seq;
      setState((s) => ({
        eventId: res.eventId,
        connected: Boolean(res.connected),
        status: 'ok',
        // Un pedido completo (desde 0) reemplaza la lista; uno incremental la extiende
        events: (since === 0 || !sameEvent ? fresh : [...s.events, ...fresh]).slice(-KEEP),
      }));
    };

    run();
    const id = setInterval(run, EVERY_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supported, enabled, key]);

  return { ...state, supported, extension };
}

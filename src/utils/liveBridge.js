// Comunicación con la extensión "CodeSoft Cuotas en Vivo" (extension/bridge.js) por window.postMessage.

let detecting = null;
let counter = 0;

/** Resuelve { version } si la extensión está instalada, o null. */
export function detectExtension(timeout = 1500) {
  if (detecting) return detecting;
  detecting = new Promise((resolve) => {
    const onMessage = (e) => {
      if (e.source !== window || e.data?.type !== 'codesoft:odds-extension') return;
      cleanup();
      resolve({ version: e.data.version || '0' });
    };
    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
    };
    window.addEventListener('message', onMessage);
    window.postMessage({ type: 'codesoft:odds-ping' }, window.location.origin);
    const timer = setTimeout(() => {
      cleanup();
      detecting = null; // volver a comprobar más tarde
      resolve(null);
    }, timeout);
  });
  return detecting;
}

/** Compara versiones "1.10.0" > "1.9.2". */
export function versionAtLeast(version, min) {
  const a = String(version).split('.').map(Number);
  const b = String(min).split('.').map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return true;
}

/** Envía `${kind}-request` y espera `${kind}-response` con el mismo requestId. */
export function bridgeRequest(kind, payload, timeout = 10000) {
  const requestId = `${Date.now()}-${++counter}`;
  return new Promise((resolve) => {
    const onMessage = (e) => {
      if (e.source !== window || e.data?.type !== `${kind}-response` || e.data.requestId !== requestId) return;
      cleanup();
      resolve(e.data);
    };
    const cleanup = () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
    };
    window.addEventListener('message', onMessage);
    window.postMessage({ type: `${kind}-request`, requestId, ...payload }, window.location.origin);
    const timer = setTimeout(() => {
      cleanup();
      resolve({ status: 'error', error: 'La extensión no respondió a tiempo.' });
    }, timeout);
  });
}

/** Nombres del partido que se envían a la extensión para encontrarlo en la fuente. */
export function teamsOf(match) {
  return {
    home: [match?.homeTeam?.name, match?.homeTeam?.shortName].filter(Boolean),
    away: [match?.awayTeam?.name, match?.awayTeam?.shortName].filter(Boolean),
    women: Boolean(match?.isWomen),
  };
}

/**
 * Si conviene seguir pidiendo datos en vivo a la extensión. La fuente puede seguir jugando
 * (tiempo añadido) cuando ESPN ya marca el partido como terminado: se sigue mirando hasta
 * 3 h después del inicio, y la extensión responde "not-found" en cuanto el partido sale de la fuente.
 */
export function shouldWatchSource(match) {
  if (!match) return false;
  if (match.status === 'live' || match.rawEspnStatus?.state === 'in') return true;
  const finished = match.status === 'finished' || match.rawEspnStatus?.state === 'post';
  const kickoff = Date.parse(match.rawDate || '');
  return finished && Number.isFinite(kickoff) && Date.now() - kickoff < 3 * 3600 * 1000;
}

const sharedRequests = new Map();

/** Como bridgeRequest, pero quienes piden lo mismo dentro de `maxAge` ms comparten la respuesta. */
export function sharedBridgeRequest(kind, key, payload, maxAge = 8000, timeout) {
  const id = `${kind}::${key}`;
  const hit = sharedRequests.get(id);
  if (hit && Date.now() - hit.at < maxAge) return hit.promise;
  const promise = bridgeRequest(kind, payload, timeout);
  sharedRequests.set(id, { at: Date.now(), promise });
  return promise;
}

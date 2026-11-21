/*
 * Captura en vivo de Betano — pegar en la consola (DevTools) con la página
 * del partido abierta, por ejemplo:
 *   https://www.betano.pe/live/manchester-city-fulham/94991437/
 *
 * Por qué en el navegador: Cloudflare responde 403 a peticiones que no vienen
 * de un navegador real (curl, Node, funciones de Netlify). Desde la propia
 * página las llamadas son same-origin y funcionan con tu sesión normal.
 *
 * Dos modos:
 *  - Conectado: si abriste Betano con el botón "Abrir Betano" de CodeSoft, esta
 *    pestaña envía el partido a la app cada 15 s (postMessage). Puedes cambiar de
 *    partido dentro de Betano y la app recibe el nuevo.
 *  - Archivo: si abriste Betano por tu cuenta, descarga betano_{id}_{hora}.json
 *    para importarlo en la app o convertirlo con: node scripts/betano-to-app.mjs
 *
 * window.BETANO_EVERY = 30 antes de pegarlo cambia el intervalo (0 = una sola vez).
 * Para parar: clearInterval(window.__betanoTimer)
 */
(async () => {
  const headers = { 'X-Operator': '12', 'X-Language': '8', Accept: 'application/json' };
  const app = window.opener && !window.opener.closed ? window.opener : null;
  const every = window.BETANO_EVERY ?? (app ? 15 : 0);
  let lastWarning = '';

  const warnOnce = (msg) => {
    if (msg !== lastWarning) console.warn(msg);
    lastWarning = msg;
  };

  async function capture() {
    const eventId = (location.pathname.match(/\/(\d{6,})\/?$/) || [])[1];
    if (!eventId) return warnOnce('CodeSoft: abre un partido en vivo de Betano (URL terminada en /ID/).');

    const [live, statsstream] = await Promise.all([
      fetch(`/danae-webapi/api/live/events/${eventId}/latest`, { headers }).then((r) => r.json()),
      fetch(`/api/statsstream/${eventId}/info/aggregated/?lang=es`).then((r) => r.json()).catch(() => null),
    ]);
    if (!live?.event) return warnOnce(`CodeSoft: Betano no devolvió el evento ${eventId} (¿terminó el partido?).`);
    lastWarning = '';

    const snapshot = { fuente: 'betano.pe', capturadoEn: new Date().toISOString(), eventId: Number(eventId), live, statsstream };
    const s = live.event.liveData?.score || {};

    if (app && !app.closed) {
      app.postMessage({ type: 'codesoft:betano-snapshot', snapshot }, '*');
      console.log(`CodeSoft ← Betano ${eventId}: ${s.home}-${s.away} (${new Date().toLocaleTimeString()})`);
      return;
    }
    const stamp = snapshot.capturadoEn.replace(/[:.]/g, '-');
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `betano_${eventId}_${stamp}.json` });
    a.click();
    URL.revokeObjectURL(a.href);
    console.log(`CodeSoft: Betano ${eventId} ${s.home}-${s.away} — descargado ${a.download}`);
  }

  clearInterval(window.__betanoTimer);
  await capture();
  if (every > 0) {
    window.__betanoTimer = setInterval(() => capture().catch((e) => warnOnce(`CodeSoft: ${e.message}`)), every * 1000);
    console.log(`CodeSoft: ${app ? 'conectado, enviando' : 'descargando'} cada ${every}s. Para parar: clearInterval(window.__betanoTimer)`);
  }
})();

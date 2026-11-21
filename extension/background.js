// Recibe pedidos de la app (bridge.js) y los resuelve en una pestaña de la fuente (source.js).
// Si no hay ninguna pestaña abierta, abre una en segundo plano y responde "opening";
// el siguiente pedido de la app ya la encuentra lista.
const SOURCE_URL = 'https://www.betano.pe/live/';
const ROUTES = { 'codesoft:request': 'codesoft:capture', 'codesoft:pitch': 'codesoft:pitch' };
let openingSince = 0;
// Siempre la misma pestaña: cada pestaña tiene su propio contador de jugadas y saltar entre ellas
// (por ejemplo si abrís otro partido en la fuente) dejaría a la app esperando números que no llegan
let sourceTabId = null;

async function getSourceTab() {
  if (sourceTabId != null) {
    const kept = await chrome.tabs.get(sourceTabId).catch(() => null);
    if (kept && kept.url?.startsWith('https://www.betano.pe/')) return kept.status === 'complete' ? kept : null;
    sourceTabId = null;
  }
  const tabs = await chrome.tabs.query({ url: 'https://www.betano.pe/*' });
  const ready = tabs.find((t) => t.status === 'complete');
  if (ready) {
    sourceTabId = ready.id;
    return ready;
  }
  if (tabs.length) return null; // cargando
  if (Date.now() - openingSince > 30000) {
    openingSince = Date.now();
    await chrome.tabs.create({ url: SOURCE_URL, active: false });
  }
  return null;
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  const route = ROUTES[msg?.type];
  if (!route) return undefined;
  (async () => {
    const tab = await getSourceTab();
    if (!tab) return sendResponse({ status: 'opening' });
    try {
      const res = await chrome.tabs.sendMessage(tab.id, { type: route, teams: msg.teams, sinceSeq: msg.sinceSeq });
      sendResponse(res || { status: 'error', error: 'Sin respuesta de la pestaña de datos.' });
    } catch {
      // La pestaña existe pero el script aún no se inyectó (por ejemplo, recién instalada o actualizada la extensión)
      chrome.tabs.reload(tab.id);
      sendResponse({ status: 'opening' });
    }
  })();
  return true;
});

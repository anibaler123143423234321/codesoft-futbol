// Puente entre la página de CodeSoft y la extensión (solo mensajes de la misma ventana).
const ROUTES = {
  'codesoft:odds-request': { runtime: 'codesoft:request', reply: 'codesoft:odds-response' },
  'codesoft:pitch-request': { runtime: 'codesoft:pitch', reply: 'codesoft:pitch-response' },
};

const announce = () =>
  window.postMessage({ type: 'codesoft:odds-extension', version: chrome.runtime.getManifest().version }, location.origin);

window.addEventListener('message', (event) => {
  if (event.source !== window || event.origin !== location.origin) return;
  const data = event.data || {};

  if (data.type === 'codesoft:odds-ping') return announce();
  const route = ROUTES[data.type];
  if (!route) return;

  chrome.runtime.sendMessage({ type: route.runtime, teams: data.teams, sinceSeq: data.sinceSeq }, (res) => {
    const reply = chrome.runtime.lastError
      ? { status: 'error', error: chrome.runtime.lastError.message }
      : res || { status: 'error', error: 'Sin respuesta.' };
    window.postMessage({ type: route.reply, requestId: data.requestId, ...reply }, location.origin);
  });
});

announce();

// Corre dentro de la pestaña de la fuente de datos. Usa los mismos endpoints y el mismo
// canal de jugadas en vivo que la propia página, desde tu sesión normal del navegador.
const HEADERS = { 'X-Operator': '12', 'X-Language': '8', Accept: 'application/json' };
const OVERVIEW = '/danae-webapi/api/live/overview/latest?includeVirtuals=false&queryLanguageId=8&queryOperatorId=12';
const HUB_URL = `wss://${location.host}/sbpitches/statsstream/matchhub`;
const RS = '\u001e'; // separador de mensajes SignalR
let overview = { at: 0, events: [] };

async function liveFootball() {
  if (Date.now() - overview.at < 30000) return overview.events;
  const json = await fetch(OVERVIEW, { headers: HEADERS }).then((r) => r.json());
  overview = { at: Date.now(), events: Object.values(json.events || {}).filter((e) => e.sportId === 'FOOT') };
  return overview.events;
}

const WOMEN = /\b(w|women|fem|femenino|femenina|ladies|feminino)\b/i;

const normalize = (name = '') =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/\b(fc|cf|afc|sc|ss|us|as|ac|cd|ca|cs|sv|fk|nk|hnk|club|de|the|women|w|fem|femenino|femenina)\b/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function sameTeam(a, b) {
  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return false;
  if (x === y || x.includes(y) || y.includes(x)) return true;
  const fx = x.split(' ')[0];
  return fx.length > 3 && fx === y.split(' ')[0];
}

function findEvent(events, teams) {
  return events.find((e) => {
    const home = e.participants?.find((p) => p.isHome)?.name;
    const away = e.participants?.find((p) => !p.isHome)?.name;
    if (!home || !away) return false;
    const women = WOMEN.test(home) || WOMEN.test(away);
    if (Boolean(teams.women) !== women) return false;
    return teams.home.some((n) => sameTeam(n, home)) && teams.away.some((n) => sameTeam(n, away));
  });
}

async function capture(teams) {
  const ev = findEvent(await liveFootball(), teams);
  if (!ev) return { status: 'not-found' };
  const [live, statsstream] = await Promise.all([
    fetch(`/danae-webapi/api/live/events/${ev.id}/latest`, { headers: HEADERS }).then((r) => r.json()),
    fetch(`/api/statsstream/${ev.id}/info/aggregated/?lang=es`).then((r) => r.json()).catch(() => null),
  ]);
  if (!live?.event) return { status: 'not-found' };
  return {
    status: 'ok',
    snapshot: { capturadoEn: new Date().toISOString(), eventId: ev.id, live, statsstream },
  };
}

// ---------- Jugadas en vivo (balón, equipo, jugador, tipo de acción) ----------
const hub = { eventId: null, ws: null, events: [], seq: 0, lastUse: 0 };
// Identifica esta instancia del script: si la pestaña se recarga, el contador de jugadas vuelve a 0
// y la app tiene que pedir todo de nuevo en vez de esperar números que ya no llegarán
const SESSION = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function compact(d) {
  const ed = d?.event_data || {};
  const bp = ed.ball_position;
  const hasPos = bp && !(bp.x === 100 && bp.y === 100); // 100/100 = sin posición
  return {
    type: d?.event_type ?? 0,
    period: d?.event_period_id ?? null,
    minute: d?.event_match_minute ?? null,
    second: d?.event_match_second ?? null,
    teamId: ed.team_id || null,
    playerId: ed.player_id || null,
    x: hasPos ? bp.x : null,
    y: hasPos ? bp.y : null,
    x2: ed.ball_position_end?.x ?? null,
    y2: ed.ball_position_end?.y ?? null,
    possession: Boolean(ed.is_possession),
    attack: Boolean(ed.is_attack),
    dangerous: Boolean(ed.is_dangerous_attack),
  };
}

function push(raw) {
  hub.events.push({ seq: ++hub.seq, at: Date.now(), ...compact(raw) });
  if (hub.events.length > 120) hub.events.shift();
}

function closeHub() {
  try {
    hub.ws?.close();
  } catch {
    /* ya cerrado */
  }
  hub.ws = null;
}

function openHub(eventId) {
  closeHub();
  hub.eventId = eventId;
  hub.events = [];
  const ws = new WebSocket(HUB_URL);
  hub.ws = ws;
  ws.onopen = () => ws.send(JSON.stringify({ protocol: 'json', version: 1 }) + RS);
  ws.onmessage = (e) => {
    for (const part of String(e.data).split(RS)) {
      if (!part) continue;
      let m;
      try {
        m = JSON.parse(part);
      } catch {
        continue;
      }
      if (!('type' in m)) {
        // Respuesta al handshake: suscribirse al partido
        ws.send(JSON.stringify({ type: 1, invocationId: '1', target: 'Subscribe', arguments: [String(eventId)] }) + RS);
      } else if (m.type === 3 && m.result?.data) {
        push(m.result.data); // estado actual al suscribirse
      } else if (m.type === 1 && m.target === 'MatchEvent') {
        for (const a of m.arguments || []) {
          try {
            push(typeof a === 'string' ? JSON.parse(a) : a);
          } catch {
            /* mensaje mal formado */
          }
        }
      } else if (m.type === 7) {
        closeHub();
      }
    }
  };
  // Ping de SignalR cada 15 s, como hace el cliente oficial, para que el servidor no corte la conexión
  const ping = setInterval(() => {
    if (ws.readyState === 1) ws.send(JSON.stringify({ type: 6 }) + RS);
  }, 15000);
  ws.onclose = () => {
    clearInterval(ping);
    if (hub.ws === ws) hub.ws = null;
  };
}

function ensureHub(eventId) {
  hub.lastUse = Date.now();
  if (hub.eventId === eventId && hub.ws && hub.ws.readyState <= 1) return;
  openHub(eventId);
}

// Cerrar la conexión si la app deja de pedir jugadas durante un minuto
setInterval(() => {
  if (hub.ws && Date.now() - hub.lastUse > 60000) {
    closeHub();
    hub.eventId = null;
  }
}, 15000);

async function pitch(teams, sinceSeq = 0) {
  const ev = findEvent(await liveFootball(), teams);
  if (!ev) return { status: 'not-found' };
  ensureHub(ev.id);
  return {
    status: 'ok',
    eventId: ev.id,
    session: SESSION,
    lastSeq: hub.seq,
    connected: Boolean(hub.ws && hub.ws.readyState === 1),
    events: hub.eventId === ev.id ? hub.events.filter((e) => e.seq > sinceSeq) : [],
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  let job = null;
  if (msg?.type === 'codesoft:capture') job = capture(msg.teams);
  else if (msg?.type === 'codesoft:pitch') job = pitch(msg.teams, msg.sinceSeq);
  if (!job) return undefined;
  job.then(sendResponse).catch((e) => sendResponse({ status: 'error', error: e.message }));
  return true;
});

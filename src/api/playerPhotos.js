/**
 * Fotos de jugadores.
 *
 * ESPN solo trae foto de unos pocos jugadores, así que el resto se busca en
 * TheSportsDB (recortes oficiales con fondo transparente). Su API gratuita
 * admite ~30 peticiones por minuto: las búsquedas van en una cola, una cada
 * 3 s, con los titulares primero, y cada resultado (también "sin foto")
 * se guarda en este navegador para no volver a pedirlo.
 *
 * La clave "123" es la pública de prueba de TheSportsDB; con una clave propia
 * se define VITE_THESPORTSDB_KEY en .env.
 */

const API_KEY = import.meta.env.VITE_THESPORTSDB_KEY || '123';
const SEARCH_URL = `https://www.thesportsdb.com/api/v1/json/${API_KEY}/searchplayers.php?p=`;
const STORE_KEY = 'cs_player_photos_v1';
const HIT_TTL = 30 * 864e5;   // una foto encontrada vale 30 días
const MISS_TTL = 7 * 864e5;   // "sin foto" se vuelve a intentar en 7 días
const GAP_MS = 3000;          // 20 peticiones por minuto, por debajo del límite gratuito
const RETRY_STEP_MS = 15000;  // tras un error se espera 15 s, 30 s, 45 s
const MAX_TRIES = 4;
const MAX_ENTRIES = 800;

const STOP_WORDS = new Set(['fc', 'cf', 'cd', 'ca', 'club', 'de', 'del', 'la', 'el', 'sc', 'ud', 'rcd', 'real', 'afc', 'ac', 'as', 'ss', 'sd', 'fk', 'sk', 'sv', 'the', 'city', 'united', 'women', 'femenino']);

export const normName = (s = '') => s
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9 ]/g, ' ')
  .replace(/\s+/g, ' ').trim();

const teamTokens = (s) => new Set(normName(s).split(' ').filter((t) => t.length >= 3 && !STOP_WORDS.has(t)));
const sameTeam = (a, b) => {
  const A = teamTokens(a);
  for (const t of teamTokens(b)) if (A.has(t)) return true;
  return false;
};

const keyOf = (name, team) => `${normName(name)}|${normName(team)}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let cache = (() => {
  try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; }
})();
let saveTimer = null;
function persist() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      const entries = Object.entries(cache).sort((a, b) => b[1].t - a[1].t).slice(0, MAX_ENTRIES);
      cache = Object.fromEntries(entries);
      localStorage.setItem(STORE_KEY, JSON.stringify(cache));
    } catch { /* almacenamiento lleno o bloqueado: se sigue sin caché */ }
  }, 500);
}

/** undefined = aún no se sabe; null = no hay foto; string = URL base de la foto */
export function cachedPlayerPhoto(name, team) {
  if (!name) return null;
  const hit = cache[keyOf(name, team)];
  if (!hit) return undefined;
  return Date.now() - hit.t > (hit.u ? HIT_TTL : MISS_TTL) ? undefined : hit.u;
}

async function lookup(name, team) {
  const res = await fetch(SEARCH_URL + encodeURIComponent(name.trim().replace(/\s+/g, '_')));
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const last = normName(name).split(' ').pop();
  const candidates = (data.player || []).filter((p) => p.strSport === 'Soccer' && normName(p.strPlayer).includes(last));
  // Mismo nombre y mismo club; si no hay club que coincida, solo se acepta un homónimo único y exacto
  const pick = candidates.find((p) => team && sameTeam(p.strTeam, team))
    || (candidates.length === 1 && normName(candidates[0].strPlayer) === normName(name) ? candidates[0] : null);
  return pick?.strCutout || pick?.strThumb || null;
}

const queue = [];
const inflight = new Map();
let running = false;
let pausedUntil = 0;

async function pump() {
  if (running) return;
  running = true;
  while (queue.length) {
    const wait = pausedUntil - Date.now();
    if (wait > 0) await sleep(wait);
    const job = queue.shift();
    try {
      const url = await lookup(job.name, job.team);
      cache[job.key] = { u: url, t: Date.now() };
      persist();
      job.resolve(url);
    } catch {
      // El 429 de TheSportsDB llega sin cabeceras CORS y el navegador lo ve como error de red:
      // se frena la cola y se reintenta; si sigue fallando, no se guarda nada y se prueba en otra visita
      job.tries = (job.tries || 0) + 1;
      if (job.tries < MAX_TRIES) {
        pausedUntil = Date.now() + RETRY_STEP_MS * job.tries;
        queue.unshift(job);
        continue;
      }
      job.resolve(null);
    }
    await sleep(GAP_MS);
  }
  running = false;
}

/** Pide la foto de un jugador. priority: 2 titulares en cancha, 1 suplentes, 0 resto. */
export function fetchPlayerPhoto(name, team, priority = 0) {
  if (!name) return Promise.resolve(null);
  const known = cachedPlayerPhoto(name, team);
  if (known !== undefined) return Promise.resolve(known);
  const key = keyOf(name, team);
  if (inflight.has(key)) {
    const queued = queue.find((j) => j.key === key);
    if (queued && priority > queued.priority) {
      queued.priority = priority;
      queue.sort((a, b) => b.priority - a.priority);
    }
    return inflight.get(key);
  }
  const promise = new Promise((resolve) => {
    queue.push({ key, name, team, priority, resolve });
    queue.sort((a, b) => b.priority - a.priority);
    pump();
  }).finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

/** URL con el tamaño adecuado (px = píxeles reales necesarios): TheSportsDB sirve 100 px (/tiny) y 200 px (/small). */
export function sizedPhoto(url, px) {
  if (!url) return null;
  if (url.includes('thesportsdb.com')) return `${url}/${px > 100 ? 'small' : 'tiny'}`;
  return url;
}

export const isCutout = (url) => Boolean(url && url.includes('thesportsdb.com') && url.includes('/cutout/'));

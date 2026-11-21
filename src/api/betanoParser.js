/**
 * Parser de datos en vivo de Betano (betano.pe).
 *
 * Betano expone dos endpoints JSON internos que usa su propia página de partido:
 *   - /danae-webapi/api/live/events/{eventId}/latest   (cabeceras X-Operator: 12, X-Language: 8)
 *       → marcador, reloj, xG, córners, tarjetas, incidencias, alineaciones y cuotas
 *   - /api/statsstream/{eventId}/info/aggregated/?lang=es
 *       → ficha del partido (ids Opta, colores, jugadores en cancha)
 *
 * Cloudflare bloquea (403) cualquier petición que no venga de un navegador real,
 * así que la captura se hace desde el navegador con scripts/betano-capture.js
 * y este módulo solo transforma el JSON crudo al formato de la app.
 */

const SIDE = { 0: 'home', 1: 'away' };

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Extrae el eventId de una URL tipo https://www.betano.pe/live/equipo-a-equipo-b/94991437/ */
export function betanoEventIdFromUrl(url) {
  const m = String(url).match(/\/(\d{6,})\/?(?:[?#].*)?$/);
  return m ? Number(m[1]) : null;
}

function formatClock(seconds, injuryTime) {
  if (seconds == null) return null;
  const minute = Math.floor(seconds / 60);
  if (minute >= 90 && injuryTime) return `90'+${Math.min(minute - 90 + 1, injuryTime)}'`;
  return `${minute + 1}'`;
}

function buildPlayerIndex(roster) {
  const index = {};
  for (const side of ['homeRoster', 'awayRoster']) {
    const players = roster?.[side]?.players || {};
    for (const p of Object.values(players)) {
      index[p.id] = {
        id: p.id,
        name: p.name,
        shortName: p.shortName,
        number: p.shirtNumber ?? null,
        position: p.position ?? null, // GK | DF | MF | FW
        captain: Boolean(p.isCaptain),
        side: side === 'homeRoster' ? 'home' : 'away',
      };
    }
  }
  for (const p of Object.values(roster?.unknownPlayers || {})) {
    index[p.unknownPlayerId] = {
      id: p.unknownPlayerId,
      name: p.name,
      shortName: p.name,
      number: p.shirtNumber ?? null,
      position: p.position ?? null,
      captain: false,
    };
  }
  return index;
}

/**
 * Jugadores con los ids que usa el flujo de jugadas en vivo (distintos a los del roster de cuotas).
 * Sale de statsstream: lineups.{home,away}.{on_pitch,substitutes} = [{ id, name }].
 */
function buildLivePlayerIndex(lineups) {
  const index = {};
  for (const side of ['home', 'away']) {
    const team = lineups?.[side];
    for (const list of [team?.on_pitch, team?.substitutes]) {
      for (const p of list || []) {
        if (p?.id && p.name) index[p.id] = { id: p.id, name: p.name, shortName: p.name, side };
      }
    }
  }
  return index;
}

function buildTeam(side, { participants, liveData, roster, players }) {
  const isHome = side === 'home';
  const participant = participants.find((p) => Boolean(p.isHome) === isHome) || {};
  const lineupRaw = roster?.lineups?.[isHome ? 'homeLineup' : 'awayLineup'];
  const subsRaw = roster?.subs?.[isHome ? 'homeSubs' : 'awaySubs'] || [];
  const results = liveData?.results || {};
  const resolve = (entry) => {
    const id = entry.playerId ?? entry.unknownPlayerId;
    return { ...(players[id] || { id, name: entry.name, shortName: entry.name }), shortName: entry.name };
  };

  return {
    id: participant.teamId ?? lineupRaw?.teamId ?? null,
    name: participant.name ?? null,
    color: participant.color ?? null,
    score: num(liveData?.score?.[side]) ?? 0,
    formation: lineupRaw?.formation ?? null,
    // Filas de la cancha: [portero], [defensas], [medios], ..., [delanteros]
    lineup: (lineupRaw?.lineup || []).map((row) => row.map(resolve)),
    bench: (lineupRaw?.benchPlayers || []).map((b) => ({ ...resolve(b), subbedIn: Boolean(b.subbedIn) })),
    substitutions: subsRaw.map((s) => ({
      minute: s.substitutedOnMinute,
      in: s.playerIn?.name,
      out: s.playerOut?.name,
    })),
    stats: {
      xG: num(results.xGoals?.[side]),
      shots: num(results.shots?.[side]),
      corners: num(results.corners?.[side]),
      yellowCards: num(results.yellow?.[side]),
      redCards: num(results.red?.[side]) ?? 0,
    },
  };
}

function parseIncidents(incidents = []) {
  return incidents.map((i) => ({
    type: i.type, // GOAL, YELL, RED, CRNR, SUBS, OFFS, SVAR/EVAR, PEND, PBEG, StoppageTime, Aggregated...
    minute: i.props?.minute ?? null,
    extraMinute: i.props?.overtimeMinute ?? null,
    time: i.time ?? null,
    side: SIDE[i.teamSide] ?? null,
    title: i.props?.title ?? i.description,
    detail: i.props?.description ?? null,
    text: i.description,
    ...(i.type === 'GOAL' ? { scoreHome: i.props?.scoreHome, scoreAway: i.props?.scoreAway } : {}),
    ...(i.type === 'SUBS' ? { playerIn: i.props?.playerIn, playerOut: i.props?.playerOut } : {}),
  }));
}

// La fuente puede marcar un mercado o una opción como cerrados sin quitar la cuota.
// Cualquiera de estas marcas deja la opción sin precio, y el tablero la muestra con candado.
const CLOSED_FLAGS = ['isSuspended', 'suspended', 'isLocked', 'locked', 'isBlocked', 'blocked', 'isClosed', 'closed'];
const OPEN_FLAGS = ['isOpen', 'open', 'isActive', 'active', 'isAvailable', 'available'];
const isClosed = (o) =>
  CLOSED_FLAGS.some((k) => o?.[k] === true) ||
  OPEN_FLAGS.some((k) => o?.[k] === false) ||
  /^(suspend|lock|block|clos)/i.test(String(o?.status ?? o?.state ?? ''));

// Campos ya conocidos de la fuente. Uno nuevo se anota (en la consola de desarrollo y en
// localStorage 'codesoft:source-fields') para descubrir cómo marca la suspensión en un gol real.
const KNOWN_FIELDS = {
  market: new Set(['displayOrder', 'id', 'name', 'selectionIdList', 'type', 'handicap']),
  selection: new Set(['displayOrder', 'fullName', 'id', 'name', 'price', 'handicap']),
};
const FIELDS_KEY = 'codesoft:source-fields';
const noted = new Set();

function noteNewFields(kind, obj) {
  for (const k of Object.keys(obj || {})) {
    if (KNOWN_FIELDS[kind].has(k) || noted.has(`${kind}.${k}`)) continue;
    noted.add(`${kind}.${k}`);
    const sample = typeof obj[k] === 'object' ? JSON.stringify(obj[k]).slice(0, 120) : obj[k];
    if (import.meta.env?.DEV) console.info(`[cuotas] campo nuevo en ${kind}: ${k} =`, sample, obj);
    try {
      const log = JSON.parse(localStorage.getItem(FIELDS_KEY) || '{}');
      if (!log[`${kind}.${k}`]) {
        log[`${kind}.${k}`] = { sample, at: new Date().toISOString() };
        localStorage.setItem(FIELDS_KEY, JSON.stringify(log));
      }
    } catch {
      /* sin almacenamiento: queda solo el aviso en consola */
    }
  }
}

function parseMarkets(markets = {}, selections = {}) {
  return Object.values(markets)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((m) => {
      noteNewFields('market', m);
      const marketClosed = isClosed(m);
      return {
        id: m.id,
        name: m.name,
        type: m.type,
        line: m.handicap ?? null,
        selections: (m.selectionIdList || [])
          .map((id) => selections[id])
          .filter(Boolean)
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((s) => {
            noteNewFields('selection', s);
            const closed = marketClosed || isClosed(s) || !(Number(s.price) > 1);
            return { id: s.id, name: s.name, label: s.fullName, price: closed ? null : s.price, line: s.handicap ?? null, ...(closed ? { suspended: true } : {}) };
          }),
      };
    });
}

/** Cuotas clave en un formato plano y fácil de pintar. */
function pickMainOdds(markets) {
  const byType = (type) => markets.find((m) => m.type === type);
  const out = {};

  const mres = byType('MRES');
  if (mres) {
    const [home, draw, away] = mres.selections;
    out.matchResult = { home: home?.price ?? null, draw: draw?.price ?? null, away: away?.price ?? null };
  }
  const goals = byType('HCTG');
  if (goals) {
    out.totalGoals = {
      line: goals.line,
      over: goals.selections.find((s) => /^Más/i.test(s.name))?.price ?? null,
      under: goals.selections.find((s) => /^Menos/i.test(s.name))?.price ?? null,
    };
  }
  const next = byType('INTS');
  if (next) {
    out.nextGoal = {
      market: next.name,
      home: next.selections[0]?.price ?? null,
      none: next.selections[1]?.price ?? null,
      away: next.selections[2]?.price ?? null,
    };
  }
  const cards = byType('TCOU');
  if (cards) {
    out.totalCards = {
      line: cards.line,
      over: cards.selections[0]?.price ?? null,
      under: cards.selections[1]?.price ?? null,
    };
  }
  return out;
}

/** Probabilidad implícita normalizada (sin margen de la casa) del 1X2. */
function impliedProbabilities(matchResult) {
  if (!matchResult?.home || !matchResult?.draw || !matchResult?.away) return null;
  const inv = [1 / matchResult.home, 1 / matchResult.draw, 1 / matchResult.away];
  const total = inv.reduce((a, b) => a + b, 0);
  const pct = (x) => Math.round((x / total) * 1000) / 10;
  return { home: pct(inv[0]), draw: pct(inv[1]), away: pct(inv[2]), bookMargin: Math.round((total - 1) * 1000) / 10 };
}

/**
 * Convierte la captura cruda de Betano al formato de la app.
 * @param {{ live: object, statsstream?: object, capturadoEn?: string }} snapshot
 */
export function parseBetanoSnapshot(snapshot) {
  const live = snapshot?.live;
  const ev = live?.event;
  if (!ev) throw new Error('Captura de Betano sin "live.event": el partido no está en vivo o faltaron las cabeceras X-Operator/X-Language.');

  const liveData = ev.liveData || {};
  const players = buildPlayerIndex(ev.roster);
  const ctx = { participants: ev.participants || [], liveData, roster: ev.roster, players };
  const markets = parseMarkets(live.markets, live.selections);
  const odds = pickMainOdds(markets);
  const match = snapshot.statsstream?.data?.match || {};
  const seconds = liveData.clock?.secondsSinceStart ?? null;

  return {
    source: 'betano',
    capturedAt: snapshot.capturadoEn || new Date(live.syncedAtUtc || Date.now()).toISOString(),
    eventId: ev.id,
    url: ev.url ? `https://www.betano.pe${ev.url}` : null,
    league: live.league?.name ?? match.league_name ?? null,
    country: live.zone?.name ?? null,
    kickoff: ev.startTime ? new Date(ev.startTime).toISOString() : match.date ?? null,
    isLive: Boolean(ev.isLive),
    period: match.current_period ?? null,
    clock: { seconds, display: formatClock(seconds, liveData.results?.injuryTime), injuryTime: liveData.results?.injuryTime ?? null },
    home: { ...buildTeam('home', ctx), code: match.home_team_code ?? null },
    away: { ...buildTeam('away', ctx), code: match.away_team_code ?? null },
    scorers: (liveData.results?.scorers || []).map((s) => ({ side: s.isHome ? 'home' : 'away', text: s.description })),
    incidents: parseIncidents(ev.incidents),
    odds,
    impliedProbabilities: impliedProbabilities(odds.matchResult),
    markets,
    pitchAvailable: Boolean(ev.isPitchAvailable),
    externalIds: { betradar: ev.betradarMatchId ?? null, opta: match.id ?? null },
    // Ids de equipo que usa el flujo de jugadas en vivo y jugadores por id (para nombrar al protagonista)
    teamIds: { home: match.home_team_id ?? null, away: match.away_team_id ?? null },
    teamColors: { home: match.home_team_color ?? null, away: match.away_team_color ?? null },
    players: { ...players, ...buildLivePlayerIndex(snapshot.statsstream?.data?.lineups) },
  };
}

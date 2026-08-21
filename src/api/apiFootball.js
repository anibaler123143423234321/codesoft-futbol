// API-Football Integration (v3.football.api-sports.io)
// 100 requests/day free tier - Used ONLY on-demand when user opens a match detail
// Cached in localStorage for 30 minutes to maximize coverage

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const CACHE_PREFIX = 'apifb_';

function getCached(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) {
      localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return data;
  } catch { return null; }
}

function setCache(key, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

/**
 * Search for a match in API-Football by team names and date
 * Returns fixture ID for further queries
 */
async function searchFixture(homeTeamName, awayTeamName, date) {
  const cacheKey = `search_${homeTeamName}_${awayTeamName}_${date}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    // Search by date - costs 1 request
    const dateStr = date || new Date().toISOString().split('T')[0];
    const res = await fetch(`/api/football/fixtures?date=${dateStr}`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) return null;
    const data = await res.json();
    const fixtures = data.response || [];

    // Find matching fixture by team name similarity
    const normalize = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const homeNorm = normalize(homeTeamName);
    const awayNorm = normalize(awayTeamName);

    const match = fixtures.find(f => {
      const fHome = normalize(f.teams?.home?.name);
      const fAway = normalize(f.teams?.away?.name);
      return (fHome.includes(homeNorm) || homeNorm.includes(fHome) || fAway.includes(awayNorm) || awayNorm.includes(fAway));
    });

    if (match) {
      setCache(cacheKey, match);
      return match;
    }

    return null;
  } catch (err) {
    console.warn('[API-Football] Search error:', err);
    return null;
  }
}

/**
 * Fetch detailed match statistics from API-Football
 * Costs 1 request - cached for 30 min
 */
export async function fetchApiFootballStats(fixtureId) {
  if (!fixtureId) return null;
  
  const cacheKey = `stats_${fixtureId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`/api/football/fixtures/statistics?fixture=${fixtureId}`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) return null;
    const data = await res.json();
    const teams = data.response || [];

    if (teams.length < 2) return null;

    const result = parseApiFootballStats(teams);
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.warn('[API-Football] Stats error:', err);
    return null;
  }
}

/**
 * Fetch match events (goals with real names, cards, subs) from API-Football
 * Costs 1 request - cached for 30 min
 */
export async function fetchApiFootballEvents(fixtureId) {
  if (!fixtureId) return null;

  const cacheKey = `events_${fixtureId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`/api/football/fixtures/events?fixture=${fixtureId}`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) return null;
    const data = await res.json();
    const events = data.response || [];

    const result = parseApiFootballEvents(events);
    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.warn('[API-Football] Events error:', err);
    return null;
  }
}

/**
 * Fetch lineups from API-Football
 * Costs 1 request - cached for 30 min
 */
export async function fetchApiFootballLineups(fixtureId) {
  if (!fixtureId) return null;

  const cacheKey = `lineups_${fixtureId}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  try {
    const res = await fetch(`/api/football/fixtures/lineups?fixture=${fixtureId}`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) return null;
    const data = await res.json();
    const lineups = data.response || [];

    if (lineups.length < 2) return null;

    const result = lineups.map(l => ({
      teamName: l.team?.name,
      teamId: l.team?.id,
      formation: l.formation,
      starters: (l.startXI || []).map(p => ({
        name: p.player?.name,
        jersey: p.player?.number,
        position: p.player?.pos
      })),
      substitutes: (l.substitutes || []).map(p => ({
        name: p.player?.name,
        jersey: p.player?.number,
        position: p.player?.pos
      }))
    }));

    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.warn('[API-Football] Lineups error:', err);
    return null;
  }
}

/**
 * Master function: Find fixture and load ALL details in 1 batch
 * Costs 2 requests total (search + statistics+events combined in fixture detail)
 * But we use 3 separate cached calls for granularity
 */
export async function fetchFullMatchDetail(homeTeamName, awayTeamName, date) {
  // Step 1: Find the fixture ID (1 request, cached)
  const fixture = await searchFixture(homeTeamName, awayTeamName, date);
  if (!fixture) return null;

  const fixtureId = fixture.fixture?.id || fixture.id;
  if (!fixtureId) return null;

  // Step 2: Fetch stats + events in parallel (2 requests, each cached separately)
  const [stats, events, lineups] = await Promise.all([
    fetchApiFootballStats(fixtureId),
    fetchApiFootballEvents(fixtureId),
    fetchApiFootballLineups(fixtureId)
  ]);

  return {
    fixtureId,
    stats,
    events,
    lineups,
    fixture: {
      venue: fixture.fixture?.venue?.name,
      city: fixture.fixture?.venue?.city,
      referee: fixture.fixture?.referee,
      date: fixture.fixture?.date
    }
  };
}

// ---- Parsers ----

function parseApiFootballStats(teamsData) {
  const getStat = (teamStats, name) => {
    if (!teamStats) return 0;
    const item = teamStats.find(s => s.type === name);
    if (!item) return 0;
    const val = item.value;
    if (val === null || val === undefined) return 0;
    if (typeof val === 'string' && val.includes('%')) return parseFloat(val) || 0;
    return parseFloat(val) || 0;
  };

  const homeStats = teamsData[0]?.statistics || [];
  const awayStats = teamsData[1]?.statistics || [];

  return {
    hasData: true,
    homeName: teamsData[0]?.team?.name,
    awayName: teamsData[1]?.team?.name,
    attack: [
      { label: 'POSESIÓN %', home: getStat(homeStats, 'Ball Possession'), away: getStat(awayStats, 'Ball Possession'), unit: '%' },
      { label: 'TIROS TOTALES', home: getStat(homeStats, 'Total Shots'), away: getStat(awayStats, 'Total Shots') },
      { label: 'TIROS AL ARCO', home: getStat(homeStats, 'Shots on Goal'), away: getStat(awayStats, 'Shots on Goal') },
      { label: 'TIROS FUERA', home: getStat(homeStats, 'Shots off Goal'), away: getStat(awayStats, 'Shots off Goal') },
      { label: 'TIROS BLOQUEADOS', home: getStat(homeStats, 'Blocked Shots'), away: getStat(awayStats, 'Blocked Shots') },
    ],
    passing: [
      { label: 'PASES TOTALES', home: getStat(homeStats, 'Total passes'), away: getStat(awayStats, 'Total passes') },
      { label: 'PASES PRECISOS', home: getStat(homeStats, 'Passes accurate'), away: getStat(awayStats, 'Passes accurate') },
      { label: 'PRECISIÓN DE PASES %', home: getStat(homeStats, 'Passes %'), away: getStat(awayStats, 'Passes %'), unit: '%' },
    ],
    defense: [
      { label: 'SAQUES DE ESQUINA', home: getStat(homeStats, 'Corner Kicks'), away: getStat(awayStats, 'Corner Kicks') },
      { label: 'PARADAS DEL ARQUERO', home: getStat(homeStats, 'Goalkeeper Saves'), away: getStat(awayStats, 'Goalkeeper Saves') },
      { label: 'SAQUES DE BANDA', home: getStat(homeStats, 'Throw-in'), away: getStat(awayStats, 'Throw-in') },
      { label: 'FUERAS DE JUEGO', home: getStat(homeStats, 'Offsides'), away: getStat(awayStats, 'Offsides') },
    ],
    discipline: [
      { label: 'FALTAS COMETIDAS', home: getStat(homeStats, 'Fouls'), away: getStat(awayStats, 'Fouls') },
      { label: 'TARJETAS AMARILLAS', home: getStat(homeStats, 'Yellow Cards'), away: getStat(awayStats, 'Yellow Cards') },
      { label: 'TARJETAS ROJAS', home: getStat(homeStats, 'Red Cards'), away: getStat(awayStats, 'Red Cards') },
      { label: 'TIROS LIBRES', home: getStat(homeStats, 'Free Kicks'), away: getStat(awayStats, 'Free Kicks') },
    ]
  };
}

function parseApiFootballEvents(events) {
  const goals = events
    .filter(e => e.type === 'Goal')
    .map(e => ({
      minute: `${e.time?.elapsed || 0}'`,
      player: e.player?.name || 'Goleador',
      assist: e.assist?.name || null,
      team: e.team?.name,
      teamId: e.team?.id,
      detail: e.detail, // "Normal Goal", "Penalty", "Own Goal"
      type: 'goal'
    }));

  const cards = events
    .filter(e => e.type === 'Card')
    .map(e => ({
      minute: `${e.time?.elapsed || 0}'`,
      player: e.player?.name || '?',
      team: e.team?.name,
      teamId: e.team?.id,
      detail: e.detail, // "Yellow Card", "Red Card"
      type: e.detail?.toLowerCase().includes('red') ? 'redCard' : 'yellowCard'
    }));

  const substitutions = events
    .filter(e => e.type === 'subst')
    .map(e => ({
      minute: `${e.time?.elapsed || 0}'`,
      playerIn: e.player?.name,
      playerOut: e.assist?.name,
      team: e.team?.name,
      type: 'substitution'
    }));

  return { goals, cards, substitutions };
}

/**
 * Get remaining API requests for today
 */
export async function getApiFootballQuota() {
  try {
    const res = await fetch('/api/football/status', {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    const sub = data.response?.subscription;
    const req = data.response?.requests;
    return {
      plan: sub?.plan || 'Free',
      limit: sub?.end || '?',
      current: req?.current || 0,
      limit_day: req?.limit_day || 100,
      remaining: (req?.limit_day || 100) - (req?.current || 0)
    };
  } catch { return null; }
}

// Real ESPN Soccer API Integration - 100% Live Data Engine with Intelligent League Coverage

const getBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return '/api/espn/apis';
  }
  return 'https://site.api.espn.com/apis';
};

/** Horario de inicio en español y hora local: "Hoy · 20:30", "Mañana · 13:00" o "18/11 · 21:00". */
export function formatKickoff(iso) {
  if (!iso) return 'Por iniciar';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Por iniciar';
  const hour = d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  const startOfDay = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000);
  const day = days === 0 ? 'Hoy' : days === 1 ? 'Mañana' : days === -1 ? 'Ayer'
    : d.toLocaleDateString('es', { day: '2-digit', month: '2-digit' });
  return `${day} · ${hour}`;
}

// Cuota americana (+150 / -200) → decimal (2.50 / 1.50)
function americanToDecimal(am) {
  const n = parseFloat(am);
  if (!Number.isFinite(n) || n === 0) return null;
  return Number((n > 0 ? n / 100 + 1 : 100 / Math.abs(n) + 1).toFixed(2));
}

/**
 * Cuotas 1X2 reales del proveedor que publica ESPN (normalmente DraftKings).
 * ESPN las trae en `moneyline` (cierre o apertura); los campos `homeTeamOdds` suelen venir vacíos.
 * Devuelve null si el partido no tiene cuotas.
 */
export function parseEspnOdds(espnOdds) {
  if (!espnOdds) return null;
  const ml = espnOdds.moneyline || {};
  const pick = (side, legacy) =>
    legacy?.decimalOdds ||
    americanToDecimal(ml[side]?.close?.odds ?? ml[side]?.open?.odds) ||
    americanToDecimal(legacy?.moneyLine ?? legacy?.close?.moneyLine);

  const homeOdds = pick('home', espnOdds.homeTeamOdds);
  const awayOdds = pick('away', espnOdds.awayTeamOdds);
  const drawOdds = pick('draw', espnOdds.drawOdds);
  const total = espnOdds.overUnder ?? espnOdds.total?.over?.close?.line?.replace(/^o/, '');
  // Cuotas del total de goles (over/under) a esa línea, si el proveedor las publica
  const overOdds = americanToDecimal(espnOdds.overOdds ?? espnOdds.total?.over?.close?.odds ?? espnOdds.total?.over?.open?.odds);
  const underOdds = americanToDecimal(espnOdds.underOdds ?? espnOdds.total?.under?.close?.odds ?? espnOdds.total?.under?.open?.odds);
  const totalLine = Number.parseFloat(total);

  return {
    provider: espnOdds.provider?.displayName || espnOdds.provider?.name || 'ESPN',
    details: espnOdds.details || null,
    overUnder: total ? `O/U ${total}` : null,
    totalLine: Number.isFinite(totalLine) ? totalLine : null,
    overOdds,
    underOdds,
    homeOdds,
    drawOdds,
    awayOdds,
    hasMoneyline: !!(homeOdds && drawOdds && awayOdds),
    fetchedAt: new Date().toISOString(),
  };
}

export const ESPN_SUPPORTED_LEAGUES = [
  { id: 'all', name: 'Todos los partidos', icon: '⚽' },
  { id: 'per.1', name: 'Liga 1 Perú', icon: '🇵🇪' },
  { id: 'uefa.champions', name: 'Champions League', icon: '⭐' },
  { id: 'esp.1', name: 'LaLiga EA Sports', icon: '🇪🇸' },
  { id: 'eng.1', name: 'Premier League', icon: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { id: 'ita.1', name: 'Serie A', icon: '🇮🇹' },
  { id: 'ger.1', name: 'Bundesliga', icon: '🇩🇪' },
  { id: 'fra.1', name: 'Ligue 1', icon: '🇫🇷' },
  { id: 'por.1', name: 'Liga Portugal', icon: '🇵🇹' },
  { id: 'mex.1', name: 'Liga MX', icon: '🇲🇽' },
  { id: 'arg.1', name: 'Liga Argentina', icon: '🇦🇷' },
  { id: 'conmebol.libertadores', name: 'Copa Libertadores', icon: '🏆' },
  { id: 'usa.1', name: 'MLS', icon: '🇺🇸' },
];

/**
 * Fetch real live matches from ESPN scoreboard
 */
// El marcador "all" de ESPN deja fuera algunas ligas (la de Perú, por ejemplo): se piden aparte
const EXTRA_ALL_LEAGUES = ['per.1'];

async function fetchScoreboardEvents(league) {
  const response = await fetch(`${getBaseUrl()}/site/v2/sports/soccer/${league}/scoreboard`, {
    headers: { 'Accept': 'application/json' }
  });
  if (!response.ok) {
    throw new Error(`ESPN Scoreboard status: ${response.status}`);
  }
  const data = await response.json();
  return data.events || [];
}

export async function fetchEspnScoreboard(league = 'all') {
  try {
    if (league !== 'all') return parseEspnEvents(await fetchScoreboardEvents(league), league);

    const [main, ...extras] = await Promise.allSettled(['all', ...EXTRA_ALL_LEAGUES].map(fetchScoreboardEvents));
    const mainEvents = main.status === 'fulfilled' ? main.value : [];
    const seen = new Set(mainEvents.map((ev) => ev.id));
    const matches = parseEspnEvents(mainEvents, 'all');
    extras.forEach((result, i) => {
      if (result.status !== 'fulfilled') return;
      // Estos partidos guardan su liga para que el filtro y el resumen usen la ruta correcta
      matches.push(...parseEspnEvents(result.value.filter((ev) => !seen.has(ev.id)), EXTRA_ALL_LEAGUES[i]));
    });
    if (main.status === 'rejected' && matches.length === 0) throw main.reason;
    return matches;
  } catch (error) {
    console.error('Error fetching ESPN scoreboard:', error);
    return [];
  }
}

/**
 * Fetch real match summary, boxscore statistics, lineups and timeline from ESPN
 */
export async function fetchEspnMatchSummary(matchId, league = 'all') {
  const baseUrl = getBaseUrl();
  const targetLeague = league === 'all' ? 'all' : league;
  const url = `${baseUrl}/site/v2/sports/soccer/${targetLeague}/summary?event=${matchId}`;

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`ESPN Summary status: ${response.status}`);
    }

    const summary = await response.json();
    return parseEspnSummary(summary, matchId, league);
  } catch (error) {
    console.error('Error fetching ESPN summary:', error);
    return null;
  }
}

/**
 * Fetch real standings table directly from ESPN v2 API
 */
// Zona de la tabla según la nota de ESPN, con nombre en español y color propio de la app
function standingZone(description) {
  const d = String(description || '');
  if (!d) return null;
  const qualifying = /qualif|play-?off|previa/i.test(d);
  if (/relegation|descenso/i.test(d)) return { key: qualifying ? 'releg-po' : 'releg', label: qualifying ? 'Promoción de descenso' : 'Descenso' };
  if (/promotion|ascenso/i.test(d)) return { key: 'promo', label: qualifying ? 'Promoción de ascenso' : 'Ascenso' };
  if (/champions/i.test(d)) return { key: qualifying ? 'ucl-q' : 'ucl', label: qualifying ? 'Previa de Champions League' : 'Champions League' };
  if (/europa/i.test(d)) return { key: qualifying ? 'uel-q' : 'uel', label: qualifying ? 'Previa de Europa League' : 'Europa League' };
  if (/conference/i.test(d)) return { key: 'uecl', label: qualifying ? 'Previa de Conference League' : 'Conference League' };
  if (/libertadores/i.test(d)) return { key: 'ucl', label: qualifying ? 'Previa de Libertadores' : 'Copa Libertadores' };
  if (/sudamericana/i.test(d)) return { key: 'uel', label: 'Copa Sudamericana' };
  return { key: 'other', label: d };
}

export async function fetchEspnStandings(league = 'esp.1') {
  const baseUrl = getBaseUrl();
  const targetLeague = league === 'all' ? 'esp.1' : league;
  const url = `${baseUrl}/v2/sports/soccer/${targetLeague}/standings`;

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`ESPN Standings status: ${response.status}`);
    }

    const data = await response.json();
    const entries = data.children?.[0]?.standings?.entries || [];

    return entries.map((entry, idx) => {
      const statsMap = {};
      (entry.stats || []).forEach(s => {
        statsMap[s.name] = s.displayValue ?? s.value;
      });

      const rawStat = (name) => (entry.stats || []).find((s) => s.name === name)?.value;
      return {
        pos: idx + 1,
        zone: standingZone(entry.note?.description),
        rankChange: Number(rawStat('rankChange')) || 0,
        team: entry.team?.displayName || 'Equipo',
        shortName: entry.team?.shortDisplayName || entry.team?.name || 'Club',
        logo: entry.team?.logos?.[0]?.href || '',
        pj: statsMap.gamesPlayed ?? 0,
        g: statsMap.wins ?? 0,
        e: statsMap.ties ?? 0,
        p: statsMap.losses ?? 0,
        gf: statsMap.pointsFor ?? 0,
        gc: statsMap.pointsAgainst ?? 0,
        dg: Number(rawStat('pointDifferential')) || 0,
        pts: statsMap.points ?? 0,
      };
    });
  } catch (error) {
    console.error('Error fetching ESPN standings:', error);
    return [];
  }
}

function parseEspnEvents(events, league) {
  // Filter out amateur/college matches (NCAA) to show 100% professional football
  const proEvents = events.filter(ev => {
    const slug = (ev?.season?.slug || ev?.season?.name || '').toLowerCase();
    const name = (ev?.name || '').toLowerCase();
    const leagueName = (ev?.league?.name || '').toLowerCase();
    const compText = (ev?.competitions?.[0]?.type?.text || '').toLowerCase();
    return !slug.includes('ncaa') && !name.includes('ncaa') && !leagueName.includes('ncaa') && !compText.includes('ncaa');
  });

  return proEvents.map((ev, index) => {
    const comp = ev.competitions?.[0];
    const competitors = comp?.competitors || [];

    const home = competitors.find(c => c.homeAway === 'home') || competitors[0];
    const away = competitors.find(c => c.homeAway === 'away') || competitors[1];

    const eventTime = ev.date ? new Date(ev.date).getTime() : 0;
    const now = Date.now();
    const isPastMatch = eventTime > 0 && eventTime < (now - 110 * 60 * 1000);

    const isLive = !isPastMatch && (ev.status?.type?.state === 'in' || ev.status?.type?.name?.includes('IN_PROGRESS') || ev.status?.type?.name?.includes('HALFTIME') || ev.status?.type?.detail === 'HT');
    const isFinished = ev.status?.type?.state === 'post' || ev.status?.type?.completed === true || ev.status?.type?.name?.includes('FINAL') || ev.status?.type?.name?.includes('FULL_TIME') || isPastMatch;
    const status = isFinished ? 'finished' : isLive ? 'live' : 'scheduled';
    
    let minute = '1\'';
    if (isFinished) {
      minute = 'FT';
    } else if (ev.status?.type?.name?.includes('HALFTIME') || ev.status?.type?.detail === 'HT') {
      minute = 'HT';
    } else if (ev.status?.displayClock) {
      const rawClock = String(ev.status.displayClock).replace(/'/g, '');
      minute = `${rawClock}'`;
    } else {
      minute = ev.status?.type?.detail || ev.status?.type?.shortDetail || 'Hoy';
    }

    const homeScore = parseInt(home?.score || '0', 10);
    const awayScore = parseInt(away?.score || '0', 10);

    const odds = parseEspnOdds(comp?.odds?.[0]);

    const { leagueTitle, isWomen, isFriendly, category } = resolveDetailedLeagueInfo(ev, comp, home, away, league);

    // Parse linescores (1st half / 2nd half)
    const homeLinescores = (home?.linescores || []).map(l => l.displayValue || '0');
    const awayLinescores = (away?.linescores || []).map(l => l.displayValue || '0');

    const broadcastsList = (comp?.broadcasts || []).map(b => b.names?.[0] || b.media?.shortName || b.station || '').filter(Boolean);
    const tvChannel = broadcastsList.length > 0 ? broadcastsList.join(' / ') : null;

    const cleanTime = ev.date ? new Date(ev.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Hoy';
    const timeStr = isLive ? `EN VIVO · ${minute}` : isFinished ? 'FINALIZADO' : formatKickoff(ev.date);

    return {
      id: ev.id || `espn-${index}`,
      league: league,
      leagueName: leagueTitle,
      category: category,
      isWomen: isWomen,
      isFriendly: isFriendly,
      tvChannel: tvChannel,
      broadcasts: broadcastsList,
      status: status,
      minute: minute,
      clockSeconds: typeof ev.status?.clock === 'number' ? ev.status.clock : null,
      timeStr: timeStr,
      date: cleanTime,
      rawDate: ev.date || null,
      venue: comp?.venue?.fullName ? `${comp.venue.fullName}, ${comp.venue.address?.city || ''}` : null,
      linescores: {
        home: homeLinescores,
        away: awayLinescores
      },
      homeTeam: {
        id: home?.id || `h-${index}`,
        name: home?.team?.displayName || 'Local',
        shortName: home?.team?.shortDisplayName || home?.team?.name || 'Local',
        logo: home?.team?.logo || home?.team?.logos?.[0]?.href || '',
        score: homeScore,
        winner: home?.winner || false,
        odds: odds?.homeOdds || null,
        yellowCards: 0,
        redCards: 0,
      },
      awayTeam: {
        id: away?.id || `a-${index}`,
        name: away?.team?.displayName || 'Visita',
        shortName: away?.team?.shortDisplayName || away?.team?.name || 'Visita',
        logo: away?.team?.logo || away?.team?.logos?.[0]?.href || '',
        score: awayScore,
        winner: away?.winner || false,
        odds: odds?.awayOdds || null,
        yellowCards: 0,
        redCards: 0,
      },
      oddsInfo: odds,
      serversCount: 4,
      featured: index === 0,
      scorers: [],
      stats: null,
      rawEspnStatus: ev.status?.type
    };
  }).sort((a, b) => {
    // 1. Live games first (0), then Scheduled (1), then Finished (2)
    const statusWeight = (s) => (s === 'live' ? 0 : s === 'scheduled' ? 1 : 2);
    const weightDiff = statusWeight(a.status) - statusWeight(b.status);
    if (weightDiff !== 0) return weightDiff;

    const timeA = a.rawDate ? new Date(a.rawDate).getTime() : 0;
    const timeB = b.rawDate ? new Date(b.rawDate).getTime() : 0;

    if (a.status === 'scheduled') {
      return timeA - timeB; // Earliest upcoming match first (e.g. 11:00 AM -> 12:00 PM -> 19:00)
    } else if (a.status === 'finished') {
      return timeB - timeA; // Most recently finished first
    }
    return timeA - timeB;
  });
}

function parseEspnSummary(summary, matchId, league) {
  const comp = summary.header?.competitions?.[0];
  const competitors = comp?.competitors || [];
  const home = competitors.find(c => c.homeAway === 'home') || competitors[0];
  const away = competitors.find(c => c.homeAway === 'away') || competitors[1];

  const boxTeams = summary.boxscore?.teams || [];
  const homeBox = boxTeams[0];
  const awayBox = boxTeams[1];

  const isFinished = comp?.status?.type?.state === 'post' || comp?.status?.type?.completed === true || comp?.status?.type?.name?.includes('FINAL') || comp?.status?.type?.name?.includes('FULL_TIME');
  const isLive = !isFinished && (comp?.status?.type?.state === 'in' || comp?.status?.type?.name?.includes('IN_PROGRESS') || comp?.status?.type?.name?.includes('HALFTIME') || comp?.status?.type?.detail === 'HT');

  let minute = '1\'';
  if (isFinished) {
    minute = 'FT';
  } else if (comp?.status?.type?.name?.includes('HALFTIME') || comp?.status?.type?.detail === 'HT') {
    minute = 'HT';
  } else if (comp?.status?.displayClock) {
    const rawClock = String(comp.status.displayClock).replace(/'/g, '');
    minute = `${rawClock}'`;
  } else {
    minute = comp?.status?.type?.detail || comp?.status?.type?.shortDetail || 'Por Iniciar';
  }

  const homeScore = parseInt(home?.score || '0', 10);
  const awayScore = parseInt(away?.score || '0', 10);

  // Linescores breakdown (1st half / 2nd half)
  const homeLinescores = (home?.linescores || []).map(l => l.displayValue || '0');
  const awayLinescores = (away?.linescores || []).map(l => l.displayValue || '0');

  // Extract official stats directly from ESPN boxscore if available, or generate proportional match stats
  let parsedStats = null;
  const getStat = (box, name, def = 0) => {
    if (!box || !box.statistics) return def;
    const s = box.statistics.find(st => st.name === name || st.label?.toLowerCase() === name.toLowerCase());
    return s ? (parseFloat(s.displayValue) || s.displayValue) : def;
  };

  const hasOfficialStats = (homeBox?.statistics && homeBox.statistics.length > 0) || (awayBox?.statistics && awayBox.statistics.length > 0);

  if (hasOfficialStats) {

    const hasInGameStats = (isLive || isFinished) && ((homeBox?.statistics || []).some(s => s.name === 'possessionPct' || s.name === 'totalShots') || (awayBox?.statistics || []).some(s => s.name === 'possessionPct' || s.name === 'totalShots'));

    if (hasInGameStats) {
      parsedStats = {
        hasData: true,
        isOfficial: true,
        type: 'ingame',
        attack: [
          { label: 'POSESIÓN %', home: getStat(homeBox, 'possessionPct', 50), away: getStat(awayBox, 'possessionPct', 50), unit: '%' },
          { label: 'TIROS TOTALES', home: getStat(homeBox, 'totalShots', 0), away: getStat(awayBox, 'totalShots', 0) },
          { label: 'TIROS AL ARCO', home: getStat(homeBox, 'shotsOnTarget', 0), away: getStat(awayBox, 'shotsOnTarget', 0) },
          { label: 'EFECTIVIDAD %', home: Math.round((getStat(homeBox, 'shotPct', 0) * 100)) || 0, away: Math.round((getStat(awayBox, 'shotPct', 0) * 100)) || 0, unit: '%' },
          { label: 'TIROS BLOQUEADOS', home: getStat(homeBox, 'blockedShots', 0), away: getStat(awayBox, 'blockedShots', 0) },
        ],
        passing: [
          { label: 'PASES TOTALES', home: getStat(homeBox, 'totalPasses', 0), away: getStat(awayBox, 'totalPasses', 0) },
          { label: 'PASES PRECISOS', home: getStat(homeBox, 'accuratePasses', 0), away: getStat(awayBox, 'accuratePasses', 0) },
          { label: 'PRECISIÓN DE PASES %', home: Math.round((getStat(homeBox, 'passPct', 0) * 100)) || 0, away: Math.round((getStat(awayBox, 'passPct', 0) * 100)) || 0, unit: '%' },
          { label: 'CENTROS PRECISOS', home: getStat(homeBox, 'accurateCrosses', 0), away: getStat(awayBox, 'accurateCrosses', 0) },
        ],
        defense: [
          { label: 'CÓRNERS GANADOS', home: getStat(homeBox, 'wonCorners', 0), away: getStat(awayBox, 'wonCorners', 0) },
          { label: 'PARADAS DEL ARQUERO', home: getStat(homeBox, 'saves', 0), away: getStat(awayBox, 'saves', 0) },
          { label: 'ENTRADAS EFECTIVAS', home: getStat(homeBox, 'effectiveTackles', 0), away: getStat(awayBox, 'effectiveTackles', 0) },
          { label: 'DESPEJES TOTALES', home: getStat(homeBox, 'totalClearance', 0), away: getStat(awayBox, 'totalClearance', 0) },
        ],
        discipline: [
          { label: 'FALTAS COMETIDAS', home: getStat(homeBox, 'foulsCommitted', 0), away: getStat(awayBox, 'foulsCommitted', 0) },
          { label: 'TARJETAS AMARILLAS', home: getStat(homeBox, 'yellowCards', 0), away: getStat(awayBox, 'yellowCards', 0) },
          { label: 'TARJETAS ROJAS', home: getStat(homeBox, 'redCards', 0), away: getStat(awayBox, 'redCards', 0) },
          { label: 'FUERAS DE JUEGO', home: getStat(homeBox, 'offsides', 0), away: getStat(awayBox, 'offsides', 0) },
        ]
      };
    }
  }

  // Parse real keyEvents (goals, cards, substitutions) from ESPN
  const keyEvents = summary.keyEvents || summary.plays || [];
  let scorers = keyEvents
    .filter(k => k.type?.text?.toLowerCase().includes('goal') || k.text?.toLowerCase().includes('gol') || k.scoringPlay === true)
    .map(k => {
      const isHomeTeam = k.team?.id === home?.id || k.team?.displayName === home?.team?.displayName;
      return {
        minute: k.clock?.displayValue ? `${k.clock.displayValue}'` : `${Math.floor((k.clock?.value || 0) / 60)}'`,
        player: k.participants?.[0]?.athlete?.displayName || k.shortText || k.text || 'Goleador',
        team: isHomeTeam ? 'home' : 'away',
        text: k.text,
        type: 'goal'
      };
    });

  // Parse real commentary from ESPN
  const commentaryList = (summary.commentary || []).slice(-20).map((c, i) => ({
    id: i,
    time: c.time?.displayValue || '',
    text: c.text || c.play?.text || ''
  }));

  // Jugadas reales con coordenadas de cancha (Opta 0-100) para el panel táctico
  const classifyPlay = (t = '') => {
    const x = t.toLowerCase();
    if (x.includes('goal') || x.includes('penalty - scored')) return 'goal';
    if (x.includes('shot') || x.includes('woodwork') || x.includes('save') || x.includes('penalty')) return 'shot';
    if (x.includes('corner')) return 'corner';
    if (x.includes('card')) return 'card';
    if (x.includes('foul') || x.includes('handball')) return 'foul';
    if (x.includes('offside')) return 'offside';
    if (x.includes('substitution')) return 'sub';
    return 'other';
  };
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const plays = (summary.commentary || [])
    .filter(c => c.play?.type?.text)
    .map((c, i) => {
      const p = c.play;
      const isHomeTeam = p.team?.id ? p.team.id === home?.id : p.team?.displayName === home?.team?.displayName;
      const hasTeam = !!(p.team?.id || p.team?.displayName);
      return {
        id: p.id || `play-${i}`,
        seconds: Number(p.clock?.value ?? c.time?.value ?? 0),
        minute: p.clock?.displayValue || c.time?.displayValue || '',
        period: p.period?.number || 1,
        typeText: p.type.text,
        category: classifyPlay(p.type.text),
        team: hasTeam ? (isHomeTeam ? 'home' : 'away') : null,
        player: p.participants?.[0]?.athlete?.displayName || '',
        player2: p.participants?.[1]?.athlete?.displayName || '',
        text: c.text || p.text || '',
        x: num(p.fieldPositionX),
        y: num(p.fieldPositionY),
        x2: num(p.fieldPosition2X),
        y2: num(p.fieldPosition2Y),
      };
    })
    .filter((p, i, arr) => arr.findIndex(o => o.id === p.id) === i)
    .sort((a, b) => a.seconds - b.seconds);

  // Clips oficiales de ESPN (mp4 directo) asociados al partido
  const videos = (summary.videos || [])
    .map(v => ({
      id: v.id,
      title: v.headline || v.description || 'Video ESPN',
      duration: v.duration || 0,
      thumbnail: v.thumbnail || '',
      src: v.links?.source?.HD?.href || v.links?.source?.href || v.links?.mobile?.source?.href || '',
      hls: v.links?.source?.HLS?.HD?.href || v.links?.source?.HLS?.href || '',
    }))
    .filter(v => v.src);

  const broadcasts = (summary.broadcasts || []).map(b => b.media?.shortName || b.station || b.name).filter(Boolean);
  const espnLink = (summary.header?.links || []).find(l => (l.rel || []).includes('summary'))?.href || `https://www.espn.com/soccer/match/_/gameId/${matchId}`;

  // Parse real rosters from ESPN
  // ESPN manda los cambios como { didSub: false } (o como booleano en partidos antiguos)
  const didSub = (v) => (v && typeof v === 'object' ? Boolean(v.didSub) : Boolean(v));
  const toRosterPlayer = p => ({
    id: p.athlete?.id || null,
    name: p.athlete?.displayName,
    headshot: p.athlete?.headshot?.href || null,
    shortName: p.athlete?.lastName || p.athlete?.shortName || p.athlete?.displayName,
    jersey: p.jersey,
    position: p.position?.abbreviation,
    formationPlace: Number(p.formationPlace) || 0,
    subbedIn: didSub(p.subbedIn),
    subbedOut: didSub(p.subbedOut)
  });
  const rostersList = (summary.rosters || []).map(r => ({
    teamName: r.team?.displayName,
    teamId: r.team?.id,
    homeAway: r.homeAway,
    formation: r.formation || null,
    starters: (r.roster || []).filter(p => p.starter).map(toRosterPlayer),
    substitutes: (r.roster || []).filter(p => !p.starter).map(toRosterPlayer)
  }));

  // Game Info
  const gameInfo = {
    venue: summary.gameInfo?.venue?.fullName ? `${summary.gameInfo.venue.fullName}, ${summary.gameInfo.venue.address?.city || ''}` : null,
    attendance: summary.gameInfo?.attendance ? Number(summary.gameInfo.attendance).toLocaleString() : null,
    officials: summary.gameInfo?.officials?.map(o => o.displayName).join(', ') || null,
    city: summary.gameInfo?.venue?.address?.city || null,
  };

  // Posición de cada equipo en la tabla del torneo (ESPN la trae dentro del resumen)
  const tableOf = (team) => {
    for (const group of summary.standings?.groups || []) {
      const entries = group.standings?.entries || [];
      const idx = entries.findIndex(e => String(e.id) === String(team?.team?.id ?? team?.id) || e.team === team?.team?.displayName);
      if (idx < 0) continue;
      const st = Object.fromEntries((entries[idx].stats || []).map(x => [x.name, Number(x.value ?? x.displayValue)]));
      return {
        rank: Number.isFinite(st.rank) && st.rank > 0 ? st.rank : idx + 1,
        points: st.points ?? null,
        played: st.gamesPlayed ?? null,
        size: entries.length,
      };
    }
    return null;
  };
  const table = { home: tableOf(home), away: tableOf(away) };

  // Extract real market odds from ESPN pickcenter or competition odds
  const realOdds = parseEspnOdds(comp?.odds?.[0] || summary.odds?.[0] || summary.pickcenter?.[0]);

  const { leagueTitle, isWomen, isFriendly, category } = resolveDetailedLeagueInfo(summary.header, comp, home, away, league);

  const countCards = (box, teamId, teamName) => {
    let yellows = 0;
    let reds = 0;

    // 1. Get official stats from ESPN boxscore
    if (box && box.statistics) {
      yellows = getStat(box, 'yellowCards', 0);
      reds = getStat(box, 'redCards', 0);
    }

    // 2. If boxscore statistics were not provided or 0, check ESPN keyEvents / plays directly
    if (yellows === 0 && reds === 0 && keyEvents && keyEvents.length > 0) {
      for (const k of keyEvents) {
        const isTarget = k.team?.id === teamId || k.team?.displayName === teamName;
        if (!isTarget) continue;
        const t = (k.type?.text || k.text || '').toLowerCase();
        if (t.includes('yellow') || t.includes('amarilla')) yellows++;
        if (t.includes('red card') || t.includes('tarjeta roja')) reds++;
      }
    }

    return { yellows: Number(yellows) || 0, reds: Number(reds) || 0 };
  };

  const homeCards = countCards(homeBox, home?.id, home?.team?.displayName);
  const awayCards = countCards(awayBox, away?.id, away?.team?.displayName);

  // Parse Last 5 Games for both teams from ESPN
  let recentForm = {
    home: { form: '', games: [] },
    away: { form: '', games: [] }
  };

  if (summary.lastFiveGames && Array.isArray(summary.lastFiveGames)) {
    summary.lastFiveGames.forEach(group => {
      const isHomeTeam = String(group.team?.id) === String(home?.id) || group.team?.displayName === home?.team?.displayName;
      const target = isHomeTeam ? recentForm.home : recentForm.away;
      const events = (group.events || []).slice(-5);
      
      target.games = events.map(e => ({
        id: e.id || null,
        date: e.gameDate ? e.gameDate.split('T')[0] : '',
        opponent: e.opponent?.displayName || e.opponent?.abbreviation || 'Rival',
        score: e.score || `${e.homeTeamScore || 0}-${e.awayTeamScore || 0}`,
        result: e.gameResult || (Number(e.homeTeamScore) > Number(e.awayTeamScore) ? 'W' : Number(e.homeTeamScore) < Number(e.awayTeamScore) ? 'L' : 'D'),
        // Goles a favor y en contra desde el punto de vista del equipo ('@' = jugó de visita)
        goalsFor: e.homeTeamScore == null ? null : Number(e.atVs === '@' ? e.awayTeamScore : e.homeTeamScore),
        goalsAgainst: e.homeTeamScore == null ? null : Number(e.atVs === '@' ? e.homeTeamScore : e.awayTeamScore),
        competition: e.competitionName || e.leagueName || ''
      }));
      target.form = target.games.map(g => g.result).join('-');
    });
  }

  // Parse Head-to-Head (H2H) Series History from ESPN
  let h2hHistory = [];
  if (summary.seasonseries && Array.isArray(summary.seasonseries)) {
    summary.seasonseries.forEach(series => {
      const events = series.events || [];
      events.forEach(ev => {
        const compSeries = ev.competitions?.[0] || ev;
        const h = compSeries?.competitors?.find(c => c.homeAway === 'home');
        const a = compSeries?.competitors?.find(c => c.homeAway === 'away');
        if (h && a) {
          h2hHistory.push({
            date: ev.date ? ev.date.split('T')[0] : '',
            homeTeam: h.team?.displayName || 'Local',
            awayTeam: a.team?.displayName || 'Visita',
            homeScore: h.score || h.score?.displayValue || '0',
            awayScore: a.score || a.score?.displayValue || '0',
            competition: ev.competitionName || compSeries?.type?.text || ''
          });
        }
      });
    });
  }

  const rawBroadcasts = summary.broadcasts || comp?.broadcasts || [];
  const broadcastsList = rawBroadcasts.map(b => b.names?.[0] || b.media?.shortName || b.station || '').filter(Boolean);
  const tvChannel = broadcastsList.length > 0 ? broadcastsList.join(' / ') : null;

  return {
    id: matchId,
    leagueName: leagueTitle,
    category: category,
    isWomen: isWomen,
    isFriendly: isFriendly,
    tvChannel: tvChannel,
    broadcasts: broadcastsList,
    status: isFinished ? 'finished' : isLive ? 'live' : 'scheduled',
    minute: minute,
    clockSeconds: typeof comp?.status?.clock === 'number' ? comp.status.clock : null,
    timeStr: isLive ? `EN VIVO · ${minute}` : isFinished ? 'FINALIZADO' : formatKickoff(comp?.date || summary.header?.competitions?.[0]?.date),
    linescores: {
      home: homeLinescores,
      away: awayLinescores
    },
    homeTeam: {
      id: home?.id,
      name: home?.team?.displayName || 'Local',
      shortName: home?.team?.shortDisplayName || home?.team?.name || 'Local',
      logo: home?.team?.logos?.[0]?.href || home?.team?.logo || '',
      score: homeScore,
      // Solo si hay cuota: así no se pisa la que ya trajo el marcador
      ...(realOdds?.homeOdds ? { odds: realOdds.homeOdds } : {}),
      yellowCards: homeCards.yellows,
      redCards: homeCards.reds,
      form: recentForm.home.form,
      recentGames: recentForm.home.games,
    },
    awayTeam: {
      id: away?.id,
      name: away?.team?.displayName || 'Visita',
      shortName: away?.team?.shortDisplayName || away?.team?.name || 'Visita',
      logo: away?.team?.logos?.[0]?.href || away?.team?.logo || '',
      score: awayScore,
      ...(realOdds?.awayOdds ? { odds: realOdds.awayOdds } : {}),
      yellowCards: awayCards.yellows,
      redCards: awayCards.reds,
      form: recentForm.away.form,
      recentGames: recentForm.away.games,
    },
    ...(realOdds?.hasMoneyline ? { oddsInfo: realOdds } : {}),
    stats: parsedStats,
    scorers: scorers,
    commentary: commentaryList,
    rosters: rostersList,
    recentForm: recentForm,
    h2hHistory: h2hHistory,
    table,
    gameInfo: gameInfo,
    rawKeyEvents: keyEvents,
    plays,
    videos,
    tvBroadcasts: broadcasts,
    espnLink
  };
}

export function resolveDetailedLeagueInfo(ev, comp, home, away, league = 'all') {
  const slug = (ev?.season?.slug || ev?.season?.name || '').toLowerCase();
  const rawTitle = (ev?.league?.name || comp?.type?.text || comp?.notes?.[0]?.headline || '').toLowerCase();
  const homeName = (home?.team?.displayName || home?.name || '').toLowerCase();
  const awayName = (away?.team?.displayName || away?.name || '').toLowerCase();
  const allText = `${slug} ${rawTitle} ${homeName} ${awayName}`;

  const isWomen = allText.includes('women') || allText.includes('femen') || allText.includes('cwsoc') || allText.includes('nwsl') || allText.includes('royals') || allText.includes('wave fc') || allText.includes('thorns') || allText.includes('reign') || allText.includes('spirit') || allText.includes('gotham');
  const isFriendly = allText.includes('friendly') || allText.includes('amistoso');
  const isYouth = allText.includes(' u20') || allText.includes(' sub-20') || allText.includes(' u23') || allText.includes(' u19') || allText.includes(' ii') || allText.includes(' b ');

  let title = 'Fútbol internacional';
  let category = 'Fútbol';

  if (league === 'per.1' || rawTitle.includes('peruvian')) {
    // ESPN marca la temporada peruana solo como "apertura"/"clausura": va antes de ese caso genérico
    const phase = slug.includes('clausura') ? ' · Clausura' : slug.includes('apertura') ? ' · Apertura' : '';
    title = `🇵🇪 Liga 1 Perú${phase}`;
    category = 'Liga 1';
  } else if (slug.includes('premier-league') || allText.includes('premier league')) {
    title = isWomen ? '👩 FA Women\'s Super League' : '🏴󠁧󠁢󠁥󠁮󠁧󠁿 Premier League';
    category = 'Premier League';
  } else if (slug.includes('laliga') || allText.includes('laliga')) {
    title = isWomen ? '👩 Liga F Femenina (España)' : '🇪🇸 LaLiga EA Sports';
    category = 'LaLiga';
  } else if (slug.includes('ligue-1') || allText.includes('ligue 1')) {
    title = '🇫🇷 Ligue 1 Francia';
    category = 'Ligue 1';
  } else if (slug.includes('ligue-2') || allText.includes('ligue 2')) {
    title = '🇫🇷 Ligue 2 Francia';
    category = 'Ligue 2';
  } else if (slug.includes('saudi') || allText.includes('saudi pro')) {
    title = '🇸🇦 Saudi Pro League';
    category = 'Saudi League';
  } else if (slug.includes('ncaa') || allText.includes('ncaa')) {
    title = isWomen ? '👩 NCAA Fútbol Femenino (USA)' : '🎓 NCAA Universitario (USA)';
    category = isWomen ? 'Fútbol Femenino' : 'Fútbol Universitario';
  } else if (allText.includes('nwsl') || (isWomen && (allText.includes('wave') || allText.includes('royals') || allText.includes('thorns')))) {
    title = '👩 NWSL Fútbol Femenino (USA)';
    category = 'Fútbol Femenino';
  } else if (slug.includes('first-round') || allText.includes('pokal')) {
    title = '🇩🇪 Copa de Alemania (DFB-Pokal)';
    category = 'Copa Nacional';
  } else if (slug.includes('apertura') || slug.includes('clausura')) {
    if (allText.includes('tigres') || allText.includes('monterrey') || allText.includes('america') || allText.includes('juarez') || allText.includes('toluca') || allText.includes('queretaro') || allText.includes('leon') || allText.includes('chivas') || allText.includes('cruz azul') || allText.includes('pumas') || allText.includes('atlante')) {
      title = isWomen ? '👩 Liga MX Femenil (Apertura)' : '🇲🇽 Liga MX (Apertura)';
    } else {
      title = '🌎 Torneo Apertura / Clausura';
    }
    category = 'Primera División';
  } else if (slug.includes('club-friendly') || isFriendly) {
    title = isYouth ? '🌱 Amistoso de Filiales / Reservas' : '🤝 Amistoso Internacional de Clubes';
    category = 'Amistoso';
  } else if (slug.includes('turkish') || allText.includes('super lig')) {
    title = '🇹🇷 Süper Lig Turquía';
    category = 'Süper Lig';
  } else if (slug.includes('keuken')) {
    title = '🇳🇱 Países Bajos (2da División)';
    category = 'Eerste Divisie';
  } else if (slug.includes('chile')) {
    title = '🇨🇱 Primera División de Chile';
    category = 'Liga Chilena';
  } else if (slug.includes('bolivian')) {
    title = '🇧🇴 Liga Profesional Boliviana';
    category = 'Liga Boliviana';
  } else if (slug.includes('scottish')) {
    title = '🏴󠁧󠁢󠁳󠁣󠁴󠁿 Scottish Championship';
    category = 'Liga Escocesa';
  } else if (isWomen) {
    title = `👩 ${ev?.league?.name || comp?.type?.text || 'Fútbol Femenino'}`;
    category = 'Fútbol Femenino';
  } else if (ev?.league?.name) {
    title = ev.league.name;
    category = 'Fútbol';
  } else if (comp?.type?.text) {
    title = comp.type.text;
    category = 'Fútbol';
  }

  return { leagueTitle: title, isWomen, isFriendly, category };
}

/**
 * Últimos videos oficiales de fútbol de ESPN (resúmenes y clips).
 * El feed de noticias no trae el mp4, pero comparte ruta con la miniatura en el CDN de ESPN.
 */
export async function fetchEspnLatestVideos(limit = 8) {
  try {
    const response = await fetch(`${getBaseUrl()}/site/v2/sports/soccer/all/news?limit=50`, {
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) throw new Error(`ESPN News status: ${response.status}`);
    const data = await response.json();
    return (data.articles || [])
      .filter(a => a.type === 'Media')
      .map(a => {
        const thumb = a.images?.[0]?.url || '';
        const isCdnThumb = thumb.includes('/espn/media/common/') && /\.jpe?g$/i.test(thumb);
        return {
          id: a.id,
          title: a.headline || 'Video ESPN',
          duration: 0,
          thumbnail: thumb,
          src: isCdnThumb ? thumb.replace('/espn/media/common/', '/espn/media/16x9/').replace(/\.jpe?g$/i, '.mp4') : '',
          webLink: a.links?.web?.href || '',
        };
      })
      .filter(v => v.src)
      .slice(0, limit);
  } catch (error) {
    console.error('Error fetching ESPN videos:', error);
    return [];
  }
}

// ---------------------------------------------------------------- Estadísticas de partidos recientes

// Resumen de un partido terminado, guardado en memoria: no cambia, se pide una sola vez
const recentBoxCache = new Map();
async function fetchFinishedBox(eventId) {
  if (recentBoxCache.has(eventId)) return recentBoxCache.get(eventId);
  const p = fetch(`${getBaseUrl()}/site/v2/sports/soccer/all/summary?event=${eventId}`, { headers: { Accept: 'application/json' } })
    .then(r => (r.ok ? r.json() : null))
    .then(d => (d?.boxscore?.teams || []).map(t => ({
      teamId: String(t.team?.id),
      stats: Object.fromEntries((t.statistics || []).map(s => [s.name, Number.parseFloat(s.displayValue)])),
    })))
    .catch(() => null);
  recentBoxCache.set(eventId, p);
  return p;
}

/**
 * Córners, tarjetas y atajadas de los últimos partidos de un equipo (a favor y del rival).
 * Devuelve { n, games: [{ cornersFor, cornersAgainst, yellowFor, yellowAgainst, redFor, redAgainst, savesFor, savesAgainst }], eventIds }.
 */
export async function fetchTeamRecentStats(teamId, recentGames = []) {
  const ids = recentGames.map(g => g.id).filter(Boolean).slice(-5);
  if (!teamId || !ids.length) return { n: 0, games: [], eventIds: [] };
  const boxes = await Promise.all(ids.map(fetchFinishedBox));
  const games = [];
  boxes.forEach((teams, k) => {
    if (!teams || teams.length < 2) return;
    const own = teams.find(t => t.teamId === String(teamId));
    const opp = teams.find(t => t.teamId !== String(teamId));
    if (!own || !opp || !Number.isFinite(own.stats.wonCorners)) return;
    const v = (x) => (Number.isFinite(x) ? x : 0);
    games.push({
      eventId: ids[k],
      cornersFor: v(own.stats.wonCorners), cornersAgainst: v(opp.stats.wonCorners),
      yellowFor: v(own.stats.yellowCards), yellowAgainst: v(opp.stats.yellowCards),
      redFor: v(own.stats.redCards), redAgainst: v(opp.stats.redCards),
      savesFor: v(own.stats.saves), savesAgainst: v(opp.stats.saves),
    });
  });
  return { n: games.length, games, eventIds: games.map(g => g.eventId) };
}

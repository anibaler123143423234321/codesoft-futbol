// Real ESPN Soccer API Integration - 100% Live Data Engine with Intelligent League Coverage

const getBaseUrl = () => {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return '/api/espn/apis';
  }
  return 'https://site.api.espn.com/apis';
};

export const ESPN_SUPPORTED_LEAGUES = [
  { id: 'all', name: 'Todos los Partidos', icon: '⚽' },
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
export async function fetchEspnScoreboard(league = 'all') {
  const baseUrl = getBaseUrl();
  const targetLeague = league === 'all' ? 'all' : league;
  const url = `${baseUrl}/site/v2/sports/soccer/${targetLeague}/scoreboard`;

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      throw new Error(`ESPN Scoreboard status: ${response.status}`);
    }

    const data = await response.json();
    const events = data.events || [];

    return parseEspnEvents(events, league);
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

      return {
        pos: idx + 1,
        team: entry.team?.displayName || 'Equipo',
        shortName: entry.team?.shortDisplayName || entry.team?.name || 'Club',
        logo: entry.team?.logos?.[0]?.href || '',
        pj: statsMap.gamesPlayed ?? 0,
        g: statsMap.wins ?? 0,
        e: statsMap.ties ?? 0,
        p: statsMap.losses ?? 0,
        gf: statsMap.pointsFor ?? 0,
        gc: statsMap.pointsAgainst ?? 0,
        dg: statsMap.pointDifferential ?? 0,
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
    const isScheduled = !isFinished && !isLive;
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

    const espnOdds = comp?.odds?.[0];
    const overUnder = espnOdds?.overUnder ? `O/U ${espnOdds.overUnder}` : null;
    const providerSpread = espnOdds?.details || null;

    const { leagueTitle, isWomen, isFriendly, category } = resolveDetailedLeagueInfo(ev, comp, home, away, league);

    // Parse linescores (1st half / 2nd half)
    const homeLinescores = (home?.linescores || []).map(l => l.displayValue || '0');
    const awayLinescores = (away?.linescores || []).map(l => l.displayValue || '0');

    const broadcastsList = (comp?.broadcasts || []).map(b => b.names?.[0] || b.media?.shortName || b.station || '').filter(Boolean);
    const tvChannel = broadcastsList.length > 0 ? broadcastsList.join(' / ') : null;

    const cleanTime = ev.date ? new Date(ev.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Hoy';
    const timeStr = isLive ? `EN VIVO · ${minute}` : isFinished ? 'FINALIZADO' : `HORARIO: ${cleanTime}`;

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
        yellowCards: 0,
        redCards: 0,
      },
      oddsInfo: {
        overUnder,
        details: providerSpread,
        provider: espnOdds?.provider?.name || 'ESPN Odds'
      },
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
  const isScheduled = !isFinished && !isLive;
  const status = isFinished ? 'finished' : isLive ? 'live' : 'scheduled';
  
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
  const timeStr = isLive ? `EN VIVO · ${minute}` : isFinished ? 'FINALIZADO' : (comp?.status?.type?.detail || 'Por Iniciar');

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

  // Parse real rosters from ESPN
  const rostersList = (summary.rosters || []).map(r => ({
    teamName: r.team?.displayName,
    teamId: r.team?.id,
    starters: (r.roster || []).filter(p => p.starter).map(p => ({
      name: p.athlete?.displayName,
      jersey: p.jersey,
      position: p.position?.abbreviation
    })),
    substitutes: (r.roster || []).filter(p => !p.starter).map(p => ({
      name: p.athlete?.displayName,
      jersey: p.jersey,
      position: p.position?.abbreviation
    }))
  }));

  // Game Info
  const gameInfo = {
    venue: summary.gameInfo?.venue?.fullName ? `${summary.gameInfo.venue.fullName}, ${summary.gameInfo.venue.address?.city || ''}` : null,
    attendance: summary.gameInfo?.attendance ? Number(summary.gameInfo.attendance).toLocaleString() : null,
    officials: summary.gameInfo?.officials?.map(o => o.displayName).join(', ') || null
  };

  // Extract real market odds from ESPN pickcenter or competition odds
  const espnOdds = comp?.odds?.[0] || summary.odds?.[0] || summary.pickcenter?.[0];
  let realOdds = null;
  if (espnOdds) {
    const americanToDecimal = (am) => {
      const n = parseFloat(am);
      if (isNaN(n)) return null;
      if (n > 0) return Number(((n / 100) + 1).toFixed(2));
      if (n < 0) return Number(((100 / Math.abs(n)) + 1).toFixed(2));
      return null;
    };

    realOdds = {
      provider: espnOdds.provider?.name || 'DraftKings / ESPN',
      details: espnOdds.details || null,
      overUnder: espnOdds.overUnder || (espnOdds.total ? `O/U ${espnOdds.total}` : null),
      spread: espnOdds.spread || null,
      homeOdds: espnOdds.homeTeamOdds?.decimalOdds || americanToDecimal(espnOdds.homeTeamOdds?.moneyLine || espnOdds.homeTeamOdds?.close?.moneyLine),
      awayOdds: espnOdds.awayTeamOdds?.decimalOdds || americanToDecimal(espnOdds.awayTeamOdds?.moneyLine || espnOdds.awayTeamOdds?.close?.moneyLine),
      drawOdds: espnOdds.drawOdds?.decimalOdds || americanToDecimal(espnOdds.drawOdds?.moneyLine || espnOdds.drawOdds?.close?.moneyLine),
      favorite: espnOdds.homeTeamOdds?.favorite ? 'home' : espnOdds.awayTeamOdds?.favorite ? 'away' : 'draw'
    };
  }

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
        date: e.gameDate ? e.gameDate.split('T')[0] : '',
        opponent: e.opponent?.displayName || e.opponent?.abbreviation || 'Rival',
        score: e.score || `${e.homeTeamScore || 0}-${e.awayTeamScore || 0}`,
        result: e.gameResult || (Number(e.homeTeamScore) > Number(e.awayTeamScore) ? 'W' : Number(e.homeTeamScore) < Number(e.awayTeamScore) ? 'L' : 'D'),
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
    timeStr: isLive ? `EN VIVO · ${minute}` : isFinished ? 'FINALIZADO' : (comp?.status?.type?.detail || 'Por Iniciar'),
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
      odds: realOdds?.homeOdds || null,
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
      odds: realOdds?.awayOdds || null,
      yellowCards: awayCards.yellows,
      redCards: awayCards.reds,
      form: recentForm.away.form,
      recentGames: recentForm.away.games,
    },
    oddsInfo: realOdds,
    stats: parsedStats,
    scorers: scorers,
    commentary: commentaryList,
    rosters: rostersList,
    recentForm: recentForm,
    h2hHistory: h2hHistory,
    gameInfo: gameInfo,
    rawKeyEvents: keyEvents
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

  let title = 'FÚTBOL INTERNACIONAL';
  let category = 'Fútbol';

  if (slug.includes('premier-league') || allText.includes('premier league')) {
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

function findStatInBox(box, name) {
  if (!box || !box.statistics) return 0;
  const s = box.statistics.find(st => st.name === name || st.label?.toLowerCase() === name.toLowerCase());
  return s ? parseInt(s.displayValue, 10) || 0 : 0;
}

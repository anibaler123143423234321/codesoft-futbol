// Test exact parseEspnSummary logic on 401905956
async function testExactParse() {
  const matchId = '401905956';
  const res = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${matchId}`);
  const summary = await res.json();
  
  const comp = summary.header?.competitions?.[0];
  const competitors = comp?.competitors || [];
  const home = competitors.find(c => c.homeAway === 'home') || competitors[0];
  const away = competitors.find(c => c.homeAway === 'away') || competitors[1];

  const boxTeams = summary.boxscore?.teams || [];
  const homeBox = boxTeams[0];
  const awayBox = boxTeams[1];

  const isFinished = comp?.status?.type?.state === 'post' || comp?.status?.type?.completed === true || comp?.status?.type?.name?.includes('FINAL') || comp?.status?.type?.name?.includes('FULL_TIME');
  const isLive = !isFinished && (comp?.status?.type?.state === 'in' || comp?.status?.type?.name?.includes('IN_PROGRESS'));
  const isScheduled = !isFinished && !isLive;
  const minute = isFinished ? 'FT' : isLive ? (comp?.status?.displayClock ? `${comp?.status?.displayClock}'` : '1\'') : (comp?.status?.type?.detail || comp?.status?.type?.shortDetail || 'Por Iniciar');

  console.log({
    state: comp?.status?.type?.state,
    name: comp?.status?.type?.name,
    detail: comp?.status?.type?.detail,
    displayClock: comp?.status?.displayClock,
    isFinished,
    isLive,
    isScheduled,
    minute
  });

  const hasOfficialStats = homeBox?.statistics && homeBox.statistics.length > 0;
  console.log('hasOfficialStats:', hasOfficialStats);
  const hasInGameStats = (isLive || isFinished) && homeBox.statistics.some(s => s.name === 'possessionPct' || s.name === 'totalShots');
  console.log('hasInGameStats:', hasInGameStats);
}

testExactParse();

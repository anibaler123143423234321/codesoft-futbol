// Inspect event 401905956 from scoreboard
async function inspectEvent() {
  const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard');
  const data = await res.json();
  const ev = data.events?.find(e => e.id === '401905956' || e.name?.includes('Bayern'));
  console.log('Event status:', JSON.stringify(ev?.status, null, 2));
  console.log('Competitors scores:', ev?.competitions?.[0]?.competitors?.map(c => ({
    name: c.team?.displayName,
    homeAway: c.homeAway,
    score: c.score,
    order: c.order
  })));
}

inspectEvent();

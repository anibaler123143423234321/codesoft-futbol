// Test Cerebras Models & ESPN Bayern Munich match
const apiKey = 'csk-rt2jc6pkt4cw4h9996dkkmkydpxwxw83he9dwyv2jr4c9ec4';

async function listCerebrasModels() {
  try {
    const res = await fetch('https://api.cerebras.ai/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    console.log('Cerebras /v1/models Status:', res.status);
    const data = await res.json();
    console.log('Cerebras Models:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Cerebras error:', err);
  }
}

async function checkEspnBayern() {
  try {
    const res = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/ger.1/scoreboard');
    const data = await res.json();
    console.log('Bundesliga events count:', data.events?.length);
    if (data.events) {
      data.events.forEach(e => {
        console.log(`- ${e.name} (id: ${e.id}, status: ${e.status?.type?.detail}, clock: ${e.status?.displayClock})`);
      });
    }
    
    // Also check all scoreboards
    const allRes = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard');
    const allData = await allRes.json();
    const bayernEvent = allData.events?.find(e => e.name?.toLowerCase().includes('bayern') || e.name?.toLowerCase().includes('heidenheim'));
    if (bayernEvent) {
      console.log('Found Bayern Event in all:', bayernEvent.name, bayernEvent.id, bayernEvent.status?.type?.detail, bayernEvent.status?.displayClock);
      
      // Fetch summary
      const sumRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${bayernEvent.id}`);
      const sumData = await sumRes.json();
      console.log('Summary boxscore teams:', sumData.boxscore?.teams?.length);
      console.log('Summary stats 0:', sumData.boxscore?.teams?.[0]?.statistics?.map(s => `${s.name}: ${s.displayValue}`));
      console.log('Summary pickcenter:', sumData.pickcenter);
    }
  } catch (err) {
    console.error('ESPN error:', err);
  }
}

async function run() {
  console.log('=== 1. CEREBRAS MODELS ===');
  await listCerebrasModels();
  console.log('\n=== 2. ESPN BAYERN MATCH ===');
  await checkEspnBayern();
}

run();

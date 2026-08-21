// Test ESPN league parameter for Bayern
async function testEspnSummary() {
  const matchId = '401905956';
  
  // Try with soccer/all
  const resAll = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/all/summary?event=${matchId}`);
  console.log('soccer/all status:', resAll.status);

  // Try with soccer/ger.1
  const resGer = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/ger.1/summary?event=${matchId}`);
  console.log('soccer/ger.1 status:', resGer.status);
}

testEspnSummary();

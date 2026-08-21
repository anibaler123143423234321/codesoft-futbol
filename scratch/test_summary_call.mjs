// Test fetchEspnMatchSummary in espnApi.js directly
import { fetchEspnMatchSummary } from '../src/api/espnApi.js';

async function testSummary() {
  const res = await fetchEspnMatchSummary('401905956', 'all');
  console.log('Summary returned:', {
    id: res?.id,
    status: res?.status,
    minute: res?.minute,
    hasStats: !!res?.stats,
    statsHasData: res?.stats?.hasData,
    attack: res?.stats?.attack?.map(a => `${a.label}: ${a.home} - ${a.away}`)
  });
}

testSummary();

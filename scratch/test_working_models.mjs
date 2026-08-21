// Test Cerebras gpt-oss-120b and gemma-4-31b
const apiKey = 'csk-rt2jc6pkt4cw4h9996dkkmkydpxwxw83he9dwyv2jr4c9ec4';

async function testWorkingModels() {
  const models = ['gpt-oss-120b', 'gemma-4-31b'];
  for (const m of models) {
    console.log(`Testing ${m}...`);
    try {
      const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: m,
          messages: [
            { role: 'user', content: 'Say hello in 5 words' }
          ],
          max_completion_tokens: 30
        })
      });
      console.log(`Status for ${m}:`, res.status);
      const data = await res.json();
      console.log(`Result for ${m}:`, data.choices?.[0]?.message?.content);
    } catch (err) {
      console.error(err);
    }
  }
}

testWorkingModels();

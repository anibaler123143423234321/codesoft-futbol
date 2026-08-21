// Test Cerebras API live
const apiKey = 'csk-rt2jc6pkt4cw4h9996dkkmkydpxwxw83he9dwyv2jr4c9ec4';

async function testCerebras() {
  const modelsToTry = [
    'llama-3.3-70b',
    'llama3.1-8b',
    'llama3.1-70b',
    'deepseek-r1-distill-llama-70b',
    'qwen-2.5-72b'
  ];

  for (const model of modelsToTry) {
    try {
      console.log(`Testing model: ${model}...`);
      const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: 'user', content: 'Say hello in 5 words' }
          ],
          max_completion_tokens: 50
        })
      });

      console.log(`Status: ${res.status}`);
      if (res.ok) {
        const data = await res.json();
        console.log(`SUCCESS with ${model}:`, data.choices[0]?.message?.content);
        return model;
      } else {
        const errText = await res.text();
        console.log(`FAILED with ${model}:`, errText);
      }
    } catch (e) {
      console.error(e);
    }
  }
}

testCerebras();

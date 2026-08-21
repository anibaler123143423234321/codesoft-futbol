// Test Cerebras with new key from .env
const apiKey = '6eda36d43afc57e1605085f4190fed1c';

async function testNewKey() {
  const models = ['gpt-oss-120b', 'gemma-4-31b', 'llama3.1-8b', 'llama-3.3-70b'];
  for (const m of models) {
    try {
      const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: m,
          messages: [{ role: 'user', content: 'Say hello' }]
        })
      });
      console.log(`Key test for ${m}:`, res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('SUCCESS:', data.choices[0]?.message?.content);
      }
    } catch (e) {
      console.error(e);
    }
  }
}

testNewKey();

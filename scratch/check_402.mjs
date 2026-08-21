const apiKey = 'csk-rt2jc6pkt4cw4h9996dkkmkydpxwxw83he9dwyv2jr4c9ec4';

async function check402() {
  const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-oss-120b',
      messages: [{ role: 'user', content: 'test' }]
    })
  });
  console.log('Status:', res.status);
  console.log('Body:', await res.text());
}

check402();

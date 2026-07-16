const ZEN_KEY = process.env.ZEN_API_KEY;
const OC_ZEN_KEY = process.env.OPENCODE_ZEN_API_KEY;

const BASE = 'https://opencode.ai/zen/v1';

async function test(endpoint, key, model, body) {
  const url = BASE + '/' + endpoint;
  const headers = {
    'Authorization': 'Bearer ' + key,
    'Content-Type': 'application/json',
    'User-Agent': 'test-script'
  };
  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    const status = res.status;
    const text = await res.text();
    return { status, text: text.substring(0, 300) };
  } catch (e) {
    return { status: 'NET_ERR', text: e.message.substring(0, 100) };
  }
}

async function testGet(endpoint, key) {
  const url = BASE + '/' + endpoint;
  const headers = {
    'Authorization': 'Bearer ' + key,
    'User-Agent': 'test-script'
  };
  try {
    const res = await fetch(url, { method: 'GET', headers });
    const status = res.status;
    const text = await res.text();
    return { status, text: text.substring(0, 500) };
  } catch (e) {
    return { status: 'NET_ERR', text: e.message.substring(0, 100) };
  }
}

async function main() {
  const keys = [
    { name: 'ZEN_API_KEY', key: ZEN_KEY },
    { name: 'OPENCODE_ZEN_API_KEY', key: OC_ZEN_KEY }
  ];

  for (const k of keys) {
    if (!k.key) { console.log(k.name + ': NO KEY'); continue; }
    console.log('\n=== ' + k.name + ' (' + k.key.substring(0, 10) + '...) ===');
    
    // Test GET models
    const modelsR = await testGet('models', k.key);
    console.log('  GET /models:', modelsR.status);
    
    // Test chat completions with free model
    const ccR = await test('chat/completions', k.key, 'deepseek-v4-flash-free', {
      model: 'deepseek-v4-flash-free',
      messages: [{ role: 'user', content: 'Say OK' }],
      max_tokens: 10
    });
    console.log('  POST /chat/completions (free):', ccR.status, ccR.text.substring(0, 100));
    
    // Test images endpoint
    const imgR = await test('images/generations', k.key, 'dall-e-3', {
      model: 'dall-e-3',
      prompt: 'test',
      n: 1,
      size: '1024x1024'
    });
    console.log('  POST /images/generations:', imgR.status, imgR.text.substring(0, 100));
  }
}

main().catch(console.error);

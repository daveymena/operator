const ZEN_KEY = process.env.ZEN_API_KEY;
const BASE = 'https://opencode.ai/zen/v1';

async function call(endpoint, body, key = ZEN_KEY) {
  const res = await fetch(BASE + '/' + endpoint, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json',
      'User-Agent': 'test-script'
    },
    body: JSON.stringify(body)
  });
  const status = res.status;
  const text = await res.text();
  return { status, text: text.substring(0, 2000) };
}

async function main() {
  // Test 1: Try responses endpoint with GPT-5.6 Terra asking for an image
  console.log('=== Test 1: GPT-5.6 Terra /responses ===');
  const r1 = await call('responses', {
    model: 'gpt-5.6-terra',
    input: 'Generate a simple test image of a red circle on white background. Tell me what you generated.',
  });
  console.log('Status:', r1.status, '\nResponse:', r1.text.substring(0, 500));
  
  console.log('\n=== Test 2: Gemini 3.5 Flash /models/gemini-3.5-flash ===');
  // Try Gemini with multimodal input asking for image
  const r2 = await call('models/gemini-3.5-flash', {
    contents: [{
      role: 'user',
      parts: [{ text: 'Create an image of a blue square. Tell me what you created.' }]
    }],
    generationConfig: { responseModalities: ['Text', 'Image'] }
  });
  console.log('Status:', r2.status, '\nResponse:', r2.text.substring(0, 500));
  
  console.log('\n=== Test 3: Claude 5 Sonnet /messages ===');
  const r3 = await call('messages', {
    model: 'claude-sonnet-5',
    max_tokens: 500,
    messages: [{ role: 'user', content: 'Generate an image of a simple logo for a company called TechLearn. Describe what image you would create.' }]
  });
  console.log('Status:', r3.status, '\nResponse:', r3.text.substring(0, 500));
  
  // Test 4: Try with image generation through chat completions using Gemini via chat/completions
  console.log('\n=== Test 4: Gemini via chat/completions ===');
  const r4 = await call('chat/completions', {
    model: 'gemini-3.5-flash',
    messages: [{ role: 'user', content: 'Generate a Facebook ad image 1200x630 for cursos digitales with Spanish text. Return the image as markdown data URL.' }]
  });
  console.log('Status:', r4.status, '\nResponse:', r4.text.substring(0, 500));
}

main().catch(console.error);

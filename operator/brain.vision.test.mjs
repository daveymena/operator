import { test } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { Brain } from './brain.mjs';

function withEnv(vars, fn) {
  const prev = {};
  for (const k of Object.keys(vars)) { prev[k] = process.env[k]; process.env[k] = vars[k]; }
  return Promise.resolve(fn()).finally(() => {
    for (const k of Object.keys(vars)) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });
}

test('describeImage prefers the highest-priority configured vision provider and attaches the image', async () => {
  await withEnv({ GROQ_API_KEY: 'k', ANTHROPIC_API_KEY: 'k', GOOGLE_API_KEY: 'k' }, async () => {
    const originalPost = axios.post;
    const calls = [];
    axios.post = async (url, body, config) => {
      calls.push({ url, body, headers: config?.headers });
      if (url.includes('groq')) return { data: { choices: [{ message: { content: 'GROQ_DESC' } }] } };
      throw new Error('should not reach other providers when groq succeeds');
    };
    try {
      const brain = new Brain({ verbose: false });
      const result = await brain.describeImage('ZmFrZQ==', { prompt: 'p' });
      assert.equal(result, 'GROQ_DESC');
      assert.equal(calls.length, 1);
      assert.match(calls[0].url, /groq/);
      const content = calls[0].body.messages[0].content;
      assert.ok(content.some(c => c.type === 'image_url' && c.image_url.url.includes('ZmFrZQ==')));
    } finally {
      axios.post = originalPost;
    }
  });
});

test('describeImage falls back across providers using the correct request shape for each', async () => {
  await withEnv({ GROQ_API_KEY: 'k', ANTHROPIC_API_KEY: 'k' }, async () => {
    const originalPost = axios.post;
    axios.post = async (url) => {
      if (url.includes('groq')) throw new Error('groq down');
      if (url.includes('anthropic')) return { data: { content: [{ text: 'ANTHROPIC_DESC' }] } };
      throw new Error('unexpected url: ' + url);
    };
    try {
      const brain = new Brain({ verbose: false });
      const result = await brain.describeImage('ZmFrZQ==', {});
      assert.equal(result, 'ANTHROPIC_DESC');
    } finally {
      axios.post = originalPost;
    }
  });
});

test('describeImage skips providers without a configured API key', async () => {
  await withEnv({ GOOGLE_API_KEY: 'k' }, async () => {
    delete process.env.GROQ_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const originalPost = axios.post;
    axios.post = async (url) => {
      if (url.includes('generativelanguage')) return { data: { candidates: [{ content: { parts: [{ text: 'GEMINI_DESC' }] } }] } };
      throw new Error('unexpected url: ' + url);
    };
    try {
      const brain = new Brain({ verbose: false });
      const candidates = brain._visionCandidates();
      assert.ok(!candidates.some(p => p.id === 'groq' || p.id === 'anthropic'));
      const result = await brain.describeImage('ZmFrZQ==', {});
      assert.equal(result, 'GEMINI_DESC');
    } finally {
      axios.post = originalPost;
    }
  });
});

test('describeImage returns a placeholder when no vision provider is configured', async () => {
  await withEnv({}, async () => {
    for (const k of ['GROQ_API_KEY', 'ANTHROPIC_API_KEY', 'GOOGLE_API_KEY', 'OPENCODE_ZEN_API_KEY', 'OPENCODE_GO_API_KEY', 'GITHUB_COPILOT_TOKEN', 'NVIDIA_API_KEY', 'OPENAI_API_KEY', 'GLM_API_KEY', 'XIAOMI_API_KEY', 'XAI_API_KEY', 'DASHSCOPE_API_KEY']) {
      delete process.env[k];
    }
    const brain = new Brain({ verbose: false });
    const result = await brain.describeImage('ZmFrZQ==', {});
    assert.match(result, /Análisis visual no disponible/);
  });
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'http';
import { OperatorServer } from './api-v4.mjs';

async function startFakeServer(brain) {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use((req, res, next) => { req.user = { permissions: ['vision:analyze'] }; next(); });

  const fakeAuth = { requirePermission: () => (req, res, next) => next() };
  OperatorServer.prototype._setupVisionRoutes.call({ app, auth: fakeAuth, orchestrator: { brain } });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return { server, url: `http://localhost:${port}/api/vision/image` };
}

test('POST /api/vision/image analyzes a base64 image from a JSON body', async () => {
  const brain = { describeImage: async (base64, opts) => `DESC:${base64}:${opts.mimeType}:${opts.prompt}` };
  const { server, url } = await startFakeServer(brain);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64: 'ZmFrZQ==', mimeType: 'image/jpeg', question: 'que es?' })
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.description, 'DESC:ZmFrZQ==:image/jpeg:que es?');
  } finally {
    server.close();
  }
});

test('POST /api/vision/image analyzes a multipart file upload', async () => {
  const brain = { describeImage: async (base64, opts) => `DESC:${base64.length}b:${opts.mimeType}` };
  const { server, url } = await startFakeServer(brain);
  try {
    const form = new FormData();
    form.append('image', new Blob([Buffer.from('fake-image-bytes')], { type: 'image/png' }), 'test.png');
    const res = await fetch(url, { method: 'POST', body: form });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.match(body.description, /^DESC:\d+b:image\/png$/);
  } finally {
    server.close();
  }
});

test('POST /api/vision/image rejects a request with no image data', async () => {
  const { server, url } = await startFakeServer({ describeImage: async () => 'unused' });
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test('POST /api/vision/image returns 503 when the vision engine is not initialized', async () => {
  const { server, url } = await startFakeServer(null);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64: 'ZmFrZQ==' })
    });
    assert.equal(res.status, 503);
  } finally {
    server.close();
  }
});

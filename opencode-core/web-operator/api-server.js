import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { sendPending, getStatus, getReport } from '../skills/claro-agent/skill.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.OPERATOR_API_PORT || '3001');
const app = express();
app.use(cors());
app.use(express.json({ limit: '100mb' }));

const SKILL_DATA_DIR = process.env.CLARO_SKILL_DATA || path.join(process.cwd(), 'skills-data', 'claro-agent');

// ─── Status ───────────────────────────────────────────────────────
app.get('/api/status', (_, res) => {
  res.json({ running: true, mode: 'web-operator', services: ['skills/claro-agent'] });
});

app.get('/api/browser', (_, res) => {
  res.json({ running: false, message: 'Browser controller no disponible' });
});

app.post('/api/run', (_, res) => {
  res.json({ ok: false, error: 'Usa POST /api/skills/claro/* para el agente Claro' });
});

// ─── Claro Agent Skill ───────────────────────────────────────────
app.get('/api/skills/claro/status', (_, res) => {
  try {
    res.json({ ok: true, status: 'online', ...getStatus() });
  } catch (e) {
    res.json({ ok: false, status: 'error', error: e.message });
  }
});

app.post('/api/skills/claro/order', async (req, res) => {
  try {
    const body = req.body || {};
    // Acepta: { order: {...}, pendingJson: "ruta" } o una orden suelta
    const pendingJson = body.pendingJson || null;
    const result = await sendPending({ pendingJson, test: !!body.test });
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/skills/claro/run-pending', async (req, res) => {
  try {
    const body = req.body || {};
    const result = await sendPending({ pendingJson: body.pendingJson || null, test: !!body.test });
    res.json(result);
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.get('/api/skills/claro/report', (_, res) => {
  try {
    res.json({ ok: true, report: getReport() });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

app.get('/health', (_, res) => {
  res.json({ status: 'ok', service: 'web-operator', claroData: SKILL_DATA_DIR });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[web-operator] Corriendo en puerto ${PORT}`);
  console.log(`[web-operator] Claro skill data dir: ${SKILL_DATA_DIR}`);
});

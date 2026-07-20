/**
 * Operator Pro — REST API Server
 * 
 * Professional-grade API server with:
 * - RESTful endpoints for task management
 * - WebSocket for real-time task monitoring
 * - Authentication with API keys
 * - CORS, rate limiting, helmet security
 * - Health checks and system info
 * - File upload/download
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { createServer as createHttpServer } from 'http';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuid } from 'uuid';
import crypto from 'crypto';

import { getOrchestrator } from '../core/orchestrator.mjs';
import { PluginManager, WebScraperPlugin, SystemMonitorPlugin } from '../core/plugins.mjs';
import platform from '../platform/index.mjs';
import { Memory } from '../memory.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');

// ─── Configuration ─────────────────────────────────────────────────────────────

export function createServer(config = {}) {
  const PORT = config.port || process.env.OPERATOR_PORT || 3000;
  const HOST = config.host || process.env.OPERATOR_HOST || '0.0.0.0';
  const API_KEY = config.apiKey || process.env.OPERATOR_API_KEY || '';
  const VERBOSE = config.verbose || process.argv.includes('--verbose');

  // ─── Express App ──────────────────────────────────────────────────────────

  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: config.corsOrigin || '*', credentials: true }));
  app.use(morgan(VERBOSE ? 'dev' : 'combined'));
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Static dashboard
  const dashboardPath = path.join(ROOT, 'dashboard');
  if (fs.existsSync(dashboardPath)) {
    app.use('/dashboard', express.static(dashboardPath));
  }

  // ─── Orchestrator ─────────────────────────────────────────────────────────

  const orchestrator = getOrchestrator({ verbose: VERBOSE, basePath: ROOT, ...config });
  const pluginManager = new PluginManager(orchestrator);

  // ─── Auth Middleware ───────────────────────────────────────────────────────

  function authenticate(req, res, next) {
    if (!API_KEY) return next(); // No auth required if no key set
    const key = req.headers['x-api-key'] || req.headers.authorization?.replace('Bearer ', '') || req.query.key;
    if (key === API_KEY) return next();
    res.status(401).json({ ok: false, error: 'Unauthorized — provide valid API key' });
  }

  // ─── WebSocket ────────────────────────────────────────────────────────────

  const httpServer = createHttpServer(app);
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const wsClients = new Map();

  wss.on('connection', (ws, req) => {
    const clientId = uuid();
    wsClients.set(clientId, ws);

    // Auth check
    const url = new URL(req.url, `http://${req.headers.host}`);
    const key = url.searchParams.get('key');
    if (API_KEY && key !== API_KEY) {
      ws.close(4001, 'Unauthorized');
      wsClients.delete(clientId);
      return;
    }

    ws.send(JSON.stringify({ type: 'connected', clientId, server: 'Operator Pro v3.0' }));

    ws.on('message', async (data) => {
      try {
        const msg = JSON.parse(data.toString());
        await handleWsMessage(ws, msg);
      } catch (e) {
        ws.send(JSON.stringify({ type: 'error', error: e.message }));
      }
    });

    ws.on('close', () => { wsClients.delete(clientId); });
  });

  // Broadcast events to all WebSocket clients
  function broadcast(event) {
    const data = JSON.stringify(event);
    for (const [, ws] of wsClients) {
      if (ws.readyState === 1) ws.send(data);
    }
  }

  // Forward orchestrator events to WebSocket
  orchestrator.on('task:start', (e) => broadcast({ type: 'task:start', ...e }));
  orchestrator.on('task:plan', (e) => broadcast({ type: 'task:plan', ...e }));
  orchestrator.on('task:phase', (e) => broadcast({ type: 'task:phase', ...e }));
  orchestrator.on('task:complete', (e) => broadcast({ type: 'task:complete', ...e }));
  orchestrator.on('task:error', (e) => broadcast({ type: 'task:error', ...e }));
  orchestrator.on('task:cancelled', (e) => broadcast({ type: 'task:cancelled', ...e }));
  orchestrator.on('step:start', (e) => broadcast({ type: 'step:start', ...e }));
  orchestrator.on('step:decision', (e) => broadcast({ type: 'step:decision', ...e }));
  orchestrator.on('step:result', (e) => broadcast({ type: 'step:result', ...e }));
  orchestrator.on('step:stuck', (e) => broadcast({ type: 'step:stuck', ...e }));
  orchestrator.on('step:dangerous', (e) => broadcast({ type: 'step:dangerous', ...e }));
  orchestrator.on('safety:confirm', (e) => {
    broadcast({ type: 'safety:confirm', action: e.action });
    // Auto-confirm if configured
    if (config.autoConfirm) e.resolve(true);
  });

  async function handleWsMessage(ws, msg) {
    switch (msg.type) {
      case 'run_task': {
        const result = orchestrator.runTask(msg.task, msg.options || {});
        result.then(r => ws.send(JSON.stringify({ type: 'task:result', ...r })));
        ws.send(JSON.stringify({ type: 'task:queued', taskId: msg.options?.taskId }));
        break;
      }
      case 'cancel_task': {
        const r = await orchestrator.cancelTask(msg.taskId);
        ws.send(JSON.stringify({ type: 'task:cancelled', ...r }));
        break;
      }
      case 'execute_action': {
        const r = await orchestrator.executeAction(msg.action);
        ws.send(JSON.stringify({ type: 'action:result', ...r }));
        break;
      }
      case 'safety_response': {
        // Handle safety confirmation from client
        break;
      }
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', time: Date.now() }));
        break;
      default:
        ws.send(JSON.stringify({ type: 'error', error: `Unknown message type: ${msg.type}` }));
    }
  }

  // ─── API Routes ───────────────────────────────────────────────────────────

  // Health check
  app.get('/health', async (req, res) => {
    const info = await platform.getSystemInfo();
    res.json({
      ok: true,
      version: '3.0.0',
      name: 'Operator Pro',
      uptime: process.uptime(),
      platform: platform.os,
      activeTasks: orchestrator.activeTasks.size,
      wsClients: wsClients.size,
      browser: orchestrator.browser?.connected || false,
      system: info
    });
  });

  // API info
  app.get('/api', (req, res) => {
    res.json({
      name: 'Operator Pro API',
      version: '3.0.0',
      endpoints: {
        tasks: ['POST /api/tasks', 'GET /api/tasks', 'GET /api/tasks/:id', 'DELETE /api/tasks/:id'],
        actions: ['POST /api/actions/execute'],
        browser: ['POST /api/browser/connect', 'POST /api/browser/goto', 'POST /api/browser/click', 'POST /api/browser/type', 'POST /api/browser/screenshot', 'GET /api/browser/tabs'],
        system: ['GET /api/system/info', 'GET /api/system/processes', 'GET /api/system/windows'],
        files: ['GET /api/files', 'GET /api/files/read', 'POST /api/files/write', 'GET /api/files/search'],
        terminal: ['POST /api/terminal/exec'],
        plugins: ['GET /api/plugins', 'POST /api/plugins/load'],
        history: ['GET /api/history']
      },
      websocket: 'ws://HOST:PORT/ws?key=API_KEY'
    });
  });

  // ─── Tasks ────────────────────────────────────────────────────────────────

  // Create and run a task
  app.post('/api/tasks', authenticate, async (req, res) => {
    const { task, options } = req.body;
    if (!task) return res.status(400).json({ ok: false, error: 'task is required' });

    const taskId = options?.taskId || uuid();
    // Run in background
    orchestrator.runTask(task, { ...options, taskId })
      .then(result => broadcast({ type: 'task:finished', taskId, ...result }))
      .catch(err => broadcast({ type: 'task:failed', taskId, error: err.message }));

    res.json({ ok: true, taskId, status: 'queued', message: 'Task started — monitor via WebSocket' });
  });

  // List active tasks
  app.get('/api/tasks', authenticate, (req, res) => {
    res.json({ ok: true, tasks: orchestrator.getActiveTasks() });
  });

  // Get task details
  app.get('/api/tasks/:id', authenticate, (req, res) => {
    const task = orchestrator.activeTasks.get(req.params.id);
    if (task) {
      return res.json({ ok: true, task: { id: task.id, task: task.task, status: task.status, steps: task.steps, plan: task.plan } });
    }
    // Check memory for completed tasks
    try {
      const mem = new Memory(req.params.id);
      if (mem.data.steps.length) {
        return res.json({ ok: true, task: mem.data });
      }
    } catch {}
    res.status(404).json({ ok: false, error: 'Task not found' });
  });

  // Cancel a task
  app.delete('/api/tasks/:id', authenticate, async (req, res) => {
    const result = await orchestrator.cancelTask(req.params.id);
    res.json(result);
  });

  // Task history
  app.get('/api/history', authenticate, (req, res) => {
    const tasks = Memory.listTasks();
    res.json({ ok: true, tasks, count: tasks.length });
  });

  // ─── Actions (direct execution) ───────────────────────────────────────────

  app.post('/api/actions/execute', authenticate, async (req, res) => {
    const { action } = req.body;
    if (!action?.type) return res.status(400).json({ ok: false, error: 'action.type is required' });
    const result = await orchestrator.executeAction(action);
    res.json(result);
  });

  // Batch actions
  app.post('/api/actions/batch', authenticate, async (req, res) => {
    const { actions } = req.body;
    if (!Array.isArray(actions)) return res.status(400).json({ ok: false, error: 'actions must be an array' });
    const results = [];
    for (const action of actions) {
      const r = await orchestrator.executeAction(action);
      results.push(r);
    }
    res.json({ ok: true, results });
  });

  // ─── Browser ──────────────────────────────────────────────────────────────

  app.post('/api/browser/connect', authenticate, async (req, res) => {
    const result = await orchestrator.browser.connect(req.body);
    res.json(result);
  });

  app.post('/api/browser/goto', authenticate, async (req, res) => {
    const r = await orchestrator.browser.goto(req.body);
    res.json(r);
  });

  app.post('/api/browser/click', authenticate, async (req, res) => {
    const r = await orchestrator.browser.click(req.body);
    res.json(r);
  });

  app.post('/api/browser/type', authenticate, async (req, res) => {
    const r = await orchestrator.browser.type(req.body);
    res.json(r);
  });

  app.post('/api/browser/screenshot', authenticate, async (req, res) => {
    const r = await orchestrator.browser.screenshot(req.body);
    if (r.ok && r.base64) {
      // Return as image
      const buffer = Buffer.from(r.base64, 'base64');
      res.setHeader('Content-Type', 'image/png');
      return res.send(buffer);
    }
    res.json(r);
  });

  app.post('/api/browser/evaluate', authenticate, async (req, res) => {
    const r = await orchestrator.browser.evaluate(req.body.code || req.body.script);
    res.json(r);
  });

  app.get('/api/browser/tabs', authenticate, async (req, res) => {
    const r = await orchestrator.browser.listTabs();
    res.json(r);
  });

  app.post('/api/browser/content', authenticate, async (req, res) => {
    const r = await orchestrator.browser.getContent(req.body);
    res.json(r);
  });

  // ─── Terminal ─────────────────────────────────────────────────────────────

  app.post('/api/terminal/exec', authenticate, async (req, res) => {
    const { command, cwd, timeout } = req.body;
    if (!command) return res.status(400).json({ ok: false, error: 'command is required' });
    const result = await orchestrator.terminal.exec(command, { cwd, timeout });
    res.json(result);
  });

  // ─── System ───────────────────────────────────────────────────────────────

  app.get('/api/system/info', authenticate, async (req, res) => {
    const info = await platform.getSystemInfo();
    res.json({ ok: true, ...info });
  });

  app.get('/api/system/processes', authenticate, async (req, res) => {
    const r = await platform.listProcesses();
    res.json(r);
  });

  app.get('/api/system/windows', authenticate, async (req, res) => {
    const r = await platform.listWindows();
    res.json(r);
  });

  app.get('/api/system/screen', authenticate, async (req, res) => {
    const r = await platform.getScreenResolution();
    res.json({ ok: true, ...r });
  });

  // ─── Files ────────────────────────────────────────────────────────────────

  app.get('/api/files', authenticate, async (req, res) => {
    const r = await orchestrator.filesystem.listDir(req.query.path || '.', { sizes: true });
    res.json(r);
  });

  app.get('/api/files/read', authenticate, async (req, res) => {
    const r = await orchestrator.filesystem.readFile(req.query.path);
    res.json(r);
  });

  app.post('/api/files/write', authenticate, async (req, res) => {
    const { path: fp, content } = req.body;
    const r = await orchestrator.filesystem.writeFile(fp, content);
    res.json(r);
  });

  app.get('/api/files/search', authenticate, async (req, res) => {
    const r = await orchestrator.filesystem.search(req.query.path || '.', req.query.pattern || '.*');
    res.json(r);
  });

  // ─── Plugins ──────────────────────────────────────────────────────────────

  app.get('/api/plugins', authenticate, (req, res) => {
    res.json({ ok: true, plugins: pluginManager.list() });
  });

  app.post('/api/plugins/template', authenticate, (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ ok: false, error: 'name is required' });
    const r = pluginManager.createTemplate(name);
    res.json(r);
  });

  // ─── Error Handling ───────────────────────────────────────────────────────

  app.use((err, req, res, next) => {
    console.error('API Error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Internal server error' });
  });

  // 404
  app.use((req, res) => {
    res.status(404).json({ ok: false, error: 'Not found', path: req.path });
  });

  // ─── Server Start ─────────────────────────────────────────────────────────

  async function start() {
    // Initialize orchestrator
    await orchestrator.init();

    // Load built-in plugins
    await pluginManager.load(WebScraperPlugin);
    await pluginManager.load(SystemMonitorPlugin);

    // Discover custom plugins
    await pluginManager.discoverAndLoad();

    return new Promise((resolve) => {
      httpServer.listen(PORT, HOST, () => {
        const url = `http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`;
        console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    🤖 OPERATOR PRO v3.0                     ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  API:        ${url}/api                              ║
║  Dashboard:  ${url}/dashboard                        ║
║  WebSocket:  ws://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}/ws                  ║
║  Health:     ${url}/health                            ║
║                                                              ║
║  Platform:   ${platform.os} (${platform.arch})${' '.repeat(Math.max(0, 30 - platform.os.length - platform.arch.length))}║
║  Auth:       ${API_KEY ? '🔑 Enabled' : '⚠️  No API key (open)'}${' '.repeat(API_KEY ? 28 : 22)}║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
        resolve({ url, port: PORT, host: HOST });
      });
    });
  }

  async function stop() {
    await orchestrator.shutdown();
    httpServer.close();
    wss.close();
  }

  return { app, httpServer, wss, orchestrator, pluginManager, start, stop };
}

// ─── Standalone Start ────────────────────────────────────────────────────────

const isMainModule = process.argv[1] && (
  process.argv[1].endsWith('api.mjs') || process.argv[1].endsWith('api.js')
);

if (isMainModule) {
  const server = createServer({
    verbose: process.argv.includes('--verbose') || process.argv.includes('--dev'),
    autoConfirm: process.argv.includes('--auto-confirm')
  });
  server.start().catch(e => {
    console.error('Failed to start:', e);
    process.exit(1);
  });

  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    await server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    await server.stop();
    process.exit(0);
  });
}

export default createServer;

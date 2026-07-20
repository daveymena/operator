/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║          🌐 Operator Pro API Server — v4.0                   ║
 * ║   Full REST API + WebSocket + Gateway + Auth + Scheduler    ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Endpoints:
 *   Auth:    POST /api/auth/login, POST /api/auth/logout
 *   Tasks:   POST /api/tasks, GET /api/tasks, GET /api/tasks/:id
 *   Browser: POST /api/browser/*, GET /api/browser/screenshot
 *   Terminal:POST /api/terminal/exec
 *   Research:POST /api/research
 *   Schedule:POST /api/scheduler, GET /api/scheduler
 *   Gateway: GET /api/gateway/status, GET /api/gateway/models
 *   Safety:  GET /api/safety/log, POST /api/safety/confirm/:id
 *   System:  GET /api/system/info, GET /health
 */

import express from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import { getAuth } from '../auth/index.mjs';
import { getGateway } from '../gateway/gateway-db.mjs';
import { getSafety } from '../safety/index.mjs';
import { DeepResearch } from '../engines/research.mjs';
import { TaskScheduler } from '../scheduler/index.mjs';
import { getDatabase } from '../db/index.mjs';
import { AutoRestartManager } from './auto-restart.mjs';
import { v4 as uuid } from 'uuid';

export class OperatorServer extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.port = config.port || 3000;
    this.host = config.host || '0.0.0.0';
    this.app = express();
    this.server = null;
    this.wss = null;
    this.auth = getAuth();
    this.safety = getSafety({ watchMode: config.watchMode, autoConfirm: config.autoConfirm });
    this.research = new DeepResearch({ verbose: config.verbose });
    this.scheduler = null;
    this.orchestrator = null;
    this.autoRestart = null;
    this.gateway = null;
    this.db = null;
    this.activeTasks = new Map();
    this.verbose = config.verbose || false;
  }

  async init() {
    // Initialize gateway (async, DB-backed)
    this.gateway = await getGateway({ verbose: this.verbose });
    this.db = await getDatabase();
    this.autoRestart = new AutoRestartManager();

    // Connect auto-restart to token manager
    if (this.gateway.tokenManager) {
      this.autoRestart.init(this, this.gateway.tokenManager);
    }
    this.research = new DeepResearch({ verbose: config.verbose });
    this.scheduler = null;
    this.orchestrator = null;
    this.autoRestart = null;
    this.activeTasks = new Map();
    this.verbose = config.verbose || false;
  }

  async start() {
    // Setup Express
    this.app.use(cors());
    this.app.use(express.json({ limit: '100mb' }));

    // Serve dashboard
    this.app.use('/dashboard', express.static(this.config.dashboardPath || './dashboard'));

    // Public routes (no auth required)
    this._setupPublicRoutes();

    // Auth middleware for API routes
    this.app.use('/api/*', this.auth.middleware());

    // Authenticated API routes
    this._setupAuthRoutes();
    this._setupTaskRoutes();
    this._setupBrowserRoutes();
    this._setupTerminalRoutes();
    this._setupResearchRoutes();
    this._setupSchedulerRoutes();
    this._setupGatewayRoutes();
    this._setupSafetyRoutes();
    this._setupSystemRoutes();
    this._setupTokenRoutes();

    // Error handler
    this.app.use((err, req, res, next) => {
      console.error('[SERVER] Error:', err.message);
      res.status(500).json({ error: err.message });
    });

    // Create HTTP server
    this.server = http.createServer(this.app);

    // WebSocket
    this.wss = new WebSocketServer({ server: this.server, path: '/ws' });
    this._setupWebSocket();

    // Start listening
    return new Promise((resolve) => {
      this.server.listen(this.port, this.host, () => {
        console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
        console.log(`║          🤖 OPERATOR PRO v4.0 — Server Running              ║`);
        console.log(`╚══════════════════════════════════════════════════════════════╝`);
        console.log(`  🌐 Dashboard:  http://localhost:${this.port}/dashboard`);
        console.log(`  📡 API:        http://localhost:${this.port}/api`);
        console.log(`  🔌 WebSocket:  ws://localhost:${this.port}/ws`);
        console.log(`  🏥 Health:     http://localhost:${this.port}/health`);
        console.log(`  📊 Gateway:    ${this.gateway.providers.size} providers loaded`);
        console.log(``);
        resolve();
      });
    });
  }

  async stop() {
    if (this.scheduler) this.scheduler.stop();
    if (this.wss) this.wss.close();
    if (this.server) this.server.close();
  }

  // Set orchestrator after initialization
  setOrchestrator(orchestrator) {
    this.orchestrator = orchestrator;
    this.scheduler = new TaskScheduler(orchestrator);
    this.scheduler.start();
  }

  // ─── Public Routes ──────────────────────────────────────────────────────

  _setupPublicRoutes() {
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        version: '4.0.0',
        providers: this.gateway.providers.size,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    });

    this.app.get('/api/status', (req, res) => {
      res.json({
        status: 'online',
        version: '4.0.0',
        gateway: this.gateway.getStatus(),
        scheduler: this.scheduler?.getStatus() || { running: false },
        activeTasks: this.activeTasks.size
      });
    });
  }

  // ─── Auth Routes ────────────────────────────────────────────────────────

  _setupAuthRoutes() {
    this.app.post('/api/auth/login', (req, res) => {
      const { apiKey, username, password } = req.body;

      if (apiKey) {
        const result = this.auth.login(apiKey);
        return res.json(result);
      }

      if (username && password) {
        const result = this.auth.loginPassword(username, password);
        return res.json(result);
      }

      res.status(400).json({ error: 'Provide apiKey or username+password' });
    });

    this.app.post('/api/auth/logout', (req, res) => {
      const token = req.headers.authorization?.replace('Bearer ', '');
      this.auth.logout(token);
      res.json({ ok: true });
    });

    this.app.get('/api/auth/me', (req, res) => {
      if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
      res.json({ user: this.auth.users.getUser(req.user.userId) });
    });

    this.app.post('/api/auth/users', this.auth.requirePermission('users:manage'), (req, res) => {
      const { username, role } = req.body;
      const user = this.auth.createUser({ username, role });
      res.json({ ok: true, user });
    });
  }

  // ─── Task Routes ────────────────────────────────────────────────────────

  _setupTaskRoutes() {
    // Create and run a task
    this.app.post('/api/tasks', this.auth.requirePermission('tasks:create'), async (req, res) => {
      const { task, options = {} } = req.body;
      if (!task) return res.status(400).json({ error: 'Task description required' });

      // Safety check
      const safetyResult = this.safety.checkAction({ type: 'task', params: { task } });
      if (safetyResult.blocked) {
        return res.status(403).json({ error: 'Task blocked by safety system', reason: safetyResult.reason });
      }

      if (!this.orchestrator) {
        return res.status(503).json({ error: 'Orchestrator not initialized' });
      }

      const taskId = uuid();
      this.activeTasks.set(taskId, { task, status: 'running', startedAt: new Date().toISOString() });

      // Run task asynchronously
      this.orchestrator.runTask(task, { ...options, taskId })
        .then(result => {
          this.activeTasks.set(taskId, { ...this.activeTasks.get(taskId), status: 'completed', result });
        })
        .catch(error => {
          this.activeTasks.set(taskId, { ...this.activeTasks.get(taskId), status: 'failed', error: error.message });
        });

      res.json({ ok: true, taskId, message: 'Task started', monitor: `/api/tasks/${taskId}` });
    });

    // List active tasks
    this.app.get('/api/tasks', (req, res) => {
      const tasks = Array.from(this.activeTasks.entries()).map(([id, t]) => ({
        id, task: t.task, status: t.status, startedAt: t.startedAt
      }));
      res.json({ ok: true, tasks, count: tasks.length });
    });

    // Get task details
    this.app.get('/api/tasks/:id', (req, res) => {
      const task = this.activeTasks.get(req.params.id);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      res.json({ ok: true, ...task });
    });

    // Cancel task
    this.app.delete('/api/tasks/:id', this.auth.requirePermission('tasks:delete'), (req, res) => {
      const task = this.activeTasks.get(req.params.id);
      if (!task) return res.status(404).json({ error: 'Task not found' });
      this.activeTasks.set(req.params.id, { ...task, status: 'cancelled' });
      res.json({ ok: true, message: 'Task cancelled' });
    });
  }

  // ─── Browser Routes ─────────────────────────────────────────────────────

  _setupBrowserRoutes() {
    this.app.post('/api/browser/connect', this.auth.requirePermission('browser:control'), async (req, res) => {
      if (!this.orchestrator?.browser) return res.status(503).json({ error: 'Browser not available' });
      try {
        await this.orchestrator.browser.connect(req.body);
        res.json({ ok: true, message: 'Browser connected' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/browser/goto', this.auth.requirePermission('browser:control'), async (req, res) => {
      const { url } = req.body;

      // Safety: check URL category
      const urlCheck = this.safety.checkURL(url);
      if (urlCheck.watchMode || !urlCheck.autoConfirm) {
        // In watch mode, notify via WebSocket
        this._broadcast({ type: 'watch_mode', url, category: urlCheck });
      }

      if (!this.orchestrator?.browser) return res.status(503).json({ error: 'Browser not available' });
      try {
        await this.orchestrator.browser.goto(url);
        res.json({ ok: true, url, category: urlCheck.category, level: urlCheck.level });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/browser/click', this.auth.requirePermission('browser:control'), async (req, res) => {
      if (!this.orchestrator?.browser) return res.status(503).json({ error: 'Browser not available' });
      try {
        const result = await this.orchestrator.browser.click(req.body.selector, req.body);
        res.json({ ok: true, result });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/browser/type', this.auth.requirePermission('browser:control'), async (req, res) => {
      if (!this.orchestrator?.browser) return res.status(503).json({ error: 'Browser not available' });
      try {
        const result = await this.orchestrator.browser.type(req.body.selector, req.body.text, req.body);
        res.json({ ok: true, result });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    this.app.post('/api/browser/screenshot', this.auth.requirePermission('browser:control'), async (req, res) => {
      if (!this.orchestrator?.browser) return res.status(503).json({ error: 'Browser not available' });
      try {
        const screenshot = await this.orchestrator.browser.screenshot(req.body);
        res.json({ ok: true, screenshot: screenshot?.toString('base64')?.slice(0, 100) + '...' });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  // ─── Terminal Routes ────────────────────────────────────────────────────

  _setupTerminalRoutes() {
    this.app.post('/api/terminal/exec', this.auth.requirePermission('terminal:exec'), async (req, res) => {
      const { command } = req.body;
      if (!command) return res.status(400).json({ error: 'Command required' });

      // Safety check
      const safetyResult = this.safety.checkAction({ type: 'terminal_exec', params: { command } });
      if (safetyResult.blocked) {
        return res.status(403).json({ error: 'Command blocked', reason: safetyResult.reason });
      }
      if (safetyResult.requiresConfirmation) {
        const confirmed = await this.safety.requestConfirmation({ type: 'terminal_exec', params: { command } }, safetyResult.reason);
        if (!confirmed) {
          return res.status(403).json({ error: 'Command not confirmed', reason: safetyResult.reason });
        }
      }

      if (!this.orchestrator?.terminal) return res.status(503).json({ error: 'Terminal not available' });
      try {
        const result = await this.orchestrator.terminal.exec(command, req.body);
        res.json({ ok: true, result });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  // ─── Research Routes ────────────────────────────────────────────────────

  _setupResearchRoutes() {
    this.app.post('/api/research', this.auth.requirePermission('research:execute'), async (req, res) => {
      const { query, options = {} } = req.body;
      if (!query) return res.status(400).json({ error: 'Research query required' });

      const researchId = uuid();

      // Run research asynchronously
      this.research.research(query, options)
        .then(result => {
          this._broadcast({ type: 'research:complete', researchId, result });
        })
        .catch(error => {
          this._broadcast({ type: 'research:error', researchId, error: error.message });
        });

      res.json({ ok: true, researchId, message: 'Research started' });
    });
  }

  // ─── Scheduler Routes ───────────────────────────────────────────────────

  _setupSchedulerRoutes() {
    this.app.post('/api/scheduler', this.auth.requirePermission('scheduler:manage'), (req, res) => {
      if (!this.scheduler) return res.status(503).json({ error: 'Scheduler not available' });
      const job = this.scheduler.schedule(req.body);
      res.json({ ok: true, job });
    });

    this.app.get('/api/scheduler', (req, res) => {
      if (!this.scheduler) return res.status(503).json({ error: 'Scheduler not available' });
      res.json({ ok: true, ...this.scheduler.getStatus(), jobs: this.scheduler.listJobs() });
    });

    this.app.delete('/api/scheduler/:id', this.auth.requirePermission('scheduler:manage'), (req, res) => {
      if (!this.scheduler) return res.status(503).json({ error: 'Scheduler not available' });
      const removed = this.scheduler.unschedule(req.params.id);
      res.json({ ok: removed });
    });

    this.app.post('/api/scheduler/:id/toggle', this.auth.requirePermission('scheduler:manage'), (req, res) => {
      if (!this.scheduler) return res.status(503).json({ error: 'Scheduler not available' });
      const job = this.scheduler.toggle(req.params.id, req.body.enabled);
      res.json({ ok: true, job });
    });
  }

  // ─── Gateway Routes ─────────────────────────────────────────────────────

  _setupGatewayRoutes() {
    this.app.get('/api/gateway/status', (req, res) => {
      res.json({ ok: true, ...this.gateway.getStatus() });
    });

    this.app.get('/api/gateway/models', (req, res) => {
      res.json({ ok: true, models: this.gateway.listModels() });
    });

    this.app.post('/api/gateway/chat', async (req, res) => {
      const { model, messages, options, stream } = req.body;
      if (!model || !messages) return res.status(400).json({ error: 'model and messages required' });

      try {
        if (stream) {
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');

          for await (const chunk of this.gateway.chatStream({ model, messages, options })) {
            res.write(`data: ${JSON.stringify(chunk)}\n\n`);
          }
          res.write('data: [DONE]\n\n');
          res.end();
        } else {
          const result = await this.gateway.chat({ model, messages, options });
          res.json({ ok: true, ...result });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }

  // ─── Safety Routes ──────────────────────────────────────────────────────

  _setupSafetyRoutes() {
    this.app.get('/api/safety/log', (req, res) => {
      res.json({ ok: true, log: this.safety.getAuditLog(parseInt(req.query.limit) || 100) });
    });

    this.app.post('/api/safety/confirm/:id', (req, res) => {
      const confirmed = this.safety.confirmAction(req.params.id, req.body.approved);
      res.json({ ok: confirmed });
    });

    this.app.get('/api/safety/check-url', (req, res) => {
      const { url } = req.query;
      if (!url) return res.status(400).json({ error: 'url query param required' });
      res.json({ ok: true, ...this.safety.checkURL(url) });
    });
  }

  // ─── System Routes ──────────────────────────────────────────────────────

  _setupSystemRoutes() {
    this.app.get('/api/system/info', (req, res) => {
      const mem = process.memoryUsage();
      res.json({
        ok: true,
        version: '4.1.0',
        uptime: process.uptime(),
        memory: {
          rss: `${(mem.rss / 1024 / 1024).toFixed(1)} MB`,
          heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`,
          heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(1)} MB`
        },
        node: process.version,
        platform: process.platform,
        providers: this.gateway.providers.size,
        activeTasks: this.activeTasks.size,
        autoRestart: this.autoRestart?.getStatus() || null,
        tokenManager: this.gateway.tokenManager?.getStatus() || null
      });
    });
  }

  // ─── Token Management Routes ───────────────────────────────────────────

  _setupTokenRoutes() {
    // Get token status for all providers
    this.app.get('/api/tokens', (req, res) => {
      const active = this.db.getActiveTokens();
      const stats = this.db.getTokenStats();
      res.json({ ok: true, tokens: active, stats });
    });

    // Add a new token manually
    this.app.post('/api/tokens', this.auth.requirePermission('config:manage'), (req, res) => {
      const { provider, api_key, label, is_primary } = req.body;
      if (!provider || !api_key) return res.status(400).json({ error: 'provider and api_key required' });

      this.db.addToken(provider, api_key, label || '', is_primary || false);
      this._log(`New token added for ${provider}`);
      res.json({ ok: true, message: `Token added for ${provider}` });
    });

    // Delete a token
    this.app.delete('/api/tokens/:id', this.auth.requirePermission('config:manage'), (req, res) => {
      this.db.run(`UPDATE tokens SET is_active = 0, status = 'deleted' WHERE id = ?`, [req.params.id]);
      res.json({ ok: true });
    });

    // Reactivate a token
    this.app.post('/api/tokens/:id/reactivate', this.auth.requirePermission('config:manage'), (req, res) => {
      this.db.reactivateToken(parseInt(req.params.id));
      res.json({ ok: true });
    });

    // Get usage history from DB
    this.app.get('/api/usage', (req, res) => {
      const days = parseInt(req.query.days) || 7;
      const summary = this.db.getUsageSummary(days);
      const daily = this.db.getDailyUsage(days);
      res.json({ ok: true, summary, daily });
    });

    // Get auto-restart status
    this.app.get('/api/auto-restart', (req, res) => {
      res.json({ ok: true, ...this.autoRestart?.getStatus() });
    });

    // Manual trigger: force renewal attempt
    this.app.post('/api/tokens/renew/:provider', this.auth.requirePermission('config:manage'), async (req, res) => {
      const { provider } = req.params;
      const renewed = await this.gateway.tokenManager?._attemptAutoRenewal(provider);
      res.json({ ok: renewed, provider, message: renewed ? 'Tokens renewed' : 'Renewal failed' });
    });
  }

  // ─── WebSocket ──────────────────────────────────────────────────────────

  _setupWebSocket() {
    this.wss.on('connection', (ws) => {
      ws.send(JSON.stringify({ type: 'connected', version: '4.0.0' }));

      // Forward safety events
      this.safety.on('safety:confirmation', (data) => {
        ws.send(JSON.stringify({ type: 'confirmation_required', ...data }));
      });

      // Forward research events
      this.research.on('research:phase', (data) => {
        ws.send(JSON.stringify({ type: 'research_progress', ...data }));
      });

      ws.on('message', async (raw) => {
        try {
          const msg = JSON.parse(raw.toString());

          switch (msg.type) {
            case 'chat':
              const result = await this.gateway.chat(msg.params);
              ws.send(JSON.stringify({ type: 'chat_response', id: msg.id, ...result }));
              break;

            case 'task':
              if (this.orchestrator) {
                const taskResult = await this.orchestrator.runTask(msg.task, msg.options);
                ws.send(JSON.stringify({ type: 'task_result', id: msg.id, ...taskResult }));
              }
              break;

            case 'confirm':
              this.safety.confirmAction(msg.confirmationId, msg.approved);
              break;

            default:
              ws.send(JSON.stringify({ type: 'error', error: `Unknown message type: ${msg.type}` }));
          }
        } catch (error) {
          ws.send(JSON.stringify({ type: 'error', error: error.message }));
        }
      });
    });
  }

  _broadcast(data) {
    if (!this.wss) return;
    const msg = JSON.stringify(data);
    for (const ws of this.wss.clients) {
      if (ws.readyState === 1) ws.send(msg);
    }
  }
}

export function createServer(config) {
  return new OperatorServer(config);
}

export default OperatorServer;

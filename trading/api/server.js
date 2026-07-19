import express from 'express';
import cors from 'cors';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PYTHON = 'python';

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
let botState = { isRunning: false, mode: 'paper', startedAt: null };
let activeTrades = [];
let metrics = { totalTrades: 0, winTrades: 0, lossTrades: 0 };

function callPython(script, args = []) {
  return new Promise((resolve, reject) => {
    const proc = spawn(PYTHON, [script, ...args], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });
    let stdout = '', stderr = '';
    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => stderr += d.toString());
    proc.on('close', code => {
      if (code === 0) resolve(stdout);
      else reject(new Error(stderr || `Exit code ${code}`));
    });
    proc.on('error', reject);
  });
}

app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    bot: botState,
    trades: activeTrades.length,
    metrics,
    uptime: process.uptime(),
  });
});

app.get('/api/health/diagnostic', async (req, res) => {
  try {
    const regimeScript = path.join(ROOT, 'scripts', 'diagnostic.py');
    const output = await callPython(regimeScript);
    const data = JSON.parse(output);
    res.json({ status: 'ACTIVE', ...data, bot: botState });
  } catch (e) {
    res.json({ status: 'DEGRADED', error: e.message, bot: botState });
  }
});

app.get('/api/bot/status', (req, res) => {
  res.json(botState);
});

app.post('/api/bot/start', (req, res) => {
  if (botState.isRunning) {
    return res.json({ ok: false, error: 'Bot already running' });
  }
  botState.isRunning = true;
  botState.startedAt = new Date().toISOString();
  botState.mode = req.body?.mode || 'paper';
  res.json({ ok: true, ...botState });
});

app.post('/api/bot/stop', (req, res) => {
  botState.isRunning = false;
  res.json({ ok: true, ...botState });
});

app.get('/api/signals', async (req, res) => {
  try {
    const symbol = req.query.symbol || 'EURUSD';
    const signalScript = path.join(ROOT, 'scripts', 'generate_signal.py');
    const output = await callPython(signalScript, [symbol]);
    const data = JSON.parse(output);

    // Flatten signal to root for EA compatibility (MT5 string-parser)
    if (data.ok && data.signal) {
      data.type = data.signal.type;
      data.entry = data.signal.entry;
      data.sl = data.signal.sl;
      data.tp = data.signal.tp;
      data.confidence = data.signal.confidence;
      data.setup_type = data.signal.setup_type;
    }

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/signals/analyze', async (req, res) => {
  try {
    const { candles, symbol } = req.body;
    if (!candles || !candles.length) {
      return res.status(400).json({ error: 'Candles required' });
    }
    const signalScript = path.join(ROOT, 'scripts', 'generate_signal.py');
    const output = await callPython(signalScript, [symbol || 'EURUSD', JSON.stringify(candles)]);
    const data = JSON.parse(output);

    if (data.ok && data.signal) {
      data.type = data.signal.type;
      data.entry = data.signal.entry;
      data.sl = data.signal.sl;
      data.tp = data.signal.tp;
      data.confidence = data.signal.confidence;
      data.setup_type = data.signal.setup_type;
    }

    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/trades/open', (req, res) => {
  const trade = {
    id: `trade_${Date.now()}`,
    ...req.body,
    openedAt: new Date().toISOString(),
  };
  activeTrades.push(trade);
  metrics.totalTrades++;
  res.json({ ok: true, trade });
});

app.post('/api/trades/close', (req, res) => {
  const { id, pnl } = req.body;
  activeTrades = activeTrades.filter(t => t.id !== id);
  if (pnl > 0) metrics.winTrades++;
  else metrics.lossTrades++;
  res.json({ ok: true });
});

app.get('/api/trades', (req, res) => {
  res.json(activeTrades);
});

const publicDir = path.join(__dirname, 'public');
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  console.log('[TRADING-API] Sirviendo estaticos desde:', publicDir);
}

app.get('/api/backtest/run', async (req, res) => {
  try {
    const symbol = req.query.symbol || 'EURUSD';
    const btScript = path.join(ROOT, 'scripts', 'run_backtest.py');
    const output = await callPython(btScript, [symbol, '{}']);
    const data = JSON.parse(output);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/optimization/run', async (req, res) => {
  try {
    const symbol = req.query.symbol || 'EURUSD';
    const generations = parseInt(req.query.generations) || 8;
    const optScript = path.join(ROOT, 'scripts', 'run_optimization_api.py');
    const output = await callPython(optScript, [symbol, String(generations)]);
    const data = JSON.parse(output);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/metrics', (req, res) => {
  res.json(metrics);
});

const bridgeModule = await import('./bridge/mt4-bridge.js');
const bridgeRoutes = bridgeModule.default;
const bridgeState = bridgeModule.state;
app.use('/api/bridge', bridgeRoutes);

// Endpoint que usa velas en vivo del bridge si existen
app.get('/api/signals/live', async (req, res) => {
  try {
    const symbol = req.query.symbol || 'EURUSD';
    const liveCandles = bridgeState?.candles?.[symbol];

    if (liveCandles && liveCandles.length >= 100) {
      const signalScript = path.join(ROOT, 'scripts', 'generate_signal.py');
      const output = await callPython(signalScript, [symbol, JSON.stringify(liveCandles)]);
      const data = JSON.parse(output);

      if (data.ok && data.signal) {
        data.type = data.signal.type;
        data.entry = data.signal.entry;
        data.sl = data.signal.sl;
        data.tp = data.signal.tp;
        data.confidence = data.signal.confidence;
        data.setup_type = data.signal.setup_type;
      }
      return res.json(data);
    }

    // Fallback: usar datos de archivo CSV
    const fallback = await callPython(
      path.join(ROOT, 'scripts', 'generate_signal.py'), [symbol]
    );
    const data = JSON.parse(fallback);
    if (data.ok && data.signal) {
      data.type = data.signal.type;
      data.entry = data.signal.entry;
      data.sl = data.signal.sl;
      data.tp = data.signal.tp;
      data.confidence = data.signal.confidence;
      data.setup_type = data.signal.setup_type;
    }
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Broadcast de señal a todos los WS clients
function broadcastSignal(signal) {
  const msg = JSON.stringify({ type: 'signal', ...signal });
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({
    type: 'connected',
    status: botState,
    bridge: bridgeState ? {
      connected: bridgeState.connected,
      account: bridgeState.account,
    } : null,
  }));
  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
      if (msg.type === 'get_signals') {
        const signalScript = path.join(ROOT, 'scripts', 'generate_signal.py');
        const output = await callPython(signalScript, [msg.symbol || 'EURUSD']);
        const data = JSON.parse(output);
        ws.send(JSON.stringify({ type: 'signals_result', data }));
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: 'error', message: e.message }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`[TRADING-API] Server running on http://localhost:${PORT}`);
  console.log(`[TRADING-API] WebSocket on ws://localhost:${PORT}`);
  console.log(`[TRADING-API] Bot mode: ${botState.mode}`);
});

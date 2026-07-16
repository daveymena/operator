import { WebSocketServer, WebSocket } from 'ws';
import { spawn, execSync } from 'child_process';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const envPath = path.join(ROOT, 'config', '.env');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });

const ROOT_PARENT = path.resolve(ROOT, '..');
const HERMES_CORE = fs.existsSync(path.join(ROOT, 'hermes-core')) ? path.join(ROOT, 'hermes-core') : path.join(ROOT_PARENT, 'hermes-core');
const OPENCODE_CORE = fs.existsSync(path.join(ROOT, 'opencode-core')) ? path.join(ROOT, 'opencode-core') : path.join(ROOT_PARENT, 'opencode-core');

const BRIDGE_PORT = parseInt(process.env.BRIDGE_PORT || '20100');
const HTTP_PORT = parseInt(process.env.HTTP_PORT || '3000');
const HERMES_WS_PORT = parseInt(process.env.HERMES_WS_PORT || '20101');
const OPENCODE_WS_PORT = parseInt(process.env.OPENCODE_WS_PORT || '20102');

const httpServer = http.createServer(handleHTTP);
const wss = new WebSocketServer({ noServer: true });

let hermesProcess = null;
let opencodeServer = null;
let opencodeAgent = null;
let wsClients = [];

function log(...args) {
  console.log(`[BRIDGE] ${new Date().toISOString()}`, ...args);
}

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const ws of wsClients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(data);
  }
}

async function handleHTTP(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${HTTP_PORT}`);
  try {
    if (url.pathname === '/' || url.pathname === '/health') {
      res.writeHead(200); res.end(JSON.stringify({
        status: 'online',
        bridge: `ws://localhost:${BRIDGE_PORT}`,
        clients: wsClients.length,
        hermes: hermesProcess !== null,
        opencode: opencodeServer !== null,
        uptime: process.uptime()
      }));
    } else if (url.pathname === '/api/status') {
      const ctx = JSON.parse(fs.readFileSync(path.join(ROOT, 'context.json'), 'utf8'));
      res.writeHead(200); res.end(JSON.stringify({ ...ctx, bridge: { port: BRIDGE_PORT, clients: wsClients.length } }));
    } else {
      res.writeHead(404); res.end(JSON.stringify({ error: 'ruta no encontrada', rutas: ['/', '/health', '/api/status'] }));
    }
  } catch (e) {
    res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
  }
}

function startHermes() {
  log('Iniciando Hermes Agent...');
  const python = path.join(HERMES_CORE, '.venv', 'Scripts', 'python.exe');
  const pythonAlt = path.join(HERMES_CORE, 'venv', 'Scripts', 'python.exe');
  const pythonBin = fs.existsSync(python) ? python : fs.existsSync(pythonAlt) ? pythonAlt : 'python';
  const cliPy = path.join(HERMES_CORE, 'cli.py');

  hermesProcess = spawn(pythonBin, [cliPy, '--bridge-port', String(HERMES_WS_PORT)], {
    cwd: HERMES_CORE,
    stdio: ['inherit', 'pipe', 'pipe'],
    env: {
      ...process.env,
      HERMES_BRIDGE_PORT: String(HERMES_WS_PORT),
      OPENCODE_CONTROL: '1',
    }
  });

  hermesProcess.stdout.on('data', (d) => {
    process.stdout.write(`[HERMES] ${d}`);
    broadcast({ from: 'hermes', data: d.toString() });
  });
  hermesProcess.stderr.on('data', (d) => {
    process.stderr.write(`[HERMES:err] ${d}`);
  });
  hermesProcess.on('error', (e) => {
    log(`Hermes no disponible: ${e.message}`);
    hermesProcess = null;
    broadcast({ type: 'status', system: 'hermes', status: 'error', error: e.message });
  });
  hermesProcess.on('exit', (code) => {
    log(`Hermes terminado (código: ${code})`);
    hermesProcess = null;
    broadcast({ type: 'status', system: 'hermes', status: 'stopped' });
  });
  broadcast({ type: 'status', system: 'hermes', status: 'started' });
}

function startOpenCode() {
  log('Iniciando OpenCode...');
  const serveJs = path.join(OPENCODE_CORE, 'serve.js');

  opencodeServer = spawn('node', [serveJs], {
    cwd: OPENCODE_CORE,
    stdio: ['inherit', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PORT: '3000',
      AGENT_WS_PORT: String(OPENCODE_WS_PORT),
      HERMES_BRIDGE_URL: `ws://localhost:${HERMES_WS_PORT}`,
    }
  });

  opencodeServer.stdout.on('data', (d) => {
    process.stdout.write(`[OPENCODE] ${d}`);
    broadcast({ from: 'opencode', data: d.toString() });
  });
  opencodeServer.stderr.on('data', (d) => {
    process.stderr.write(`[OPENCODE:err] ${d}`);
  });
  opencodeServer.on('error', (e) => {
    log(`OpenCode no disponible: ${e.message}`);
    opencodeServer = null;
    broadcast({ type: 'status', system: 'opencode', status: 'error', error: e.message });
  });
  opencodeServer.on('exit', (code) => {
    log(`OpenCode terminado (código: ${code})`);
    opencodeServer = null;
    broadcast({ type: 'status', system: 'opencode', status: 'stopped' });
  });
  broadcast({ type: 'status', system: 'opencode', status: 'started' });
}

function startPCAgent() {
  log('Iniciando PC Agent (OpenCode)...');
  const agentMjs = path.join(OPENCODE_CORE, 'pc-agent.mjs');
  if (!fs.existsSync(agentMjs)) {
    log('pc-agent.mjs no encontrado, saltando');
    return;
  }
  opencodeAgent = spawn('node', [agentMjs], {
    cwd: OPENCODE_CORE,
    stdio: ['inherit', 'pipe', 'pipe'],
    env: {
      ...process.env,
      AGENT_SERVER_URL: `ws://localhost:${OPENCODE_WS_PORT}/agent`,
    }
  });
  opencodeAgent.stdout.on('data', (d) => {
    process.stdout.write(`[PC-AGENT] ${d}`);
  });
  opencodeAgent.stderr.on('data', (d) => {
    process.stderr.write(`[PC-AGENT:err] ${d}`);
  });
  opencodeAgent.on('error', (e) => {
    log(`PC Agent error: ${e.message}`);
    opencodeAgent = null;
  });
  opencodeAgent.on('exit', (code) => {
    log(`PC Agent terminado (código: ${code})`);
    opencodeAgent = null;
  });
}

function handleWS(ws, req) {
  wsClients.push(ws);
  const clientAddr = req.socket.remoteAddress;
  log(`Cliente conectado desde ${clientAddr}`);

  ws.send(JSON.stringify({
    type: 'bridge_status',
    port: BRIDGE_PORT,
    hermes: hermesProcess !== null,
    opencode: opencodeServer !== null,
    pc_agent: opencodeAgent !== null,
  }));

  ws.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      switch (msg.type) {
        case 'task': {
          const { runTask } = await import('../operator.mjs');
          const taskId = `task_${Date.now()}`;
          ws.send(JSON.stringify({ type: 'task_started', taskId, task: msg.task }));

          runTask(msg.task, {
            brain: msg.brain || 'auto',
            useBridge: false,
            onProgress: (progress) => {
              try { ws.send(JSON.stringify({ ...progress, taskId })); } catch {}
            }
          }).then((summary) => {
            ws.send(JSON.stringify({ type: 'task_complete', taskId, summary }));
          }).catch((err) => {
            ws.send(JSON.stringify({ type: 'task_error', taskId, error: err.message }));
          });
          break;
        }

        case 'exec': {
          try {
            const result = execSync(msg.cmd, { cwd: msg.cwd || ROOT, timeout: msg.timeout || 30000, encoding: 'utf8', maxBuffer: 1024 * 1024 });
            ws.send(JSON.stringify({ type: 'exec_result', id: msg.id, stdout: result }));
          } catch (e) {
            ws.send(JSON.stringify({ type: 'exec_result', id: msg.id, error: e.message, stdout: e.stdout }));
          }
          break;
        }

        case 'action':
        case 'execute': {
          const { execute } = await import('../operator/actions.mjs');
          const result = await execute(msg.action || msg);
          ws.send(JSON.stringify({ type: 'action_result', id: msg.id, ...result }));
          break;
        }

        case 'hermes_command': {
          if (hermesProcess) hermesProcess.stdin.write(msg.command + '\n');
          break;
        }

        case 'opencode_command': {
          if (opencodeServer) opencodeServer.stdin.write(msg.command + '\n');
          break;
        }

        case 'ping': {
          ws.send(JSON.stringify({ type: 'pong', time: Date.now() }));
          break;
        }

        default:
          ws.send(JSON.stringify({ type: 'error', message: `tipo desconocido: ${msg.type}` }));
      }
    } catch (e) {
      log('Error en mensaje:', e.message);
    }
  });

  ws.on('close', () => {
    wsClients = wsClients.filter(w => w !== ws);
    log(`Cliente desconectado (${clientAddr})`);
  });

  ws.on('error', (e) => log(`Error de WebSocket: ${e.message}`));
}

httpServer.on('upgrade', (req, socket, head) => {
  wss.handleUpgrade(req, socket, head, (ws) => handleWS(ws, req));
});

wss.on('connection', (ws, req) => handleWS(ws, req));

const MAIN_PORT = process.env.PORT || process.env.BRIDGE_PORT || 20100;
httpServer.listen(MAIN_PORT, () => {
  log(`╔════════════════════════════════════════════════╗`);
  log(`║   🚀 BRIDGE - SISTEMA AUTÓNOMO UNIVERSAL      ║`);
  log(`╚════════════════════════════════════════════════╝`);
  log(`  🌐 HTTP:       http://localhost:${MAIN_PORT}`);
  log(`  🔌 WebSocket:  ws://localhost:${MAIN_PORT}`);
  log(`  🧠 Hermes:     puerto ${HERMES_WS_PORT}`);
  log(`  🤖 OpenCode:   puerto ${OPENCODE_WS_PORT}`);
  log(`  📡 Clientes:   ${wsClients.length}`);
  log(`  📁 Proyecto:   ${ROOT}\n`);
  startHermes();
  startOpenCode();
  setTimeout(startPCAgent, 3000);
});

process.on('SIGINT', () => {
  log('Apagando sistemas...');
  if (hermesProcess) hermesProcess.kill();
  if (opencodeServer) opencodeServer.kill();
  if (opencodeAgent) opencodeAgent.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('SIGTERM recibido, apagando...');
  if (hermesProcess) hermesProcess.kill();
  if (opencodeServer) opencodeServer.kill();
  if (opencodeAgent) opencodeAgent.kill();
  process.exit(0);
});

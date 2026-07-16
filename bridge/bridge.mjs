import { WebSocketServer, WebSocket } from 'ws';
import { spawn, execSync } from 'child_process';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ROOT_PARENT = path.resolve(ROOT, '..');
const HERMES_CORE = fs.existsSync(path.join(ROOT, 'hermes-core')) ? path.join(ROOT, 'hermes-core') : path.join(ROOT_PARENT, 'hermes-core');
const OPENCODE_CORE = fs.existsSync(path.join(ROOT, 'opencode-core')) ? path.join(ROOT, 'opencode-core') : path.join(ROOT_PARENT, 'opencode-core');

const BRIDGE_PORT = parseInt(process.env.BRIDGE_PORT || '20100');
const HERMES_WS_PORT = parseInt(process.env.HERMES_WS_PORT || '20101');
const OPENCODE_WS_PORT = parseInt(process.env.OPENCODE_WS_PORT || '20102');

const server = http.createServer();
const wss = new WebSocketServer({ server });

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
  opencodeAgent.on('exit', (code) => {
    log(`PC Agent terminado (código: ${code})`);
    opencodeAgent = null;
  });
}

wss.on('connection', (ws, req) => {
  wsClients.push(ws);
  log(`Cliente conectado desde ${req.socket.remoteAddress}`);

  ws.send(JSON.stringify({
    type: 'bridge_status',
    hermes: hermesProcess !== null,
    opencode: opencodeServer !== null,
    pc_agent: opencodeAgent !== null,
  }));

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'hermes_command') {
        if (hermesProcess) {
          hermesProcess.stdin.write(msg.command + '\n');
        }
      } else if (msg.type === 'opencode_command') {
        if (opencodeServer) {
          opencodeServer.stdin.write(msg.command + '\n');
        }
      } else if (msg.type === 'exec') {
        try {
          const result = execSync(msg.cmd, { cwd: ROOT, timeout: msg.timeout || 30000, encoding: 'utf8' });
          ws.send(JSON.stringify({ type: 'exec_result', id: msg.id, stdout: result }));
        } catch (e) {
          ws.send(JSON.stringify({ type: 'exec_result', id: msg.id, error: e.message, stdout: e.stdout }));
        }
      }
    } catch (e) {
      log('Error en mensaje:', e.message);
    }
  });

  ws.on('close', () => {
    wsClients = wsClients.filter(w => w !== ws);
  });
});

server.listen(BRIDGE_PORT, () => {
  log(`Bridge corriendo en puerto ${BRIDGE_PORT}`);
  log(`Hermes WS: ${HERMES_WS_PORT}, OpenCode WS: ${OPENCODE_WS_PORT}`);
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

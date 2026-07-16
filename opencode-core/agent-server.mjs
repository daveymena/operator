import { WebSocketServer } from 'ws';
import http from 'http';
import { randomUUID } from 'crypto';

const agents = new Map();
const controllers = new Map();
const WS_PORT = parseInt(process.env.AGENT_WS_PORT || '21291');
const AUTH_TOKEN = process.env.AGENT_SERVER_TOKEN || '';
const wss = new WebSocketServer({ noServer: true });

function unauthorized(res) {
  res.writeHead(401, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Unauthorized' }));
}

wss.on('connection', (ws, req) => {
  const agentName = req.headers['x-agent-name'] || 'PC-Desconocido';
  let agentId = req.headers['x-agent-id'] || randomUUID();
  let isController = false;

  const pingInterval = setInterval(() => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'ping' }));
    else clearInterval(pingInterval);
  }, 30000);

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'register') {
        if (msg.agentId) agentId = msg.agentId;
        isController = (msg.sysinfo?.role === 'controller');
        const registry = isController ? controllers : agents;
        registry.set(agentId, { ws, name: msg.agentName || agentName, sysinfo: msg.sysinfo || {}, connectedAt: new Date() });
        ws.send(JSON.stringify({ type: 'registered', agentId, role: isController ? 'controller' : 'agent' }));
        console.log(`[agent-server] ✓ ${isController ? 'Controller' : 'Agente'} registrado: ${agentId} (${msg.agentName || agentName})`);
      }
      if (msg.type === 'result') {
        const pending = pendingRequests.get(msg.requestId);
        if (pending) { pending.resolve(msg.result); pendingRequests.delete(msg.requestId); }
      }
    } catch (err) { console.error('[agent-server] Error:', err.message); }
  });

  ws.on('close', () => {
    clearInterval(pingInterval);
    if (isController) {
      controllers.delete(agentId);
      console.log(`[agent-server] ✗ Controller desconectado: ${agentId}`);
    } else {
      agents.delete(agentId);
      console.log(`[agent-server] ✗ Agente desconectado: ${agentId}`);
    }
  });
});

const pendingRequests = new Map();

async function sendCommandToAgent(agentId, cmd, timeoutMs = 30000) {
  const agent = agents.get(agentId);
  if (!agent) throw new Error(`Agente no encontrado: ${agentId}`);
  const requestId = randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pendingRequests.delete(requestId); reject(new Error('Timeout')); }, timeoutMs);
    pendingRequests.set(requestId, { resolve: (result) => { clearTimeout(timer); resolve(result); }, reject });
    agent.ws.send(JSON.stringify({ type: 'command', requestId, cmd }));
  });
}

function listAgents() {
  return [...agents.entries()].map(([id, a]) => ({ id, name: a.name, sysinfo: a.sysinfo, connectedAt: a.connectedAt }));
}

const apiServer = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${WS_PORT}`);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
  try {
    if (url.pathname === '/agents' && req.method === 'GET') {
      const list = listAgents();
      res.writeHead(200); res.end(JSON.stringify(list)); return;
    }
    if (url.pathname.startsWith('/agents/') && req.method === 'POST') {
      const agentId = url.pathname.split('/')[2];
      let body = ''; req.on('data', d => body += d); await new Promise(r => req.on('end', r));
      const cmd = JSON.parse(body);
      const result = await sendCommandToAgent(agentId, cmd);
      res.writeHead(200); res.end(JSON.stringify(result)); return;
    }
    if (url.pathname === '/broadcast/open_url' && req.method === 'POST') {
      let body = ''; req.on('data', d => body += d); await new Promise(r => req.on('end', r));
      const { url: targetUrl } = JSON.parse(body);
      const results = await Promise.allSettled([...agents.keys()].map(id => sendCommandToAgent(id, { type: 'open_url', url: targetUrl }, 10000)));
      res.writeHead(200); res.end(JSON.stringify({ agents: agents.size, results: results.map(r => r.status) })); return;
    }
    if (url.pathname === '/health') { res.writeHead(200); res.end(JSON.stringify({ ok: true, agents: agents.size })); return; }
    res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' }));
  } catch (err) { res.writeHead(500); res.end(JSON.stringify({ error: err.message })); }
});

apiServer.on('upgrade', (req, socket, head) => {
  if (req.url !== '/agent') { socket.destroy(); return; }
  if (AUTH_TOKEN) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (token !== AUTH_TOKEN) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
  }
  wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
});

apiServer.listen(WS_PORT, '0.0.0.0', () => {
  console.log(`[agent-server] ✓ Servidor de agentes en puerto ${WS_PORT}`);
  console.log(`  GET  /agents         → agentes conectados`);
  console.log(`  POST /agents/:id     → enviar comando a PC`);
  console.log(`  WS   /agent          → conexión de agentes`);
});

export { sendCommandToAgent, agents };

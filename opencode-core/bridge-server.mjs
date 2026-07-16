import { WebSocketServer, WebSocket } from 'ws';
import http from 'http';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

const PORT = parseInt(process.env.BRIDGE_PORT || '21295');
const AGENT_SERVER = process.env.AGENT_SERVER_URL || 'ws://localhost:21291/agent';
const TASK_TIMEOUT = parseInt(process.env.TASK_TIMEOUT || '120000');
const INSTRUCTION_TIMEOUT = parseInt(process.env.INSTRUCTION_TIMEOUT || '20000');
const MAX_TASK_STEPS = parseInt(process.env.MAX_TASK_STEPS || '30');

let pcAgent = null;
let mimoConnection = null;
const pendingCommands = new Map();
const commandHistory = [];
const TASK_FILE = path.join(os.homedir(), '.opencode-agent', 'current-task.json');

const wss = new WebSocketServer({ noServer: true });

function sendToMimo(msg) {
  if (mimoConnection?.readyState === WebSocket.OPEN) {
    mimoConnection.send(JSON.stringify(msg));
  }
}

wss.on('connection', (ws) => {
  console.log('[bridge] MiMoCode conectado');
  mimoConnection = ws;

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'command') {
        const result = await executeOnPC(msg.cmd, msg.timeout);
        ws.send(JSON.stringify({ type: 'result', id: msg.id, result }));
      }

      if (msg.type === 'screenshot') {
        const quality = msg.quality || 60;
        const scale = msg.scale || 0.75;
        const result = await executeOnPC({ type: 'screenshot', quality, scale, force: msg.force });
        ws.send(JSON.stringify({ type: 'screenshot', id: msg.id, data: result }));
      }

      if (msg.type === 'screenshot_stable') {
        await executeOnPC({ type: 'wait', ms: msg.waitMs || 500 });
        const result = await executeOnPC({ type: 'screenshot', quality: msg.quality || 60, scale: msg.scale || 0.75, force: true });
        ws.send(JSON.stringify({ type: 'screenshot', id: msg.id, data: result }));
      }

      if (msg.type === 'sysinfo') {
        const result = await executeOnPC({ type: 'sysinfo' });
        ws.send(JSON.stringify({ type: 'sysinfo', id: msg.id, data: result }));
      }

      if (msg.type === 'list_windows') {
        const result = await executeOnPC({ type: 'list_windows' });
        ws.send(JSON.stringify({ type: 'list_windows', id: msg.id, data: result }));
      }

      if (msg.type === 'task') {
        ws.send(JSON.stringify({ type: 'task_ack', id: msg.id }));
        executeAutonomousTask(msg.task, ws, msg.context).catch(err => {
          console.error('[bridge] Task error:', err.message);
        });
      }

      if (msg.type === 'batch') {
        const results = [];
        for (const cmd of msg.commands || []) {
          try {
            const r = await executeOnPC(cmd, cmd.timeout);
            results.push(r);
          } catch (e) {
            results.push({ ok: false, error: e.message });
          }
        }
        ws.send(JSON.stringify({ type: 'batch_result', id: msg.id, results }));
      }

    } catch (err) {
      console.error('[bridge] Error:', err.message);
    }
  });

  ws.on('close', () => {
    console.log('[bridge] MiMoCode desconectado');
    mimoConnection = null;
  });

  ws.send(JSON.stringify({
    type: 'connected',
    agentConnected: !!pcAgent,
    agentId: pcAgent?.id || null,
    agentName: pcAgent?.name || null,
  }));
});

let agentWs = null;

function connectToAgent() {
  try {
    agentWs = new WebSocket(AGENT_SERVER, {
      headers: { 'x-agent-name': 'mimocode-bridge', 'x-agent-id': 'mimocode' }
    });

    agentWs.on('open', () => {
      console.log('[bridge] Conectado a Agent Server');
      agentWs.send(JSON.stringify({
        type: 'register',
        agentName: 'mimocode-bridge',
        agentId: 'mimocode',
        sysinfo: { hostname: os.hostname(), platform: os.platform() }
      }));
    });

    agentWs.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'registered') {
          pcAgent = { id: msg.agentId, connected: true };
          console.log(`[bridge] PC Agent: ${msg.agentId}`);
          sendToMimo({ type: 'agent_connected', agent: pcAgent });
        }

        if (msg.type === 'result' && msg.requestId) {
          const pending = pendingCommands.get(msg.requestId);
          if (pending) {
            pending.resolve(msg.result);
            pendingCommands.delete(msg.requestId);
          }
        }
      } catch {}
    });

    agentWs.on('close', () => {
      pcAgent = null;
      console.log('[bridge] PC Agent desconectado. Reconectando...');
      setTimeout(connectToAgent, 3000);
    });

    agentWs.on('error', () => {});

  } catch (err) {
    console.error('[bridge] No se pudo conectar:', err.message);
    setTimeout(connectToAgent, 5000);
  }
}

function executeOnPC(cmd, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    if (!agentWs || agentWs.readyState !== 1) {
      return reject(new Error('PC Agent no conectado'));
    }
    const requestId = randomUUID();
    const timer = setTimeout(() => {
      pendingCommands.delete(requestId);
      reject(new Error('Timeout'));
    }, timeoutMs);

    pendingCommands.set(requestId, {
      resolve: (result) => { clearTimeout(timer); resolve(result); },
      reject: () => { clearTimeout(timer); reject(new Error('Cancelled')); }
    });

    agentWs.send(JSON.stringify({ type: 'command', requestId, cmd }));
  });
}

async function executeAutonomousTask(task, ws, context = {}) {
  const steps = [];
  let stepCount = 0;
  const taskId = randomUUID().slice(0, 8);

  console.log(`[bridge][${taskId}] Tarea: ${task}`);

  // Gather environment context first
  let envContext = {};
  try {
    const [info, windows] = await Promise.all([
      executeOnPC({ type: 'sysinfo' }).catch(() => ({})),
      executeOnPC({ type: 'list_windows' }).catch(() => ({}))
    ]);
    envContext = { sysinfo: info, windows };
  } catch {}

  sendToMimo({ type: 'task_started', id: taskId, task, envContext, context });

  // Save task file
  fs.mkdirSync(path.dirname(TASK_FILE), { recursive: true });
  fs.writeFileSync(TASK_FILE, JSON.stringify({ task, taskId, startedAt: new Date().toISOString(), steps, envContext }));

  const startTime = Date.now();

  while (stepCount < MAX_TASK_STEPS) {
    const elapsed = Date.now() - startTime;
    if (elapsed > TASK_TIMEOUT) {
      steps.push({ step: stepCount, action: 'timeout', message: 'Tiempo límite excedido' });
      break;
    }

    stepCount++;

    // Take screenshot with appropriate quality (lower for longer tasks)
    const quality = stepCount > 10 ? 40 : 60;
    let screenshot;
    try {
      screenshot = await executeOnPC({ type: 'screenshot', quality, scale: 0.75, force: (stepCount === 1) });
    } catch (e) {
      steps.push({ step: stepCount, action: 'screenshot', error: e.message });
      break;
    }

    if (screenshot?.unchanged && stepCount > 1) {
      // Screen hasn't changed, wait a bit and retry
      await new Promise(r => setTimeout(r, 300));
      try {
        screenshot = await executeOnPC({ type: 'screenshot', quality, scale: 0.75, force: true });
      } catch {}
    }

    // Send to MiMoCode for analysis
    sendToMimo({
      type: 'task_step',
      step: stepCount,
      screenshot: screenshot?.base64,
      task,
      history: steps.slice(-5),
      envContext,
      context,
      elapsed
    });

    // Wait for instruction
    const instruction = await waitForInstruction(INSTRUCTION_TIMEOUT);
    if (!instruction) {
      steps.push({ step: stepCount, action: 'timeout', message: 'Sin instrucción' });
      break;
    }

    if (instruction.action === 'done') {
      steps.push({ step: stepCount, action: 'done', message: instruction.message || 'Completada' });
      break;
    }

    if (instruction.action === 'abort') {
      steps.push({ step: stepCount, action: 'aborted', reason: instruction.reason });
      break;
    }

    // Execute instruction
    if (instruction.cmd) {
      try {
        const result = await executeOnPC(instruction.cmd, instruction.timeout || 30000);
        steps.push({ step: stepCount, action: instruction.cmd.type, result, description: instruction.description });
        console.log(`[bridge][${taskId}] Step ${stepCount}: ${instruction.cmd.type} → ${result?.ok ? 'OK' : 'FAIL'}`);
        await new Promise(r => setTimeout(r, instruction.delay || 300));
      } catch (e) {
        steps.push({ step: stepCount, action: instruction.cmd.type, error: e.message, description: instruction.description });
        console.log(`[bridge][${taskId}] Step ${stepCount}: ${instruction.cmd.type} → ERROR ${e.message}`);
      }
    }

    // Update task file
    fs.writeFileSync(TASK_FILE, JSON.stringify({ task, taskId, startedAt: new Date().toISOString(), steps, envContext }));
  }

  fs.writeFileSync(TASK_FILE, JSON.stringify({ task, taskId, completedAt: new Date().toISOString(), steps, envContext }));

  sendToMimo({
    type: 'task_complete',
    id: taskId,
    task,
    steps,
    totalSteps: stepCount,
    elapsed: Date.now() - startTime
  });

  console.log(`[bridge][${taskId}] Completada: ${task} (${stepCount} pasos, ${Date.now() - startTime}ms)`);
}

let pendingInstruction = null;
let instructionResolve = null;

function waitForInstruction(timeoutMs) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pendingInstruction = null;
      instructionResolve = null;
      resolve(null);
    }, timeoutMs);

    pendingInstruction = { resolve: (inst) => { clearTimeout(timer); resolve(inst); } };
    instructionResolve = pendingInstruction.resolve;
  });
}

const apiServer = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (url.pathname === '/status') {
    res.writeHead(200);
    res.end(JSON.stringify({
      agentConnected: !!pcAgent,
      agent: pcAgent,
      hasTask: !!pendingInstruction,
      historyCount: commandHistory.length,
      pendingCommands: pendingCommands.size
    }));
    return;
  }

  if (url.pathname === '/cmd' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', async () => {
      try {
        const cmd = JSON.parse(body);
        const timeout = cmd.timeout || 30000;
        const result = await executeOnPC(cmd, timeout);
        commandHistory.push({ cmd, result, time: new Date().toISOString() });
        res.writeHead(200);
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Quick execution without waiting for result (fire and forget)
  if (url.pathname === '/cmd/fast' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const cmd = JSON.parse(body);
        executeOnPC(cmd, cmd.timeout || 15000).then(result => {
          commandHistory.push({ cmd, result, time: new Date().toISOString() });
        }).catch(() => {});
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, queued: true }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (url.pathname === '/instruction' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const instruction = JSON.parse(body);
        if (instructionResolve) {
          instructionResolve(instruction);
          instructionResolve = null;
          res.writeHead(200);
          res.end(JSON.stringify({ ok: true }));
        } else {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'No hay tarea esperando instrucción' }));
        }
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (url.pathname === '/screenshot') {
    const quality = parseInt(url.searchParams.get('quality') || '60');
    const scale = parseFloat(url.searchParams.get('scale') || '0.75');
    executeOnPC({ type: 'screenshot', quality, scale, force: true })
      .then(result => res.writeHead(200) || res.end(JSON.stringify(result)))
      .catch(e => res.writeHead(500).end(JSON.stringify({ error: e.message })));
    return;
  }

  if (url.pathname === '/screenshot/stable') {
    const quality = parseInt(url.searchParams.get('quality') || '60');
    const waitMs = parseInt(url.searchParams.get('wait') || '500');
    executeOnPC({ type: 'wait', ms: waitMs }).then(() =>
      executeOnPC({ type: 'screenshot', quality, scale: 0.75, force: true })
    ).then(result => res.writeHead(200) || res.end(JSON.stringify(result)))
    .catch(e => res.writeHead(500).end(JSON.stringify({ error: e.message })));
    return;
  }

  if (url.pathname === '/history') {
    res.writeHead(200);
    res.end(JSON.stringify({ history: commandHistory.slice(-100) }));
    return;
  }

  if (url.pathname === '/env') {
    Promise.all([
      executeOnPC({ type: 'sysinfo' }).catch(() => ({})),
      executeOnPC({ type: 'list_windows' }).catch(() => ({})),
      executeOnPC({ type: 'list_apps' }).catch(() => ({})),
      executeOnPC({ type: 'browser_tabs' }).catch(() => ({}))
    ]).then(([sysinfo, windows, apps, browsers]) => {
      res.writeHead(200);
      res.end(JSON.stringify({ sysinfo, windows, apps, browsers }));
    }).catch(e => res.writeHead(500).end(JSON.stringify({ error: e.message })));
    return;
  }

  if (url.pathname === '/task' && req.method === 'POST') {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => {
      try {
        const { task, context } = JSON.parse(body);
        executeAutonomousTask(task, { send: (m) => sendToMimo(m) }, context).catch(e => console.error(e));
        res.writeHead(200);
        res.end(JSON.stringify({ ok: true, message: 'Tarea iniciada' }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  if (url.pathname === '/health' || url.pathname === '/__health') {
    res.writeHead(200);
    res.end(JSON.stringify({ ok: true, agentConnected: !!pcAgent, pending: pendingCommands.size }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
});

const server = http.createServer((req, res) => {
  apiServer.emit('request', req, res);
});

server.on('upgrade', (req, socket, head) => {
  if (req.url === '/mimo') {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║         MiMoCode Bridge Server v2               ║
║         Puente cerebro ↔ manos                  ║
╠══════════════════════════════════════════════════╣
║  WebSocket: ws://localhost:${PORT}/mimo           ║
║  HTTP API:  http://localhost:${PORT}/status        ║
║  Agent:     ${AGENT_SERVER.padEnd(34)}║
║  Task timeout: ${String(TASK_TIMEOUT).padEnd(30)}║
║  Instruction timeout: ${String(INSTRUCTION_TIMEOUT).padEnd(22)}║
╚══════════════════════════════════════════════════╝
  `);
  connectToAgent();
});

process.on('SIGINT', () => {
  console.log('\n[bridge] Deteniendo...');
  if (agentWs) agentWs.close();
  server.close();
  process.exit(0);
});

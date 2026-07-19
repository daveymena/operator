import { WebSocket } from 'ws';

let bridgeWs = null;
let reconnectTimer = null;

export function connectToBridge(bridgeUrl = 'ws://localhost:20100') {
  if (bridgeWs) return;

  console.log(`[OPERATOR-BRIDGE] Conectando a ${bridgeUrl}...`);
  bridgeWs = new WebSocket(bridgeUrl);

  bridgeWs.on('open', () => {
    console.log('[OPERATOR-BRIDGE] Conectado al Bridge');
    bridgeWs.send(JSON.stringify({
      type: 'register',
      service: 'trading-api',
      capabilities: [
        'backtest', 'signals', 'optimization',
        'risk-status', 'regime-analysis',
        'trades', 'neural-filter'
      ],
    }));
  });

  bridgeWs.on('message', async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'ping') {
        bridgeWs.send(JSON.stringify({ type: 'pong' }));
        return;
      }
      if (msg.type === 'command') {
        const result = await handleCommand(msg.command);
        bridgeWs.send(JSON.stringify({ type: 'command_result', id: msg.id, ...result }));
      }
    } catch (e) {
      console.error('[OPERATOR-BRIDGE] Error:', e.message);
    }
  });

  bridgeWs.on('close', () => {
    console.log('[OPERATOR-BRIDGE] Desconectado, reconectando en 5s...');
    bridgeWs = null;
    reconnectTimer = setTimeout(() => connectToBridge(bridgeUrl), 5000);
  });

  bridgeWs.on('error', (e) => {
    console.error('[OPERATOR-BRIDGE] Error WS:', e.message);
  });
}

async function handleCommand(cmd) {
  const { spawn } = await import('child_process');
  const path = await import('path');
  const root = path.resolve(import.meta.dirname, '../..');

  switch (cmd.type) {
    case 'backtest':
      return await runPython(root, 'scripts/run_backtest.py', [cmd.symbol || 'EURUSD', JSON.stringify(cmd.params || {})]);

    case 'signals':
      return await runPython(root, 'scripts/generate_signal.py', [cmd.symbol || 'EURUSD']);

    case 'optimize': {
      const result = await runPython(root, 'scripts/run_optimization_api.py', [cmd.symbol || 'EURUSD', String(cmd.generations || 10)]);
      return result;
    }

    case 'diagnostic':
      return await runPython(root, 'scripts/diagnostic.py', []);

    case 'download-data':
      return await runPython(root, 'scripts/download_data.py', []);

    default:
      return { error: `Unknown command: ${cmd.type}` };
  }
}

function runPython(root, script, args = []) {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const proc = spawn('python', ['-X', 'utf8', script, ...args], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '', stderr = '';
    proc.stdout.on('data', d => stdout += d.toString());
    proc.stderr.on('data', d => stderr += d.toString());
    proc.on('close', code => {
      if (code === 0) {
        try { resolve(JSON.parse(stdout)); }
        catch { resolve({ output: stdout }); }
      } else {
        resolve({ error: stderr || `Exit code ${code}`, output: stdout });
      }
    });
    proc.on('error', e => resolve({ error: e.message }));
  });
}

export function disconnectFromBridge() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (bridgeWs) bridgeWs.close();
}

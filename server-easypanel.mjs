/**
 * Operator Pro v3.0 — Easypanel Server Entry Point
 * 
 * Starts all services:
 * 1. Operator Pro API Server (port 3000)
 * 2. Bridge WebSocket (port 20100)
 * 3. Agent Server (port 21291) - legacy compatibility
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function log(name, msg) {
  console.log(`[${name}] ${new Date().toISOString()} ${msg}`);
}

function startService(name, cmd, args, opts = {}) {
  log(name, `Starting: ${cmd} ${args.join(' ')}`);
  
  const proc = spawn(cmd, args, {
    cwd: opts.cwd || __dirname,
    stdio: 'inherit',
    env: { ...process.env, ...(opts.env || {}) }
  });

  proc.on('error', (e) => log(name, `Error: ${e.message}`));
  proc.on('exit', (code) => log(name, `Exited with code: ${code}`));
  
  return proc;
}

console.log(`
╔══════════════════════════════════════════════════════════════════╗
║    🚀 Operator Pro v3.0 — Easypanel Server                      ║
╚══════════════════════════════════════════════════════════════════╝
`);

const services = [];

// 1. Operator Pro API Server
const apiPort = process.env.OPERATOR_PORT || 3000;
log('API', `Starting on port ${apiPort}...`);
services.push(startService('API', 'node', ['operator.mjs', '--server', `--port=${apiPort}`]));

// 2. Bridge WebSocket
const bridgePort = process.env.BRIDGE_PORT || 20100;
log('Bridge', `Starting on port ${bridgePort}...`);
services.push(startService('Bridge', 'node', ['bridge/bridge.mjs']));

// 3. Agent Server (legacy compatibility)
const agentServerPath = path.join(__dirname, 'opencode-core', 'agent-server.mjs');
if (fs.existsSync(agentServerPath)) {
  log('Agent', 'Starting agent server...');
  services.push(startService('Agent', 'node', ['agent-server.mjs'], {
    cwd: path.join(__dirname, 'opencode-core')
  }));
}

console.log(`
✅ All services started:
   📊 Dashboard: http://localhost:${apiPort}/dashboard
   🔌 API:       http://localhost:${apiPort}/api
   🌐 Bridge:    ws://localhost:${bridgePort}
`);

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('\n🛑 Stopping all services...');
  services.forEach(s => s.kill('SIGTERM'));
  process.exit(0);
});

process.on('SIGTERM', () => {
  services.forEach(s => s.kill('SIGTERM'));
  process.exit(0);
});

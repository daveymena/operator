import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const APP_DIR = path.resolve(__dirname, 'opencode-core');

function start(name, cmd, args, opts = {}) {
  const proc = spawn(cmd, args, { cwd: APP_DIR, stdio: 'inherit', ...opts });
  proc.on('error', (e) => console.log(`[${name}] Error: ${e.message}`));
  proc.on('exit', (code) => console.log(`[${name}] Salida: ${code}`));
  return proc;
}

console.log('Iniciando servicios OpenCode + Hermes...');
start('agent-server.mjs', 'node', ['agent-server.mjs']);
start('bridge-server.mjs', 'node', ['bridge-server.mjs']);

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

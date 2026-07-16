import http from 'http';
import { spawn } from 'child_process';
const opts = { hostname: '127.0.0.1', port: 20102 };

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({ ...opts, path, method, headers: data ? { 'Content-Type': 'application/json' } : {} }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
    });
    r.on('error', reject);
    r.setTimeout(15000, () => { r.destroy(); resolve({}); });
    if (data) r.write(data);
    r.end();
  });
}

const agents = await req('GET', '/agents');
const id = agents[0]?.id;
if (!id) { console.log('No agent'); process.exit(); }

// Matar todas las terminales y procesos Hermes
const cmds = [
  'taskkill /f /im WindowsTerminal.exe 2>nul',
  'taskkill /f /im conhost.exe 2>nul',
  'taskkill /f /im python.exe 2>nul',
  'taskkill /f /im hermes.exe 2>nul',
  'taskkill /f /fi "WINDOWTITLE eq HERMES*" 2>nul',
  'taskkill /f /fi "WINDOWTITLE eq Windows PowerShell*" 2>nul'
];
for (const c of cmds) {
  await req('POST', '/agents/' + id, { type: 'cmd', command: c });
}
console.log('Terminales cerradas');

// Esperar y luego abrir Hermes
setTimeout(() => {
  spawn('powershell', ['-NoExit', '-Command', "cd C:\\Users\\ADMIN\\Music\\hermes-core; python cli.py"], {
    cwd: 'C:\\Users\\ADMIN\\Music\\hermes-core',
    stdio: 'inherit'
  });
  console.log('Hermes iniciado');
}, 3000);

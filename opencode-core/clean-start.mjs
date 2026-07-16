import http from 'http';
import { spawn } from 'child_process';
import fs from 'fs';
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
if (id) {
  // Kill all python/hermes
  await req('POST', '/agents/' + id, { type: 'cmd', command: 'taskkill /f /im python.exe /fi "PID ne ' + id + '" 2>nul & echo done' });
  await req('POST', '/agents/' + id, { type: 'cmd', command: 'taskkill /f /im hermes.exe 2>nul & echo done' });
  console.log('Procesos python y hermes eliminados');
}

// Start fresh hermes
const hermes = spawn('powershell', ['-NoExit', '-Command', "cd C:\\Users\\ADMIN\\Music\\hermes-core; hermes"], {
  cwd: 'C:\\Users\\ADMIN\\Music\\hermes-core',
  stdio: 'inherit'
});
console.log('Hermes iniciado (PID: ' + hermes.pid + ')');

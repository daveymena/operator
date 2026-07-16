import http from 'http';
const opts = { hostname: '127.0.0.1', port: 20102 };

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({ ...opts, path, method, headers: data ? { 'Content-Type': 'application/json' } : {} }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { resolve({}); } });
    });
    r.on('error', reject);
    r.setTimeout(30000, () => { r.destroy(); resolve({}); });
    if (data) r.write(data);
    r.end();
  });
}

const agents = await req('GET', '/agents');
const id = agents[0]?.id;
if (!id) { console.log('No agent'); process.exit(); }

// First, try cmd to see what's on the Hermes terminal window
const cmdResult = await req('POST', '/agents/' + id, { type: 'cmd', command: 'tasklist /FI "PID eq 15740" /FO CSV' });
console.log('Window check:', cmdResult.output?.substring(0,200));

// Send Ctrl+C to break any stuck process, then check if hermes responds
await req('POST', '/agents/' + id, { type: 'powershell', script: 'Write-Host "---HERMES_CHECK---"' });
const keyResult = await req('POST', '/agents/' + id, { type: 'keyboard_type', text: '/help\n' });
console.log('Key send:', keyResult.ok);

// Try to find what's stuck - list processes
const psResult = await req('POST', '/agents/' + id, { type: 'powershell', script: 'Get-Process python,node | Select-Object Id,ProcessName,CPU,Responding | ConvertTo-Json -Compress' });
console.log('Processes:', psResult.ok ? psResult.output?.substring(0,500) : psResult.error);

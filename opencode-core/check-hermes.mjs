import http from 'http';
const opts = { hostname: '127.0.0.1', port: 20102 };

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({ ...opts, path, method, headers: data ? { 'Content-Type': 'application/json' } : {} }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

const agents = await req('GET', '/agents');
if (!agents.length) { console.log('No agents'); process.exit(); }
const agentId = agents[0].id;
console.log('Agent:', agentId);

const windows = await req('POST', '/agents/' + agentId, { type: 'powershell', script: 'Get-Process | Where-Object MainWindowTitle | Select-Object Id,ProcessName,@{N="Title";E={$_.MainWindowTitle}} | ConvertTo-Json -Compress' });
console.log('Windows:', JSON.stringify(windows, null, 2));

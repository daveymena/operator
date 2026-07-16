import http from 'http';
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

const r1 = await req('POST', '/agents/' + id, { type: 'powershell', script: 'Get-Process python* | Select-Object Id,ProcessName,@{N="Cmd";E={$_.CommandLine}} | ConvertTo-Json -Compress' });
console.log('Python:', r1.ok ? r1.output : r1.error);

const r2 = await req('POST', '/agents/' + id, { type: 'cmd', command: 'tasklist /FI "IMAGENAME eq python.exe" /FO CSV' });
console.log('tasklist:', r2.output);

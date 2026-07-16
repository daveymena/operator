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

const result = await req('POST', '/agents/' + id, {
  type: 'powershell',
  script: 'Get-Process | Where-Object { $_.ProcessName -match "python|hermes|opencode" -or $_.MainWindowTitle -match "Hermes|PowerShell|OpenCode" } | Select-Object Id,ProcessName,@{N="Title";E={$_.MainWindowTitle}},CPU,StartTime | ConvertTo-Json -Compress'
});
if (result.ok) {
  const procs = JSON.parse(result.output || '[]');
  console.log('=== Procesos relevantes ===');
  for (const p of Array.isArray(procs) ? procs : [procs]) {
    if (p.Id) console.log(`PID:${p.Id} ${p.ProcessName} "${p.Title || ''}" CPU:${p.CPU || 0}`);
  }
} else {
  console.log('Error:', result.error);
}

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

const result = await req('POST', '/agents/' + id, {
  type: 'powershell',
  script: 'Get-CimInstance Win32_Process -Filter "Name like \'%python%\'" | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress'
});
if (result.ok) {
  const lines = (result.output || '').split('\n');
  for (const line of lines) {
    if (line.includes('hermes') || line.includes('cli') || line.includes('agent')) {
      console.log(line);
    }
  }
  console.log('Full output (first 2000 chars):');
  console.log((result.output || '').substring(0, 2000));
} else {
  console.log('Error:', result.error);
}

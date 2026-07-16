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

// Kill stuck python processes (but keep dashboard PID 17960)
const killTargets = [6132, 16488, 1508, 15748];
for (const pid of killTargets) {
  const r = await req('POST', '/agents/' + id, { type: 'cmd', command: 'taskkill /f /pid ' + pid });
  console.log('Kill PID ' + pid + ':', r.ok, r.output?.trim() || '');
}

console.log('Done killing stuck processes');

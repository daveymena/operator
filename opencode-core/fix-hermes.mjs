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

// Check python processes command lines
const result = await req('POST', '/agents/' + id, {
  type: 'powershell',
  script: 'Get-CimInstance Win32_Process | Where-Object { $_.Name -eq "python.exe" } | Select-Object ProcessId,CommandLine | Format-List'
});
if (result.ok) {
  console.log('=== Python Processes ===');
  console.log(result.output?.substring(0, 2000));
} else {
  console.log('Error:', result.error);
}

// Check hermes processes command lines
const result2 = await req('POST', '/agents/' + id, {
  type: 'powershell',
  script: 'Get-CimInstance Win32_Process | Where-Object { $_.Name -eq "hermes.exe" } | Select-Object ProcessId,CommandLine | Format-List'
});
if (result2.ok) {
  console.log('=== Hermes Processes ===');
  console.log(result2.output?.substring(0, 1000));
} else {
  console.log('Error:', result2.error);
}

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
const id = agents[0].id;

// Enfocar terminal
console.log('Enfocando terminal...');
await req('POST', '/agents/' + id, { type: 'powershell', script: '[Runtime.InteropServices.Marshal]::GetActiveObject("Shell.Application").MinimizeAll(); Start-Sleep 1; $h=Get-Process WindowsTerminal | Select-Object -First 1; if($h){$h.MainWindowHandle}' });

// Tomar screenshot
console.log('Tomando screenshot...');
const ss = await req('POST', '/agents/' + id, { type: 'screenshot', quality: 60, scale: 0.5 });
require('fs').writeFileSync('C:\\Users\\ADMIN\\Music\\opencode-core\\screen.jpg', Buffer.from(ss.base64, 'base64'));
console.log('Screenshot guardado');

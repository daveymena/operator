// Script para interactuar con Facebook Ads Manager en Chrome existente
// Usa PowerShell directo para enfocar ventana y tomar screenshots

import http from 'http';

const AGENT = 'http://127.0.0.1:20102';

function req(agentId, cmd) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(cmd);
    const opts = {
      hostname: '127.0.0.1', port: 20102,
      path: '/agents/' + agentId,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    };
    const r = http.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch { resolve(d); }
      });
    });
    r.on('error', reject);
    r.write(data);
    r.end();
  });
}

async function main() {
  // Get agent list
  const agents = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:20102/agents', res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });

  const agentId = agents[0]?.id;
  if (!agentId) { console.error('No agent found'); return; }

  console.log('Agent ID:', agentId);

  // 1. Focus the Chrome window with Ads Manager
  console.log('\n=== Enfocando ventana de Chrome (Ads Manager) ===');
  const focusResult = await req(agentId, { type: 'focus_window', pid: 5648 });
  console.log('Focus result:', JSON.stringify(focusResult));

  // Wait for window to come to front
  await new Promise(r => setTimeout(r, 2000));

  // 2. Take screenshot
  console.log('\n=== Tomando screenshot ===');
  const ssResult = await req(agentId, { type: 'screenshot', quality: 85, scale: 0.8 });
  console.log('Screenshot result:', JSON.stringify(ssResult).substring(0, 200));

  // 3. List windows to confirm focus
  const winsResult = await req(agentId, { type: 'list_windows' });
  if (winsResult.ok) {
    const chromeWins = winsResult.windows.filter(w => w.title.includes('Administrador') || w.title.includes('Anuncios'));
    console.log('\nChrome Ads Manager windows:', JSON.stringify(chromeWins));
  }

  console.log('\n=== Listo ===');
}

main().catch(e => console.error('Error:', e));

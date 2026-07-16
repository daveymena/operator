import http from 'http';
import fs from 'fs';

const AGENT_URL = 'http://127.0.0.1:20102';
const SS_DIR = 'C:\\Users\\ADMIN\\Music\\agent_screenshots';
fs.mkdirSync(SS_DIR, { recursive: true });

let step = 0;
let agentId = '';

async function agentCommand(cmd) {
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
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    });
    r.on('error', reject);
    r.write(data);
    r.end();
  });
}

async function getAgentId() {
  return new Promise((resolve, reject) => {
    http.get(AGENT_URL + '/agents', res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const agents = JSON.parse(d);
          if (agents.length > 0) resolve(agents[0].id);
          else reject('No agents');
        } catch(e) { reject(e.message); }
      });
    }).on('error', reject);
  });
}

async function screenshot(name) {
  step++;
  const result = await agentCommand({ type: 'screenshot', quality: 85, scale: 0.7, force: true });
  if (result.ok && result.base64) {
    const buf = Buffer.from(result.base64, 'base64');
    const path = `${SS_DIR}\\${step}_${name}.jpg`;
    fs.writeFileSync(path, buf);
    console.log(`  📸 ${step}. ${name}.jpg (${result.width}x${result.height})`);
    return { path, width: result.width, height: result.height };
  }
  console.log(`  ❌ Screenshot failed: ${result.error || 'unknown'}`);
  return null;
}

async function mouseMove(x, y) {
  return agentCommand({ type: 'mouse_move', x, y });
}

async function mouseClick(button = 'left') {
  return agentCommand({ type: 'mouse_click', button });
}

async function keyboardType(text) {
  return agentCommand({ type: 'keyboard_type', text });
}

async function keyboardPress(key) {
  return agentCommand({ type: 'keyboard_press', key });
}

async function keyCombo(modifiers, key) {
  return agentCommand({ type: 'keyboard_shortcut', modifiers, key });
}

async function focusWindow(titleMatch) {
  const wins = await agentCommand({ type: 'list_windows' });
  if (wins.ok && wins.windows) {
    const target = wins.windows.find(w => w.title.toLowerCase().includes(titleMatch.toLowerCase()));
    if (target) {
      console.log(`  🎯 Enfocando: ${target.title.substring(0, 60)}`);
      return agentCommand({ type: 'focus_window', pid: target.pid });
    }
  }
  return null;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('🧠 AGENTE HUMANO - CONTROLANDO PC CON MOUSE Y VISION\n');
  
  // Get agent
  agentId = await getAgentId();
  console.log(`[AGENTE] Conectado: ${agentId.substring(0, 8)}...`);
  
  // Step 1: Screenshot del escritorio
  console.log('\n[1/6] Capturando pantalla...');
  await screenshot('escritorio');
  
  // Step 2: List windows to find Chrome/Facebook
  console.log('\n[2/6] Buscando ventanas abiertas...');
  const windows = await agentCommand({ type: 'list_windows' });
  if (windows.ok && windows.windows) {
    const browsers = windows.windows.filter(w => 
      w.title.includes('Chrome') || w.title.includes('facebook') || w.title.includes('developers')
    );
    console.log(`  Ventanas de interes: ${browsers.length}`);
    browsers.forEach(w => console.log(`  - ${w.title.substring(0, 80)} (PID: ${w.pid})`));
    
    // Focus Chrome
    const chromeWin = browsers.find(w => w.title.includes('Chrome') || w.title.includes('facebook') || w.title.includes('developers'));
    if (chromeWin) {
      console.log(`\n  Enfocando Chrome: ${chromeWin.title.substring(0, 60)}`);
      await focusWindow(chromeWin.title.substring(0, 30));
      await sleep(1000);
      await screenshot('chrome_enfocado');
    }
  }
  
  // Step 3: Use Alt+D to focus address bar, then type URL
  console.log('\n[3/6] Navegando a Graph API Explorer...');
  
  // Press Alt+D to focus address bar (works in Chrome)
  await keyCombo(['alt'], 'd');
  await sleep(500);
  
  // Type the URL
  await keyboardType('https://developers.facebook.com/tools/explorer/');
  await sleep(300);
  await keyboardPress('enter');
  await sleep(5000);
  
  await screenshot('graph_explorer');
  
  // Step 4: Check if we need to login
  await screenshot('explorer_view');
  
  // Step 5: Click "Get Access Token" button
  console.log('\n[4/6] Buscando boton de token en pantalla...');
  
  // We need to find the button coordinates. Let me use a different approach:
  // Use the browser's developer tools via keyboard shortcuts
  
  // F12 to open devtools, then we can run JS
  // But this is complicated. Let me try a simpler approach:
  // Use keyboard Tab to navigate to the Get Token button
  
  // Actually, let me just take a screenshot and analyze what we see
  const ss = await screenshot('for_analysis');
  
  // Step 5: Try to use Tab navigation to reach the token button
  console.log('\n[5/6] Navegando con teclado (simulando humano)...');
  
  // Press Tab multiple times to reach the Get Access Token button
  for (let i = 0; i < 10; i++) {
    await keyboardPress('tab');
    await sleep(200);
  }
  await sleep(500);
  
  // Take screenshot to see what's focused
  await screenshot('after_tabs');
  
  // Try Enter to click whatever is focused
  await keyboardPress('enter');
  await sleep(3000);
  
  await screenshot('after_enter');
  
  // Step 6: Try to see if we got a token dialog
  console.log('\n[6/6] Verificando resultado...');
  await screenshot('final_state');
  
  console.log(`\n✅ Capturas guardadas en: ${SS_DIR}`);
  console.log('Revisa las imagenes para ver el estado.');
}

main().catch(e => console.log('ERROR:', e.message));

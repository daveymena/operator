#!/usr/bin/env node
/**
 * Quick test — Conecta a tu Operator Pro vía ngrok
 * Ejecuta esto DESDE TU PC (no desde el sandbox)
 * 
 * node quick-remote-test.mjs https://c567-181-54-0-78.ngrok-free.app
 */

const URL = process.argv[2] || 'https://c567-181-54-0-78.ngrok-free.app';

const headers = {
  'Content-Type': 'application/json',
  'ngrok-skip-browser-warning': 'true'
};

async function test() {
  console.log(`\n🔗 Conectando a: ${URL}\n`);

  // 1. Health check
  console.log('1️⃣  Health Check:');
  try {
    const res = await fetch(`${URL}/health`, { headers });
    const data = await res.json();
    console.log(`   ✅ Conectado — ${data.name} v${data.version}`);
    console.log(`   🖥️  ${data.system?.os} | ${data.system?.cpus} CPUs | ${data.system?.totalMemMB}MB RAM`);
    console.log(`   🌐 Browser: ${data.browser ? 'ON' : 'OFF'} | Tasks: ${data.activeTasks}`);
  } catch (e) {
    console.log(`   ❌ Error: ${e.message}`);
    console.log('   → Asegúrate de que Operator Pro está corriendo en tu PC');
    console.log('   → Ejecuta: node operator.mjs --server');
    return;
  }

  // 2. System info
  console.log('\n2️⃣  System Info:');
  try {
    const res = await fetch(`${URL}/api/system/info`, { headers });
    const data = await res.json();
    console.log(`   Hostname: ${data.hostname}`);
    console.log(`   User: ${data.user}`);
    console.log(`   Shell: ${data.shell}`);
  } catch (e) {
    console.log(`   ❌ ${e.message}`);
  }

  // 3. Execute command
  console.log('\n3️⃣  Terminal Exec (whoami + date):');
  try {
    const res = await fetch(`${URL}/api/actions/execute`, {
      method: 'POST', headers,
      body: JSON.stringify({ action: { type: 'terminal_exec', params: { command: 'whoami && date && hostname' } } })
    });
    const data = await res.json();
    console.log(`   ${data.ok ? '✅' : '❌'} ${data.stdout || data.error}`);
  } catch (e) {
    console.log(`   ❌ ${e.message}`);
  }

  // 4. List files
  console.log('\n4️⃣  List Directory (.):');
  try {
    const res = await fetch(`${URL}/api/files?path=.`, { headers });
    const data = await res.json();
    console.log(`   ✅ ${data.count} items`);
    data.items?.slice(0, 8).forEach(i => console.log(`   ${i.isDir ? '📁' : '📄'} ${i.name}`));
    if (data.count > 8) console.log(`   ... y ${data.count - 8} más`);
  } catch (e) {
    console.log(`   ❌ ${e.message}`);
  }

  // 5. Send a task
  console.log('\n5️⃣  Enviar tarea autónoma:');
  try {
    const res = await fetch(`${URL}/api/tasks`, {
      method: 'POST', headers,
      body: JSON.stringify({ task: 'Muestra la fecha actual y el nombre del equipo', options: {} })
    });
    const data = await res.json();
    console.log(`   ✅ Task queued: ${data.taskId}`);
    console.log(`   📊 Monitorea en: ${URL}/dashboard`);
  } catch (e) {
    console.log(`   ❌ ${e.message}`);
  }

  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║  ✅ CONEXIÓN EXITOSA                                         ║
║                                                              ║
║  Tu PC está siendo controlada remotamente por Operator Pro   ║
║                                                              ║
║  Dashboard: ${URL}/dashboard                         ║
║  API:       ${URL}/api                                ║
║                                                              ║
║  Ahora puedes:                                               ║
║  • Enviar tareas desde cualquier lugar                       ║
║  • Controlar el navegador de tu PC                           ║
║  • Ejecutar comandos en terminal                             ║
║  • Ver screenshots en tiempo real                            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
`);
}

test();

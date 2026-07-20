#!/usr/bin/env node

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║    Operator Pro — REMOTE CLIENT                                 ║
 * ║    Controla tu PC desde cualquier lugar vía ngrok               ║
 * ╚══════════════════════════════════════════════════════════════════╝
 * 
 * Este cliente se conecta a tu instancia de Operator Pro
 * corriendo en tu PC (expuesta vía ngrok) y te permite:
 * 
 * - Enviar tareas remotamente
 * - Ejecutar acciones directas
 * - Ver estado del sistema
 * - Controlar el navegador
 * - Ejecutar comandos en terminal
 * 
 * USO:
 *   node remote-client.mjs --url=https://xxx.ngrok-free.app
 *   node remote-client.mjs --url=https://xxx.ngrok-free.app --task="tu tarea"
 *   node remote-client.mjs --url=https://xxx.ngrok-free.app --action=screenshot
 *   node remote-client.mjs --url=https://xxx.ngrok-free.app --terminal="ls -la"
 */

import axios from 'axios';

// ─── Parse Args ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const flags = {};
for (const arg of args) {
  if (arg.startsWith('--')) {
    const [k, v] = arg.slice(2).split('=');
    flags[k] = v || true;
  }
}

const BASE_URL = flags.url || process.env.OPERATOR_URL;
const API_KEY = flags.key || process.env.OPERATOR_API_KEY || '';

if (!BASE_URL) {
  console.error('❌ Error: --url es requerido');
  console.error('   Ejemplo: node remote-client.mjs --url=https://xxx.ngrok-free.app');
  process.exit(1);
}

// ─── HTTP Client ─────────────────────────────────────────────────────────────

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true', // ngrok requirement
    ...(API_KEY ? { 'Authorization': `Bearer ${API_KEY}` } : {})
  }
});

// ─── Functions ───────────────────────────────────────────────────────────────

async function healthCheck() {
  try {
    const res = await client.get('/health');
    console.log('\n✅ CONECTADO A OPERATOR PRO\n');
    console.log('   Versión:', res.data.version);
    console.log('   Plataforma:', res.data.platform);
    console.log('   Uptime:', Math.round(res.data.uptime / 60), 'minutos');
    console.log('   Tareas activas:', res.data.activeTasks);
    console.log('   Browser:', res.data.browser ? '✅ Conectado' : '❌ Desconectado');
    console.log('   WebSocket clients:', res.data.wsClients);
    
    if (res.data.system) {
      console.log('\n   Sistema:');
      console.log('   - OS:', res.data.system.os);
      console.log('   - CPUs:', res.data.system.cpus, 'x', res.data.system.cpuModel?.substring(0, 30));
      console.log('   - RAM:', res.data.system.totalMemMB, 'MB');
      console.log('   - Hostname:', res.data.system.hostname);
    }
    
    return res.data;
  } catch (e) {
    console.error('❌ No se pudo conectar:', e.message);
    process.exit(1);
  }
}

async function runTask(task) {
  console.log(`\n🎯 Enviando tarea: "${task}"\n`);
  
  try {
    const res = await client.post('/api/tasks', { task, options: {} });
    console.log('✅ Tarea iniciada');
    console.log('   Task ID:', res.data.taskId);
    console.log('   Status:', res.data.status);
    console.log('\n💡 Monitorea el progreso en:', BASE_URL + '/dashboard');
    return res.data;
  } catch (e) {
    console.error('❌ Error:', e.response?.data?.error || e.message);
  }
}

async function executeAction(action) {
  console.log(`\n⚡ Ejecutando acción: ${action.type}\n`);
  
  try {
    const res = await client.post('/api/actions/execute', { action });
    
    if (res.data.ok) {
      console.log('✅ ÉXITO');
      
      // Show relevant output based on action type
      if (action.type === 'terminal_exec') {
        console.log('\n📤 Output:');
        console.log(res.data.stdout);
        if (res.data.stderr) {
          console.log('\n⚠️ Stderr:');
          console.log(res.data.stderr);
        }
      } else if (action.type === 'read_file') {
        console.log('\n📄 Contenido:');
        console.log(res.data.content?.substring(0, 500));
      } else if (action.type === 'list_dir') {
        console.log(`\n📁 ${res.data.count} items:`);
        res.data.items?.slice(0, 10).forEach(item => {
          const icon = item.isDir ? '📁' : '📄';
          console.log(`   ${icon} ${item.name}`);
        });
      } else if (action.type === 'sysinfo') {
        console.log('\n💻 Sistema:');
        Object.entries(res.data).forEach(([k, v]) => {
          if (k !== 'ok') console.log(`   ${k}: ${v}`);
        });
      } else {
        console.log(JSON.stringify(res.data, null, 2));
      }
    } else {
      console.log('❌ Error:', res.data.error);
    }
    
    return res.data;
  } catch (e) {
    console.error('❌ Error:', e.response?.data?.error || e.message);
  }
}

async function getActiveTasks() {
  try {
    const res = await client.get('/api/tasks');
    console.log('\n📋 TAREAS ACTIVAS:\n');
    
    if (res.data.tasks?.length === 0) {
      console.log('   No hay tareas activas');
    } else {
      res.data.tasks?.forEach(task => {
        console.log(`   🆔 ${task.id}`);
        console.log(`      Tarea: ${task.task}`);
        console.log(`      Status: ${task.status}`);
        console.log(`      Pasos: ${task.steps}/${task.maxSteps}`);
        console.log('');
      });
    }
    
    return res.data;
  } catch (e) {
    console.error('❌ Error:', e.response?.data?.error || e.message);
  }
}

async function getHistory() {
  try {
    const res = await client.get('/api/history');
    console.log('\n📜 HISTORIAL DE TAREAS:\n');
    
    if (res.data.tasks?.length === 0) {
      console.log('   No hay historial');
    } else {
      res.data.tasks?.slice(0, 10).forEach(task => {
        const icon = task.status === 'completed' ? '✅' : '❌';
        console.log(`   ${icon} [${task.id}] ${task.task}`);
        console.log(`      ${task.steps} pasos - ${new Date(task.created).toLocaleString()}`);
        console.log('');
      });
    }
    
    return res.data;
  } catch (e) {
    console.error('❌ Error:', e.response?.data?.error || e.message);
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║    🌐 OPERATOR PRO REMOTE CLIENT                                 ║
║    Controla tu PC desde cualquier lugar                          ║
╚══════════════════════════════════════════════════════════════════╝

Conectando a: ${BASE_URL}
`);

  // Always do health check first
  await healthCheck();

  // Route based on flags
  if (flags.task) {
    await runTask(flags.task);
  } else if (flags.action) {
    const params = {};
    // Extract params from flags
    for (const [k, v] of Object.entries(flags)) {
      if (!['url', 'key', 'action', 'task', 'terminal'].includes(k)) {
        params[k] = v;
      }
    }
    await executeAction({ type: flags.action, params });
  } else if (flags.terminal) {
    await executeAction({ type: 'terminal_exec', params: { command: flags.terminal } });
  } else if (flags.tasks) {
    await getActiveTasks();
  } else if (flags.history) {
    await getHistory();
  } else if (flags.interactive) {
    // Interactive mode
    console.log('\n💡 MODO INTERACTIVO\n');
    console.log('Comandos disponibles:');
    console.log('  task <descripción>     - Ejecutar tarea autónoma');
    console.log('  action <tipo> [params] - Ejecutar acción directa');
    console.log('  terminal <comando>     - Ejecutar comando en terminal');
    console.log('  tasks                  - Ver tareas activas');
    console.log('  history                - Ver historial');
    console.log('  exit                   - Salir');
    console.log('\n(Este modo requiere readline, no implementado en este demo)');
  } else {
    // Show help
    console.log('\n📖 USO:\n');
    console.log('  node remote-client.mjs --url=<url> --task="tu tarea"');
    console.log('  node remote-client.mjs --url=<url> --action=screenshot');
    console.log('  node remote-client.mjs --url=<url> --terminal="ls -la"');
    console.log('  node remote-client.mjs --url=<url> --tasks');
    console.log('  node remote-client.mjs --url=<url> --history');
    console.log('\n💡 Ejemplos:\n');
    console.log('  node remote-client.mjs --url=https://xxx.ngrok-free.app --task="busca en google IA"');
    console.log('  node remote-client.mjs --url=https://xxx.ngrok-free.app --action=browser_goto --url=https://google.com');
    console.log('  node remote-client.mjs --url=https://xxx.ngrok-free.app --terminal="df -h"');
  }
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});

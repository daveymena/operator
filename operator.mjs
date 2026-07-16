import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setTimeout as sleep } from 'timers/promises';
import { Brain } from './operator/brain.mjs';
import { BridgeClient } from './operator/bridge-client.mjs';
import { Memory } from './operator/memory.mjs';
import { Knowledge } from './operator/knowledge.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CTX_FILE = path.join(__dirname, 'context.json');
const MAX_STEPS = 50;

function log(msg) { if (!process.argv.includes('--silent')) console.log(msg); }

function parseArgs() {
  const raw = process.argv.slice(2);
  const flags = {};
  const positional = [];
  for (const arg of raw) {
    if (arg.startsWith('--')) {
      const [k, v] = arg.includes('=') ? arg.slice(2).split('=') : [arg.slice(2), true];
      flags[k] = v;
    } else positional.push(arg);
  }
  return { flags, task: positional.join(' ') };
}

async function runTask(task, options = {}) {
  const memory = new Memory().init(task);
  const knowledge = new Knowledge();
  const bridge = new BridgeClient({ verbose: options.verbose });
  const brain = new Brain({
    groqKey: options.groqKey || process.env.GROQ_API_KEY,
    backend: options.brain || 'auto',
    verbose: options.verbose,
    bridge
  });

  await bridge.connect();

  log(`\n╔════════════════════════════════════════════════════╗`);
  log(`║     🤖 OPERATOR - SISTEMA AUTÓNOMO TOTAL          ║`);
  log(`╚════════════════════════════════════════════════════╝`);
  log(`\n  🎯 ${task}`);
  log(`  🧠 Brain: ${brain.backend}`);
  log(`  🔄 Pasos máx: ${MAX_STEPS}`);
  log(`  🆔 ID: ${memory.taskId}\n`);

  let knowledgeLoaded = false;
  if (options.docs) {
    log(`  📚 Cargando documentación: ${options.docs}`);
    const docs = await knowledge.load(options.docs);
    memory.setKnowledge(docs);
    knowledgeLoaded = true;
    log(`  ✅ Documentación cargada (${docs.length} caracteres)\n`);
  } else {
    await knowledge.loadProjectDocs();
    await knowledge.loadOpenCodeTools();
    log(`  📚 Documentación del proyecto cargada automáticamente\n`);
  }

  let state = { description: 'Iniciando...', url: '', cursor: '', windows: '' };

  for (let step = 1; step <= MAX_STEPS; step++) {
    log(`  ── Paso ${step}/${MAX_STEPS} ──`);

    const ss = await bridge.execute({ type: 'screenshot', params: { quality: 50, scale: 0.75 } });
    if (ss.ok) {
      state.description = await brain.describeImage(ss.base64);
      log(`  📸 ${path.basename(ss.file)}`);
    }

    const cursor = await bridge.execute({ type: 'get_cursor', params: {} });
    if (cursor.ok) state.cursor = cursor.output;

    const brainInput = knowledgeLoaded ? knowledge.getSummary() : knowledge.getToolList() + '\n\n' + knowledge.getSummary(5000);
    const decision = await brain.think(task, state, brainInput, memory.getHistory());

    if (!decision) {
      log(`  ❌ El cerebro no pudo decidir. Abortando.`);
      memory.markFailed('brain_no_decision');
      break;
    }

    log(`  🤔 ${decision.thought}`);
    log(`  🎬 ${decision.action?.type} ${JSON.stringify(decision.action?.params || {})}`);

    if (decision.done) {
      log(`\n  ✅ ${decision.reason || 'Completado!'}`);
      memory.markDone(decision.reason || 'completada');
      break;
    }

    const result = await bridge.execute(decision.action);
    log(`  📊 ${result.ok ? '✅' : '❌'} (${result.duration || 0}ms)`);
    if (!result.ok && result.error) log(`     ⚠️ ${result.error}`);

    memory.addStep(decision.thought, decision.action, result, state.description);

    if (decision.action?.type === 'mouse_click') await sleep(1500);
    else if (decision.action?.type === 'keyboard_type') await sleep(500);
    else if (decision.action?.type === 'open_url' || decision.action?.type === 'powershell') await sleep(2000);
    else await sleep(800);
  }

  bridge.close();
  const summary = memory.getSummary();
  log(`\n${'═'.repeat(55)}`);
  log(`  📊 ${summary.status === 'completed' ? '✅' : '❌'} ${summary.task}`);
  log(`     Pasos: ${summary.steps} | ✅ ${summary.successful} | ❌ ${summary.failed}`);
  log(`     Tiempo: ${summary.duration}`);
  log(`     Memoria: ${path.basename(memory.file)}`);
  log(`${'═'.repeat(55)}\n`);

  return summary;
}

async function main() {
  const { flags, task } = parseArgs();

  if (flags.list) {
    const tasks = Memory.listTasks();
    if (tasks.length === 0) { console.log('  No hay tareas anteriores.'); return; }
    console.log(`\n  📋 TAREAS ANTERIORES (${tasks.length}):\n`);
    tasks.forEach(t => console.log(`  ${t.status === 'completed' ? '✅' : '❌'} [${t.id}] ${t.task} — ${t.steps} pasos — ${new Date(t.created).toLocaleString()}${t.hasKnowledge ? ' 📚' : ''}`));
    return;
  }

  if (flags.view) {
    const mem = new Memory(flags.view);
    if (!mem.data.steps.length) { console.log('  Tarea no encontrada.'); return; }
    const d = mem.data;
    console.log(`\n  📋 ${d.task}`);
    console.log(`  Estado: ${d.status} | Pasos: ${d.steps.length} | Creada: ${new Date(d.created).toLocaleString()}`);
    if (d.completedAt) console.log(`  Completada: ${new Date(d.completedAt).toLocaleString()}`);
    if (d.reason) console.log(`  Razón: ${d.reason}`);
    if (d.error) console.log(`  Error: ${d.error}`);
    if (d.knowledge) console.log(`  📚 Knowledge: ${d.knowledge.substring(0, 200)}...`);
    d.steps.forEach(s => console.log(`\n  [${s.step}] 🤔 ${s.thought}\n        🎬 ${s.action?.type} ${JSON.stringify(s.action?.params||{})}\n        📊 ${s.result?.ok ? '✅' : '❌'} (${s.result?.duration||'?'}ms)`));
    return;
  }

  if (flags.help || !task) {
    console.log(`
  🤖 OPERATOR - SISTEMA AUTÓNOMO TOTAL

  node operator.mjs [flags] "tu tarea"

  FLAGS:
    --docs=<path|url>   Carga documentación de una app antes de actuar
    --brain=groq|hermes|local  Fuerza un backend de IA específico
    --list              Muestra tareas anteriores
    --view=<id>         Muestra detalle de una tarea
    --silent            Modo silencioso

  EJEMPLOS:
    node operator.mjs "crea campañas en facebook ads"
    node operator.mjs --docs="./docs" "analiza el sistema y ejecuta"
    node operator.mjs --docs="https://ejemplo.com/api-docs" "prueba la API"
    node operator.mjs --brain=groq "automatiza lo que veas en pantalla"
    node operator.mjs --list
    node operator.mjs --view=task_12345
    `);
    return;
  }

  const options = {};
  if (flags.docs) options.docs = flags.docs;
  if (flags.brain) options.brain = flags.brain;

  const ctx = JSON.parse(fs.readFileSync(CTX_FILE, 'utf8'));
  ctx.lastUsed = new Date().toISOString();
  ctx.sessions.push({ timestamp: ctx.lastUsed, task: task.substring(0, 100), status: 'started' });
  fs.writeFileSync(CTX_FILE, JSON.stringify(ctx, null, 2));

  await runTask(task, options);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });

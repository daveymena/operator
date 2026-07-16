import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setTimeout as sleep } from 'timers/promises';
import dotenv from 'dotenv';
import { Brain } from './operator/brain.mjs';
import { BridgeClient } from './operator/bridge-client.mjs';
import { Memory } from './operator/memory.mjs';
import { Knowledge } from './operator/knowledge.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envPath = path.join(__dirname, 'config', '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  if (process.argv.includes('--verbose') || process.argv.includes('--debug')) console.log(`  📄 .env cargado: ${envPath}`);
}
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

export async function runTask(task, options = {}) {
  const memory = new Memory().init(task);
  const knowledge = new Knowledge();
  const onProgress = options.onProgress || (() => {});
  const { execute } = await import('./operator/actions.mjs');
  const bridge = new BridgeClient({ verbose: options.verbose });
  const brain = new Brain({
    groqKey: options.groqKey || process.env.GROQ_API_KEY,
    backend: options.brain || 'auto',
    verbose: options.verbose,
    bridge
  });

  const useBridge = options.useBridge !== false && await bridge.connect();
  const execAction = useBridge ? (a) => bridge.execute(a) : execute;

  onProgress({ type: 'start', task, brain: brain.backend, maxSteps: MAX_STEPS, taskId: memory.taskId });

  let knowledgeLoaded = false;
  if (options.docs) {
    const docs = await knowledge.load(options.docs);
    memory.setKnowledge(docs);
    knowledgeLoaded = true;
  } else {
    await knowledge.loadProjectDocs();
    await knowledge.loadOpenCodeTools();
  }

  let state = { description: 'Iniciando...', url: '', cursor: '', windows: '' };

  for (let step = 1; step <= MAX_STEPS; step++) {
    onProgress({ type: 'step', step, maxSteps: MAX_STEPS });

    const ss = await execAction({ type: 'screenshot', params: { quality: 50, scale: 0.75 } });
    if (ss.ok) {
      state.description = await brain.describeImage(ss.base64);
      onProgress({ type: 'screenshot', file: path.basename(ss.file), description: state.description });
    }

    const cursor = await execAction({ type: 'get_cursor', params: {} });
    if (cursor.ok) state.cursor = cursor.output;

    const brainInput = knowledgeLoaded ? knowledge.getSummary() : knowledge.getToolList() + '\n\n' + knowledge.getSummary(5000);
    const decision = await brain.think(task, state, brainInput, memory.getHistory());

    if (!decision) {
      memory.markFailed('brain_no_decision');
      onProgress({ type: 'error', message: 'El cerebro no pudo decidir' });
      break;
    }

    if (decision.done) {
      memory.markDone(decision.reason || 'completada');
      onProgress({ type: 'done', reason: decision.reason || 'Completado!', backend: decision._backend });
      break;
    }

    onProgress({ type: 'decision', thought: decision.thought, action: decision.action, backend: decision._backend });
    const result = await execAction(decision.action);
    onProgress({ type: 'result', ok: result.ok, error: result.error, duration: result.duration });
    memory.addStep(decision.thought, decision.action, result, state.description);

    const delays = { mouse_click: 1500, keyboard_type: 500, open_url: 2000, powershell: 2000 };
    await sleep(delays[decision.action?.type] || 800);
  }

  bridge.close();
  const summary = memory.getSummary();
  onProgress({ type: 'summary', ...summary });
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

  options.onProgress = (msg) => {
    switch (msg.type) {
      case 'start': log(`\n╔════════════════════════════════════════════════════╗\n║     🤖 OPERATOR - SISTEMA AUTÓNOMO TOTAL          ║\n╚════════════════════════════════════════════════════╝\n\n  🎯 ${msg.task}\n  🧠 Brain: ${msg.brain}\n  🔄 Pasos máx: ${msg.maxSteps}\n  🆔 ID: ${msg.taskId}\n`); break;
      case 'step': log(`  ── Paso ${msg.step}/${msg.maxSteps} ──`); break;
      case 'screenshot': log(`  📸 ${msg.file}`); break;
      case 'decision': log(`  🤔 ${msg.thought}\n  🎬 ${msg.action?.type} ${JSON.stringify(msg.action?.params || {})}`); break;
      case 'result': log(`  📊 ${msg.ok ? '✅' : '❌'} (${msg.duration || 0}ms)${!msg.ok && msg.error ? `\n     ⚠️ ${msg.error}` : ''}`); break;
      case 'done': log(`\n  ✅ ${msg.reason}`); break;
      case 'error': log(`  ❌ ${msg.message}`); break;
      case 'summary': log(`\n${'═'.repeat(55)}\n  📊 ${msg.status === 'completed' ? '✅' : '❌'} ${msg.task}\n     Pasos: ${msg.steps} | ✅ ${msg.successful} | ❌ ${msg.failed}\n     Tiempo: ${msg.duration}\n${'═'.repeat(55)}\n`); break;
    }
  };
  await runTask(task, options);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });

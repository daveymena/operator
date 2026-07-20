#!/usr/bin/env node

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                    🤖 OPERATOR PRO v3.0                     ║
 * ║          Autonomous AI Agent — Web, Desktop & Server        ║
 * ╚══════════════════════════════════════════════════════════════╝
 * 
 * Operator Pro is a professional-grade autonomous agent that can:
 * - Navigate the web with intelligent browser automation
 * - Control desktop applications via screen + input simulation
 * - Execute commands on any server via terminal
 * - Plan, execute, and verify multi-step tasks with AI
 * 
 * Usage:
 *   node operator.mjs "your task here"           — Run a task (CLI mode)
 *   node operator.mjs --server                   — Start API server
 *   node operator.mjs --server --port=3000       — Server on custom port
 *   node operator.mjs --action browser_goto --url=https://google.com
 *   node operator.mjs --list                     — Show task history
 *   node operator.mjs --view=<id>                — View task details
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment
const envPath = path.join(__dirname, 'config', '.env');
if (fs.existsSync(envPath)) dotenv.config({ path: envPath });
else dotenv.config();

// ─── Parse Arguments ───────────────────────────────────────────────────────────

function parseArgs() {
  const raw = process.argv.slice(2);
  const flags = {};
  const positional = [];

  for (const arg of raw) {
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq > 0) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else {
        flags[arg.slice(2)] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { flags, task: positional.join(' ') };
}

// ─── Server Mode ───────────────────────────────────────────────────────────────

async function startServer(flags) {
  const { createServer } = await import('./operator/server/api.mjs');
  const server = createServer({
    port: parseInt(flags.port) || 3000,
    host: flags.host || '0.0.0.0',
    apiKey: flags.key || process.env.OPERATOR_API_KEY,
    verbose: flags.verbose || flags.dev,
    headless: flags.headless !== false,
    autoConfirm: flags['auto-confirm'],
    basePath: __dirname
  });

  await server.start();

  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down Operator Pro...');
    await server.stop();
    process.exit(0);
  });
}

// ─── CLI Mode (Task Execution) ─────────────────────────────────────────────────

async function runCLITask(task, flags) {
  const { getOrchestrator } = await import('./operator/core/orchestrator.mjs');

  const orchestrator = getOrchestrator({
    verbose: flags.verbose || flags.debug,
    headless: flags.headless !== false,
    basePath: __dirname
  });

  await orchestrator.init();

  // Set up progress display
  orchestrator.on('task:start', (e) => {
    console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
    console.log(`║              🤖 OPERATOR PRO — Task Running                 ║`);
    console.log(`╚══════════════════════════════════════════════════════════════╝`);
    console.log(`  🎯 Task: ${task}`);
    console.log(`  🆔 ID: ${e.taskId}`);
    console.log('');
  });

  orchestrator.on('task:phase', (e) => {
    console.log(`  📋 Phase: ${e.phase}`);
  });

  orchestrator.on('task:plan', (e) => {
    if (e.plan) {
      console.log(`  📋 Plan: ${e.plan.goal}`);
      console.log(`     Steps: ${e.plan.total_steps || e.plan.steps?.length}`);
      e.plan.steps?.forEach(s => console.log(`       ${s.step}. ${s.goal}`));
      console.log('');
    }
  });

  orchestrator.on('step:start', (e) => {
    console.log(`  ── Step ${e.step}/${e.maxSteps} ──`);
  });

  orchestrator.on('step:decision', (e) => {
    console.log(`  🤔 ${e.thought}`);
    console.log(`  🎬 ${e.action?.type} ${JSON.stringify(e.action?.params || {})}`);
    if (e.backend) console.log(`  🧠 Backend: ${e.backend}`);
  });

  orchestrator.on('step:result', (e) => {
    console.log(`  📊 ${e.ok ? '✅' : '❌'} (${e.duration || 0}ms)${e.error ? ` — ${e.error}` : ''}`);
  });

  orchestrator.on('step:stuck', (e) => {
    console.log(`  ⚠️  Stuck (attempt ${e.count}) — changing strategy`);
  });

  orchestrator.on('step:dangerous', (e) => {
    console.log(`  🚨 DANGEROUS ACTION: ${e.action?.type}`);
    if (!orchestrator.autoConfirm) {
      console.log('     ⏳ Waiting for confirmation... (auto-confirm with --auto-confirm)');
    }
  });

  orchestrator.on('task:complete', (e) => {
    console.log(`\n  ✅ Task completed: ${e.reason || 'done'}`);
    console.log(`  📊 Steps: ${e.steps}`);
  });

  orchestrator.on('task:error', (e) => {
    console.log(`\n  ❌ Task failed: ${e.error}`);
  });

  // Run task
  const result = await orchestrator.runTask(task, {
    brain: flags.brain || 'auto',
    docs: flags.docs,
    maxSteps: parseInt(flags.steps) || 50,
    groqKey: flags.groq || process.env.GROQ_API_KEY
  });

  await orchestrator.shutdown();

  // Update context.json
  try {
    const ctxFile = path.join(__dirname, 'context.json');
    const ctx = fs.existsSync(ctxFile) ? JSON.parse(fs.readFileSync(ctxFile, 'utf8')) : { sessions: [] };
    ctx.lastUsed = new Date().toISOString();
    ctx.sessions.push({ timestamp: ctx.lastUsed, task: task.substring(0, 100), status: result.ok ? 'completed' : 'failed' });
    fs.writeFileSync(ctxFile, JSON.stringify(ctx, null, 2));
  } catch {}

  return result;
}

// ─── Direct Action Execution ───────────────────────────────────────────────────

async function executeDirectAction(flags) {
  const { getOrchestrator } = await import('./operator/core/orchestrator.mjs');

  const orchestrator = getOrchestrator({ verbose: flags.verbose, basePath: __dirname });
  await orchestrator.init();

  const action = { type: flags.action, params: {} };

  // Build params from flags
  for (const [k, v] of Object.entries(flags)) {
    if (!['action', 'verbose', 'debug', 'headless'].includes(k)) {
      action.params[k] = v;
    }
  }

  const result = await orchestrator.executeAction(action);
  console.log(JSON.stringify(result, null, 2));
  await orchestrator.shutdown();
  return result;
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { flags, task } = parseArgs();

  // Server mode
  if (flags.server) {
    await startServer(flags);
    return;
  }

  // List tasks
  if (flags.list) {
    const { Memory } = await import('./operator/memory.mjs');
    const tasks = Memory.listTasks();
    if (!tasks.length) { console.log('  No previous tasks.'); return; }
    console.log(`\n  📋 TASK HISTORY (${tasks.length}):\n`);
    tasks.forEach(t => console.log(
      `  ${t.status === 'completed' ? '✅' : '❌'} [${t.id}] ${t.task} — ${t.steps} steps — ${new Date(t.created).toLocaleString()}`
    ));
    return;
  }

  // View task
  if (flags.view) {
    const { Memory } = await import('./operator/memory.mjs');
    const mem = new Memory(flags.view);
    if (!mem.data.steps.length) { console.log('  Task not found.'); return; }
    const d = mem.data;
    console.log(`\n  📋 ${d.task}`);
    console.log(`  Status: ${d.status} | Steps: ${d.steps.length} | Created: ${new Date(d.created).toLocaleString()}`);
    if (d.completedAt) console.log(`  Completed: ${new Date(d.completedAt).toLocaleString()}`);
    if (d.reason) console.log(`  Reason: ${d.reason}`);
    d.steps.forEach(s => console.log(
      `\n  [${s.step}] 🤔 ${s.thought}\n        🎬 ${s.action?.type} ${JSON.stringify(s.action?.params || {})}\n        📊 ${s.result?.ok ? '✅' : '❌'} (${s.result?.duration || '?'}ms)`
    ));
    return;
  }

  // Direct action execution
  if (flags.action) {
    await executeDirectAction(flags);
    return;
  }

  // Help
  if (flags.help || (!task && !flags.server)) {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                    🤖 OPERATOR PRO v3.0                     ║
║          Autonomous AI Agent — Web, Desktop & Server        ║
╚══════════════════════════════════════════════════════════════╝

  USAGE:
    node operator.mjs "your task"                  Run a task autonomously
    node operator.mjs --server                     Start API server
    node operator.mjs --server --port=8080         Server on port 8080
    node operator.mjs --action=<type> --<param>    Execute a single action
    node operator.mjs --list                       Show task history
    node operator.mjs --view=<id>                  View task details

  FLAGS:
    --server                 Start in API server mode
    --port=<n>               Server port (default: 3000)
    --key=<apikey>           API key for authentication
    --brain=<backend>        Force AI backend (groq, copilot, openai, etc.)
    --docs=<path|url>        Load documentation before acting
    --steps=<n>              Max steps (default: 50)
    --verbose                Verbose output
    --auto-confirm           Auto-confirm dangerous actions
    --headless               Run browser headless (default: true)
    --action=<type>          Execute single action directly

  EXAMPLES:
    node operator.mjs "open google and search for AI agents"
    node operator.mjs "create a Python script that scrapes product prices"
    node operator.mjs --server --key=my-secret-key
    node operator.mjs --action=browser_goto --url=https://google.com
    node operator.mjs --action=terminal_exec --command="ls -la"
    node operator.mjs --action=screenshot
    `);
    return;
  }

  // Run task
  await runCLITask(task, flags);
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});

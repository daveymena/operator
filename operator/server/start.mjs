#!/usr/bin/env node

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║                🤖 OPERATOR PRO v4.0                         ║
 * ║     Autonomous AI Agent — Web, Desktop & Server             ║
 * ║                                                              ║
 * ║     NEW: AI Gateway, Auth, Watch Mode, Scheduler,           ║
 * ║          Deep Research, Full Dashboard                       ║
 * ║                                                              ║
 * ║     Providers: OpenCode Zen (primary) + GMI Cloud           ║
 * ║                 + 21 additional providers                    ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Usage:
 *   node operator.mjs                              — Show help
 *   node operator.mjs "your task"                  — Run task (CLI)
 *   node operator.mjs --server                     — Start API + Dashboard
 *   node operator.mjs --server --port=3000         — Custom port
 *   node operator.mjs --action=browser_goto --url=...
 *   node operator.mjs --list                       — Task history
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

// ─── Show Banner ────────────────────────────────────────────────────────────────

function showBanner() {
  console.log(`
╔══════════════════════════════════════════════════════════════╗
║                🤖 OPERATOR PRO v4.0                         ║
║          Autonomous AI Agent — Web, Desktop & Server        ║
╚══════════════════════════════════════════════════════════════╝

  🧠 AI Gateway    — OpenCode Zen (primary) + GMI Cloud + 21 providers
  🔐 Auth System   — JWT, API keys, role-based access
  🛡️  Watch Mode    — Safety for financial, social, admin sites
  ⏰ Scheduler     — Cron-like recurring tasks
  🔍 Deep Research — Multi-step web research with citations
  🌐 Dashboard     — Full web UI at /dashboard

  Usage:
    node operator.mjs "your task"              — Run task (CLI)
    node operator.mjs --server                 — Start API + Dashboard
    node operator.mjs --server --port=3000     — Custom port
    node operator.mjs --list                   — Show task history
    node operator.mjs --models                 — List available AI models
    node operator.mjs --gateway-status         — Show gateway status
`);
}

// ─── Server Mode ───────────────────────────────────────────────────────────────

async function startServer(flags) {
  const { createServer } = await import('./operator/server/api-v4.mjs');

  const server = createServer({
    port: parseInt(flags.port) || 3000,
    host: flags.host || '0.0.0.0',
    apiKey: flags.key || process.env.OPERATOR_API_KEY,
    verbose: flags.verbose || flags.dev,
    watchMode: flags['watch-mode'],
    autoConfirm: flags['auto-confirm'],
    headless: flags.headless !== false,
    dashboardPath: path.join(__dirname, 'dashboard')
  });

  // Initialize async components (DB, Gateway, TokenManager)
  await server.init();

  await server.start();

  // Initialize orchestrator for task execution
  try {
    const { getOrchestrator } = await import('./operator/core/orchestrator.mjs');
    const orchestrator = getOrchestrator({
      verbose: flags.verbose || flags.debug,
      headless: flags.headless !== false,
      basePath: __dirname
    });
    await orchestrator.init();
    server.setOrchestrator(orchestrator);
    console.log('  ✅ Orchestrator initialized');
  } catch (e) {
    console.log('  ⚠️  Orchestrator not available:', e.message);
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down Operator Pro v4.0...');
    await server.stop();
    process.exit(0);
  });
}

// ─── CLI Mode ──────────────────────────────────────────────────────────────────

async function runCLITask(task, flags) {
  const { getOrchestrator } = await import('./operator/core/orchestrator.mjs');

  const orchestrator = getOrchestrator({
    verbose: flags.verbose || flags.debug,
    headless: flags.headless !== false,
    basePath: __dirname
  });

  await orchestrator.init();

  console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║          🤖 OPERATOR PRO v4.0 — Task Running                ║`);
  console.log(`╚══════════════════════════════════════════════════════════════╝`);
  console.log(`  🎯 Task: ${task}`);
  console.log('');

  try {
    const result = await orchestrator.runTask(task, {
      brain: flags.brain || 'auto',
      maxSteps: parseInt(flags['max-steps']) || 50
    });

    if (result.ok) {
      console.log(`\n  ✅ Task completed!`);
      console.log(`  📊 Steps: ${result.steps || '?'}`);
      console.log(`  📝 Result: ${result.reason || 'done'}`);
    } else {
      console.log(`\n  ❌ Task failed: ${result.error || result.reason || 'unknown'}`);
    }
  } catch (e) {
    console.log(`\n  ❌ Error: ${e.message}`);
  }

  process.exit(0);
}

// ─── Show Gateway Status ───────────────────────────────────────────────────────

async function showGatewayStatus() {
  const { getGateway } = await import('./operator/gateway/index.mjs');
  const gateway = getGateway();

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║          🧠 AI Gateway Status                               ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const status = gateway.getStatus();
  for (const [id, info] of Object.entries(status.providers)) {
    const health = info.status || 'unknown';
    const icon = { healthy: '✅', degraded: '⚠️', rate_limited: '🚫', auth_error: '🔑', unknown: '❓' }[health] || '❓';
    console.log(`  ${icon} ${info.name || id}`);
    console.log(`    Status: ${health} | Keys: ${info.keys} | Requests: ${info.totalRequests || 0}`);
    if (info.avgLatency) console.log(`    Avg Latency: ${Math.round(info.avgLatency)}ms | Success: ${((info.successRate || 0) * 100).toFixed(0)}%`);
    console.log('');
  }

  console.log(`  💰 Estimated total cost: ${status.usage?.totals?.estimatedCost || '$0.00'}`);
}

// ─── Show Available Models ─────────────────────────────────────────────────────

async function showModels() {
  const { getGateway } = await import('./operator/gateway/index.mjs');
  const gateway = getGateway();

  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║          📋 Available AI Models                             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const models = gateway.listModels();
  const byProvider = {};
  for (const m of models) {
    if (!byProvider[m.providerName]) byProvider[m.providerName] = [];
    byProvider[m.providerName].push(m);
  }

  for (const [provider, providerModels] of Object.entries(byProvider)) {
    console.log(`  📡 ${provider}:`);
    for (const m of providerModels) {
      const available = m.available ? '✅' : '❌';
      console.log(`    ${available} ${m.id}`);
    }
    console.log('');
  }

  console.log(`  Total: ${models.length} models across ${Object.keys(byProvider).length} providers`);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { flags, task } = parseArgs();

  // Help
  if (flags.help || flags.h) {
    showBanner();
    return;
  }

  // Show models
  if (flags.models) {
    await showModels();
    return;
  }

  // Show gateway status
  if (flags['gateway-status']) {
    await showGatewayStatus();
    return;
  }

  // Server mode
  if (flags.server) {
    await startServer(flags);
    return;
  }

  // CLI task mode
  if (task) {
    await runCLITask(task, flags);
    return;
  }

  // Default: show banner
  showBanner();
}

main().catch(console.error);

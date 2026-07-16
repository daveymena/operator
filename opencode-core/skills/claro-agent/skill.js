// ============================================================
// Skill: Claro Agent
// Integra el agente de órdenes de Claro dentro de OpenCode Evolved.
// Asume que el proyecto original está montado en SKILL_SRC_DIR.
// ============================================================

import { spawn, exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';

const SKILL_DIR = path.dirname(new URL(import.meta.url).pathname);
const SKILL_SRC_DIR = process.env.CLARO_SKILL_SRC || path.join(SKILL_DIR, 'src');
const SKILL_DATA_DIR = process.env.CLARO_SKILL_DATA || path.join(process.cwd(), 'skills-data', 'claro-agent');
const PYTHON = process.env.CLARO_PYTHON || 'python3';

fs.mkdirSync(SKILL_DATA_DIR, { recursive: true });

function log(...args) {
  console.log('[claro-skill]', ...args);
}

function runScript(scriptName, args = [], cwd = SKILL_SRC_DIR, env = {}) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(cwd, scriptName);
    if (!fs.existsSync(scriptPath)) {
      return reject(new Error(`Script no encontrado: ${scriptPath}`));
    }
    const child = spawn(PYTHON, [scriptPath, ...args], {
      cwd,
      env: { ...process.env, ...env, CLARO_SKILL_DATA: SKILL_DATA_DIR },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); log('stdout:', d.toString().trim()); });
    child.stderr.on('data', (d) => { stderr += d.toString(); log('stderr:', d.toString().trim()); });
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(stderr || `Exit code ${code}`));
      else resolve(stdout.trim());
    });
    child.on('error', reject);
  });
}

function runNodeScript(scriptName, args = [], cwd = SKILL_SRC_DIR, env = {}) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(cwd, scriptName);
    if (!fs.existsSync(scriptPath)) {
      return reject(new Error(`Script no encontrado: ${scriptPath}`));
    }
    const child = spawn('node', [scriptPath, ...args], {
      cwd,
      env: { ...process.env, ...env, CLARO_SKILL_DATA: SKILL_DATA_DIR },
      stdio: ['ignore', 'pipe', 'pipe']
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); log('stdout:', d.toString().trim()); });
    child.stderr.on('data', (d) => { stderr += d.toString(); log('stderr:', d.toString().trim()); });
    child.on('close', (code) => {
      if (code !== 0) reject(new Error(stderr || `Exit code ${code}`));
      else resolve(stdout.trim());
    });
    child.on('error', reject);
  });
}

export async function processOrder(orderText, options = {}) {
  if (!orderText) throw new Error('Se requiere el texto de la orden');
  if (!fs.existsSync(SKILL_SRC_DIR)) {
    throw new Error(`Proyecto claro_agente_final no montado en ${SKILL_SRC_DIR}`);
  }

  const env = buildEnv(options);

  // 1. Procesar texto de orden
  await runScript('hermes_pipeline.py', ['--orden', orderText], SKILL_SRC_DIR, env);

  // 2. Ejecutar envío de pendientes
  await runNodeScript('fill_orders_final.js', [], SKILL_SRC_DIR, env);

  // 3. Verificar envíos
  let verification = null;
  try {
    await runScript('verify_sent.py', [], SKILL_SRC_DIR, env);
    verification = 'checked';
  } catch {}

  return {
    success: true,
    message: 'Orden procesada y enviada',
    dataDir: SKILL_DATA_DIR,
    verification
  };
}

export async function runPending(options = {}) {
  if (!fs.existsSync(SKILL_SRC_DIR)) {
    throw new Error(`Proyecto claro_agente_final no montado en ${SKILL_SRC_DIR}`);
  }
  const env = buildEnv(options);
  await runScript('hermes_pipeline.py', ['--run-pending'], SKILL_SRC_DIR, env);
  return { success: true, message: 'Pendientes ejecutados' };
}

export function getStatus() {
  return {
    skillSrc: SKILL_SRC_DIR,
    dataDir: SKILL_DATA_DIR,
    mounted: fs.existsSync(SKILL_SRC_DIR),
    projectFiles: fs.existsSync(path.join(SKILL_SRC_DIR, 'hermes_pipeline.py')) && fs.existsSync(path.join(SKILL_SRC_DIR, 'fill_orders_final.js'))
  };
}

function buildEnv(options) {
  // Variables que el proyecto original debería respetar si se adapta,
  // o que el wrapper inyecta en el entorno para futuras adaptaciones.
  return {
    CLARO_FORM_URL: options.formUrl || process.env.CLARO_FORM_URL || '',
    GOOGLE_EMAIL: options.googleEmail || process.env.GOOGLE_EMAIL || '',
    GOOGLE_PASSWORD: options.googlePassword || process.env.GOOGLE_PASSWORD || '',
    GOOGLE_IMAP_PASSWORD: options.googleImapPassword || process.env.GOOGLE_IMAP_PASSWORD || '',
    TECH_CEDULA: options.techCedula || process.env.TECH_CEDULA || '',
    TECH_NOMBRE: options.techNombre || process.env.TECH_NOMBRE || '',
    TECH_TELEFONO: options.techTelefono || process.env.TECH_TELEFONO || '',
    TECH_CIUDAD: options.techCiudad || process.env.TECH_CIUDAD || '',
    FREEMODEL_API_KEY: options.freemodelKey || process.env.FREEMODEL_API_KEY || '',
    GROQ_API_KEY: options.groqKey || process.env.GROQ_API_KEY || '',
    OLLAMA_HOST: options.ollamaHost || process.env.OLLAMA_HOST || '',
    PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    CHROME_BIN: process.env.CHROME_BIN || '/usr/bin/chromium',
    CLARO_HEADLESS: 'true',
    CLARO_SKILL_DATA: SKILL_DATA_DIR,
    PYTHONIOENCODING: 'utf-8'
  };
}

// CLI mode
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const orderText = process.argv.slice(2).join(' ');
  if (!orderText) {
    console.log('Uso: node skill.js "texto de la orden"');
    console.log('Status:', getStatus());
    process.exit(1);
  }
  processOrder(orderText).then(console.log).catch(err => { console.error(err.message); process.exit(1); });
}

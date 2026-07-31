// ============================================================
// Skill: Claro Agent
// Envía órdenes de trabajo de Claro FTTH al Google Form.
// Los scripts viven en SKILL_SRC_DIR (src/ o esta misma carpeta).
// Los datos (órdenes, reportes, captchas) viven en SKILL_DATA_DIR
// para que persistan en EasyPanel.
// ============================================================

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';

const SKILL_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_SRC_DIR = process.env.CLARO_SKILL_SRC || SKILL_DIR;
const SKILL_DATA_DIR = process.env.CLARO_SKILL_DATA || path.join(process.cwd(), 'skills-data', 'claro-agent');
const NODE = process.env.CLARO_NODE || 'node';

fs.mkdirSync(SKILL_DATA_DIR, { recursive: true });

function log(...args) {
  console.log('[claro-skill]', ...args);
}

function runNodeScript(scriptName, args = [], cwd = SKILL_SRC_DIR, env = {}) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(cwd, scriptName);
    if (!fs.existsSync(scriptPath)) {
      return reject(new Error(`Script no encontrado: ${scriptPath}`));
    }
    const child = spawn(NODE, [scriptPath, ...args], {
      cwd,
      env: {
        ...process.env,
        ...env,
        CLARO_SKILL_DATA: SKILL_DATA_DIR,
        CLARO_DATA_DIR: SKILL_DATA_DIR,
        PYTHONIOENCODING: 'utf-8'
      },
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

/**
 * Envía todas las órdenes pendientes (las marcadas como no enviadas
 * en ordenes_procesadas.json).
 * options.pendingJson: ruta opcional a un JSON con órdenes nuevas para
 *   fusionar antes de enviar (formato: array de objetos de orden).
 */
export async function sendPending(options = {}) {
  const dataFile = path.join(SKILL_DATA_DIR, 'ordenes_procesadas.json');
  if (!fs.existsSync(dataFile)) {
    throw new Error(`No existe ${dataFile}. Usa addOrders() primero o sube el JSON al volumen ${SKILL_DATA_DIR}.`);
  }

  if (options.pendingJson && fs.existsSync(options.pendingJson)) {
    const newOrders = JSON.parse(fs.readFileSync(options.pendingJson, 'utf8'));
    const existing = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    const byOt = new Map(existing.map(o => [String(o.ot), o]));
    for (const o of newOrders) {
      o.enviado = false;
      o.status = 'pending';
      byOt.set(String(o.ot), o);
    }
    fs.writeFileSync(dataFile, JSON.stringify([...byOt.values()], null, 2), 'utf8');
    log(`Fusionadas ${newOrders.length} órdenes nuevas (total ${byOt.size})`);
  }

  const env = buildEnv(options);
  await runNodeScript('fill_orders_final.js', options.test ? ['--test'] : [], SKILL_SRC_DIR, env);

  const report = path.join(SKILL_DATA_DIR, 'reporte_diario.txt');
  const reportText = fs.existsSync(report) ? fs.readFileSync(report, 'utf8') : '(sin reporte)';
  const processed = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  const pendientes = processed.filter(o => !o.enviado);

  return {
    success: true,
    message: 'Órdenes procesadas',
    dataDir: SKILL_DATA_DIR,
    total: processed.length,
    enviadas: processed.length - pendientes.length,
    pendientes: pendientes.length,
    reporte: reportText
  };
}

/**
 * Estado del skill: montado, datos, cuántas órdenes hay.
 */
export function getStatus() {
  const dataFile = path.join(SKILL_DATA_DIR, 'ordenes_procesadas.json');
  let stats = { exists: false };
  if (fs.existsSync(dataFile)) {
    try {
      const orders = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
      stats = {
        exists: true,
        total: orders.length,
        enviadas: orders.filter(o => o.enviado).length,
        pendientes: orders.filter(o => !o.enviado).length
      };
    } catch (e) {
      stats = { exists: true, error: e.message };
    }
  }
  return {
    skillSrc: SKILL_SRC_DIR,
    dataDir: SKILL_DATA_DIR,
    scriptsOk: fs.existsSync(path.join(SKILL_SRC_DIR, 'fill_orders_final.js')) && fs.existsSync(path.join(SKILL_SRC_DIR, 'captcha_solver_final.js')),
    data: stats
  };
}

/**
 * Lee el reporte diario actual.
 */
export function getReport() {
  const report = path.join(SKILL_DATA_DIR, 'reporte_diario.txt');
  return fs.existsSync(report) ? fs.readFileSync(report, 'utf8') : '(sin reporte todavía)';
}

function buildEnv(options) {
  return {
    CLARO_EMAIL: options.googleEmail || process.env.CLARO_EMAIL || '',
    CLARO_PASSWORD: options.googlePassword || process.env.CLARO_PASSWORD || '',
    CLARO_FORM_URL: options.formUrl || process.env.CLARO_FORM_URL || '',
    TECH_CEDULA: options.techCedula || process.env.TECH_CEDULA || '',
    TECH_NOMBRE: options.techNombre || process.env.TECH_NOMBRE || '',
    TECH_TELEFONO: options.techTelefono || process.env.TECH_TELEFONO || '',
    TECH_CIUDAD: options.techCiudad || process.env.TECH_CIUDAD || '',
    GROQ_API_KEY: options.groqKey || process.env.GROQ_API_KEY || '',
    OPENCODE_ZEN_API_KEY: options.zenKey || process.env.OPENCODE_ZEN_API_KEY || '',
    EMAIL_USER: options.emailUser || process.env.EMAIL_USER || '',
    EMAIL_PASS: options.emailPass || process.env.EMAIL_PASS || '',
    PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
    CHROME_BIN: process.env.CHROME_BIN || '/usr/bin/chromium',
    CLARO_HEADLESS: process.env.CLARO_HEADLESS || 'true'
  };
}

// CLI mode
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const cmd = process.argv[2] || 'status';
  if (cmd === 'status') {
    console.log(JSON.stringify(getStatus(), null, 2));
  } else if (cmd === 'send') {
    sendPending().then(r => console.log(JSON.stringify(r, null, 2))).catch(err => { console.error(err.message); process.exit(1); });
  } else if (cmd === 'report') {
    console.log(getReport());
  } else {
    console.log('Uso: node skill.js [status|send|report]');
  }
}

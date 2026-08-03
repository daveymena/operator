#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  Operator Pro — PostgreSQL Persistence Sync                  ║
 * ║  Guarda toda la información del contenedor en PostgreSQL     ║
 * ║  para que el volumen pueda eliminarse y todo se recupere.    ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * El contenedor es EFÍMERO: no depende de volúmenes. Al arrancar
 * restaura los datos desde PostgreSQL y periódicamente/al cerrar
 * sube los datos de vuelta.
 *
 * Archivos sincronizados:
 *   - data/operator.db          (SQLite operator: tasks, tokens, config)
 *   - operator/memory/*.json    (memoria de tareas)
 *   - operator/knowledge/*.md   (conocimiento persistido)
 *   - ~/.local/share/opencode/* (sesiones/chats de opencode-ai)
 *
 * Uso:
 *   node operator/pg-sync.mjs restore   → baja todo desde PostgreSQL
 *   node operator/pg-sync.mjs backup    → sube todo a PostgreSQL
 *   node operator/pg-sync.mjs watch     → backup cada N segundos
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const DATABASE_URL = process.env.DATABASE_URL || '';
const PREFIX = process.env.PG_SYNC_PREFIX || 'operato';
const INTERVAL_MS = parseInt(process.env.PG_SYNC_INTERVAL || '60', 10) * 1000;

// Rutas que se sincronizan (relativas a ROOT o a HOME)
function collectPaths() {
  const paths = [];

  const db = path.join(ROOT, 'data', 'operator.db');
  if (fs.existsSync(db)) paths.push(db);

  const memoryDir = path.join(ROOT, 'operator', 'memory');
  if (fs.existsSync(memoryDir)) {
    for (const f of fs.readdirSync(memoryDir)) {
      if (f.endsWith('.json')) paths.push(path.join(memoryDir, f));
    }
  }

  const knowledgeDir = path.join(ROOT, 'operator', 'knowledge');
  if (fs.existsSync(knowledgeDir)) {
    for (const f of fs.readdirSync(knowledgeDir)) {
      if (f.endsWith('.md')) paths.push(path.join(knowledgeDir, f));
    }
  }

  // opencode-ai guarda en $HOME/.local/share/opencode/ (Linux)
  const home = process.env.HOME || '/root';
  const ocDir = path.join(home, '.local', 'share', 'opencode');
  if (fs.existsSync(ocDir)) {
    for (const f of fs.readdirSync(ocDir)) {
      if (f.endsWith('.db') || f.endsWith('.json')) paths.push(path.join(ocDir, f));
    }
  }

  return paths;
}

function relKey(filepath) {
  if (filepath.startsWith(ROOT + path.sep)) {
    return PREFIX + ':' + filepath.slice(ROOT.length + 1).replace(/\\/g, '/');
  }
  const home = process.env.HOME || '/root';
  if (filepath.startsWith(home + path.sep)) {
    return PREFIX + ':home:' + filepath.slice(home.length + 1).replace(/\\/g, '/');
  }
  return PREFIX + ':' + filepath.replace(/\\/g, '/');
}

async function withClient(fn) {
  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: DATABASE_URL, ssl: false });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function ensureTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS app_blobs (
      key TEXT PRIMARY KEY,
      data BYTEA NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
}

export async function restore() {
  if (!DATABASE_URL) { console.log('[pg-sync] DATABASE_URL no definido, saltando restore'); return 0; }
  let restored = 0;
  await withClient(async (client) => {
    await ensureTable(client);
    const res = await client.query('SELECT key, data FROM app_blobs');
    for (const row of res.rows) {
      const full = keyToPath(row.key);
      if (!full) continue;
      try {
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, Buffer.isBuffer(row.data) ? row.data : Buffer.from(row.data));
        restored++;
        console.log(`[pg-sync] restaurado: ${row.key} → ${full}`);
      } catch (e) {
        console.error(`[pg-sync] error restaurando ${row.key}: ${e.message}`);
      }
    }
  });
  console.log(`[pg-sync] restore completado (${restored} archivos)`);
  return restored;
}

function keyToPath(key) {
  if (!key.startsWith(PREFIX + ':')) return null;
  const rest = key.slice(PREFIX.length + 1);
  if (rest.startsWith('home:')) {
    const home = process.env.HOME || '/root';
    return path.join(home, rest.slice(5));
  }
  return path.join(ROOT, rest);
}

export async function backup() {
  if (!DATABASE_URL) { console.log('[pg-sync] DATABASE_URL no definido, saltando backup'); return 0; }
  let uploaded = 0;
  await withClient(async (client) => {
    await ensureTable(client);
    const files = collectPaths();
    for (const filepath of files) {
      try {
        const data = fs.readFileSync(filepath);
        const key = relKey(filepath);
        await client.query(
          `INSERT INTO app_blobs (key, data, updated_at) VALUES ($1, $2, NOW())
           ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()`,
          [key, data]
        );
        uploaded++;
      } catch (e) {
        console.error(`[pg-sync] error subiendo ${filepath}: ${e.message}`);
      }
    }
  });
  console.log(`[pg-sync] backup completado (${uploaded} archivos)`);
  return uploaded;
}

async function watch() {
  if (!DATABASE_URL) {
    console.log('[pg-sync] DATABASE_URL no definido, watch desactivado');
    return;
  }
  console.log(`[pg-sync] watch activo, backup cada ${INTERVAL_MS / 1000}s`);
  const loop = async () => {
    try { await backup(); }
    catch (e) { console.error('[pg-sync] watch error:', e.message); }
    setTimeout(loop, INTERVAL_MS);
  };
  loop();
}

// CLI
const mode = process.argv[2] || 'backup';
if (mode === 'restore') {
  restore().then((n) => process.exit(n >= 0 ? 0 : 1)).catch((e) => { console.error(e); process.exit(1); });
} else if (mode === 'backup') {
  backup().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
} else if (mode === 'watch') {
  watch();
} else {
  console.log('Uso: node operator/pg-sync.mjs {restore|backup|watch}');
}

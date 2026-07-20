/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║          🗄️ Database Layer — SQLite (sql.js)                ║
 * ║   Persistent storage for tasks, users, usage, tokens,      ║
 * ║   scheduler, audit log — all in one SQLite file            ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Tables:
 *   - tasks         → Task execution history
 *   - users         → User accounts & API keys
 *   - usage         → Token usage per provider/model
 *   - tokens        → API keys with metadata & rotation
 *   - scheduler     → Scheduled jobs
 *   - audit         → Safety audit log
 *   - research      → Deep research results
 *   - config        → Key-value configuration store
 */

import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DB_PATH = path.join(__dirname, '..', '..', 'data', 'operator.db');

let _db = null;

export class Database {
  constructor(dbPath = DEFAULT_DB_PATH) {
    this.dbPath = dbPath;
    this.db = null;
    this.ready = false;
  }

  async init() {
    if (this.ready) return;

    // Ensure data directory exists
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    // Initialize sql.js
    const SQL = await initSqlJs();

    // Load existing database or create new
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new SQL.Database(buffer);
    } else {
      this.db = new SQL.Database();
    }

    // Create tables
    this._createTables();

    // Save to disk
    this._save();

    this.ready = true;
    console.log(`[DB] SQLite database ready: ${this.dbPath}`);
    return this;
  }

  _createTables() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        task TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        result TEXT,
        provider TEXT,
        model TEXT,
        brain TEXT,
        steps INTEGER DEFAULT 0,
        max_steps INTEGER DEFAULT 50,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        started_at DATETIME,
        completed_at DATETIME,
        duration_ms INTEGER,
        error TEXT,
        options TEXT,
        user_id TEXT
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        role TEXT DEFAULT 'user',
        api_key TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        prompt_tokens INTEGER DEFAULT 0,
        completion_tokens INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        estimated_cost REAL DEFAULT 0,
        duration_ms INTEGER DEFAULT 0,
        success INTEGER DEFAULT 1,
        error TEXT,
        api_key_hash TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider TEXT NOT NULL,
        api_key TEXT NOT NULL,
        key_label TEXT,
        is_active INTEGER DEFAULT 1,
        is_primary INTEGER DEFAULT 0,
        daily_limit INTEGER,
        daily_used INTEGER DEFAULT 0,
        daily_reset DATE,
        total_used INTEGER DEFAULT 0,
        total_cost REAL DEFAULT 0,
        status TEXT DEFAULT 'active',
        last_used DATETIME,
        last_error TEXT,
        expires_at DATETIME,
        auto_rotate INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS scheduler (
        id TEXT PRIMARY KEY,
        name TEXT,
        task TEXT NOT NULL,
        cron TEXT,
        interval_ms INTEGER,
        options TEXT,
        enabled INTEGER DEFAULT 1,
        retry_count INTEGER DEFAULT 2,
        retry_delay_ms INTEGER DEFAULT 60000,
        notify_url TEXT,
        run_count INTEGER DEFAULT 0,
        last_run DATETIME,
        next_run DATETIME,
        last_result TEXT,
        status TEXT DEFAULT 'scheduled',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        action_type TEXT,
        action_params TEXT,
        level TEXT DEFAULT 'none',
        reason TEXT,
        blocked INTEGER DEFAULT 0,
        url TEXT,
        category TEXT,
        user_id TEXT,
        task_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS research (
        id TEXT PRIMARY KEY,
        query TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        depth INTEGER DEFAULT 2,
        language TEXT DEFAULT 'es',
        report TEXT,
        summary TEXT,
        sources TEXT,
        citations TEXT,
        confidence REAL,
        searches_performed INTEGER DEFAULT 0,
        duration_ms INTEGER,
        model TEXT,
        provider TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME
      );
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Indexes for performance
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_usage_provider ON usage(provider);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_usage_created ON usage(created_at);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_tokens_provider ON tokens(provider);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_tokens_active ON tokens(is_active);`);
    this.db.run(`CREATE INDEX IF NOT EXISTS idx_audit_created ON audit(created_at);`);
  }

  // ─── Generic Query Helpers ─────────────────────────────────────────────

  run(sql, params = []) {
    try {
      this.db.run(sql, params);
      this._scheduleSave();
      return { ok: true };
    } catch (e) {
      console.error(`[DB] run error:`, e.message, sql);
      return { ok: false, error: e.message };
    }
  }

  get(sql, params = []) {
    try {
      const stmt = this.db.prepare(sql);
      stmt.bind(params);
      if (stmt.step()) {
        const row = stmt.getAsObject();
        stmt.free();
        return row;
      }
      stmt.free();
      return null;
    } catch (e) {
      console.error(`[DB] get error:`, e.message, sql);
      return null;
    }
  }

  all(sql, params = []) {
    try {
      const results = [];
      const stmt = this.db.prepare(sql);
      stmt.bind(params);
      while (stmt.step()) {
        results.push(stmt.getAsObject());
      }
      stmt.free();
      return results;
    } catch (e) {
      console.error(`[DB] all error:`, e.message, sql);
      return [];
    }
  }

  // ─── Task Operations ───────────────────────────────────────────────────

  createTask(taskData) {
    const { id, task, status = 'pending', brain = 'auto', user_id = null, options = null } = taskData;
    return this.run(
      `INSERT INTO tasks (id, task, status, brain, user_id, options) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, task, status, brain, user_id, options ? JSON.stringify(options) : null]
    );
  }

  updateTask(id, updates) {
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(updates)) {
      if (['status', 'result', 'provider', 'model', 'steps', 'started_at', 'completed_at', 'duration_ms', 'error'].includes(key)) {
        fields.push(`${key} = ?`);
        values.push(typeof value === 'object' ? JSON.stringify(value) : value);
      }
    }
    if (fields.length === 0) return { ok: false, error: 'No valid fields' };
    values.push(id);
    return this.run(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`, values);
  }

  getTask(id) {
    return this.get(`SELECT * FROM tasks WHERE id = ?`, [id]);
  }

  getTasks(limit = 50, status = null) {
    if (status) {
      return this.all(`SELECT * FROM tasks WHERE status = ? ORDER BY created_at DESC LIMIT ?`, [status, limit]);
    }
    return this.all(`SELECT * FROM tasks ORDER BY created_at DESC LIMIT ?`, [limit]);
  }

  // ─── Token Operations ──────────────────────────────────────────────────

  addToken(provider, apiKey, label = '', isPrimary = false) {
    return this.run(
      `INSERT INTO tokens (provider, api_key, key_label, is_primary) VALUES (?, ?, ?, ?)`,
      [provider, apiKey, label, isPrimary ? 1 : 0]
    );
  }

  getActiveTokens(provider = null) {
    if (provider) {
      return this.all(`SELECT * FROM tokens WHERE provider = ? AND is_active = 1 ORDER BY is_primary DESC, total_used ASC`, [provider]);
    }
    return this.all(`SELECT * FROM tokens WHERE is_active = 1 ORDER BY provider, is_primary DESC, total_used ASC`);
  }

  getTokenForUse(provider) {
    // Get the least-used active token for this provider, with daily limit check
    const token = this.get(
      `SELECT * FROM tokens
       WHERE provider = ? AND is_active = 1 AND status = 'active'
       AND (daily_limit IS NULL OR daily_used < daily_limit)
       ORDER BY is_primary DESC, daily_used ASC, total_used ASC
       LIMIT 1`,
      [provider]
    );

    if (token) {
      // Reset daily counter if day changed
      const today = new Date().toISOString().slice(0, 10);
      if (token.daily_reset !== today) {
        this.run(`UPDATE tokens SET daily_used = 0, daily_reset = ? WHERE id = ?`, [today, token.id]);
        token.daily_used = 0;
      }
      return token;
    }
    return null;
  }

  recordTokenUsage(tokenId, success = true, tokensUsed = 0, cost = 0, error = null) {
    return this.run(
      `UPDATE tokens SET
        daily_used = daily_used + 1,
        total_used = total_used + 1,
        total_cost = total_cost + ?,
        last_used = CURRENT_TIMESTAMP,
        last_error = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
      [cost, error, tokenId]
    );
  }

  markTokenExhausted(tokenId, reason = 'rate_limited') {
    return this.run(
      `UPDATE tokens SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [reason, tokenId]
    );
  }

  reactivateToken(tokenId) {
    const today = new Date().toISOString().slice(0, 10);
    return this.run(
      `UPDATE tokens SET status = 'active', daily_used = 0, daily_reset = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [today, tokenId]
    );
  }

  replaceToken(oldTokenId, newApiKey) {
    const old = this.get(`SELECT * FROM tokens WHERE id = ?`, [oldTokenId]);
    if (!old) return { ok: false, error: 'Token not found' };

    // Deactivate old
    this.run(`UPDATE tokens SET is_active = 0, status = 'replaced', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [oldTokenId]);

    // Add new
    return this.run(
      `INSERT INTO tokens (provider, api_key, key_label, is_primary, auto_rotate) VALUES (?, ?, ?, ?, ?)`,
      [old.provider, newApiKey, `${old.key_label || old.provider} (rotated)`, old.is_primary, 1]
    );
  }

  getTokenStats(provider = null) {
    if (provider) {
      return this.all(
        `SELECT provider, COUNT(*) as total, SUM(is_active) as active, SUM(total_used) as total_requests,
         SUM(total_cost) as total_cost, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as healthy
         FROM tokens WHERE provider = ? GROUP BY provider`,
        [provider]
      );
    }
    return this.all(
      `SELECT provider, COUNT(*) as total, SUM(is_active) as active, SUM(total_used) as total_requests,
       SUM(total_cost) as total_cost, SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) as healthy
       FROM tokens GROUP BY provider`
    );
  }

  // ─── Usage Operations ──────────────────────────────────────────────────

  recordUsage(provider, model, promptTokens, completionTokens, totalTokens, cost, durationMs, success, error = null) {
    return this.run(
      `INSERT INTO usage (provider, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost, duration_ms, success, error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [provider, model, promptTokens, completionTokens, totalTokens, cost, durationMs, success ? 1 : 0, error]
    );
  }

  getUsageSummary(days = 30) {
    return this.all(
      `SELECT provider, model,
        COUNT(*) as requests,
        SUM(prompt_tokens) as prompt_tokens,
        SUM(completion_tokens) as completion_tokens,
        SUM(total_tokens) as total_tokens,
        SUM(estimated_cost) as total_cost,
        SUM(CASE WHEN success=1 THEN 1 ELSE 0 END) as successes,
        SUM(CASE WHEN success=0 THEN 1 ELSE 0 END) as failures
       FROM usage
       WHERE created_at >= datetime('now', ?)
       GROUP BY provider, model
       ORDER BY total_tokens DESC`,
      [`-${days} days`]
    );
  }

  getDailyUsage(days = 7) {
    return this.all(
      `SELECT date(created_at) as date, provider,
        COUNT(*) as requests,
        SUM(total_tokens) as total_tokens,
        SUM(estimated_cost) as total_cost
       FROM usage
       WHERE created_at >= datetime('now', ?)
       GROUP BY date(created_at), provider
       ORDER BY date DESC`,
      [`-${days} days`]
    );
  }

  // ─── Audit Operations ──────────────────────────────────────────────────

  addAudit(actionType, actionParams, level, reason, blocked, url = null, category = null, userId = null, taskId = null) {
    return this.run(
      `INSERT INTO audit (action_type, action_params, level, reason, blocked, url, category, user_id, task_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [actionType, typeof actionParams === 'string' ? actionParams : JSON.stringify(actionParams),
       level, reason, blocked ? 1 : 0, url, category, userId, taskId]
    );
  }

  getAuditLog(limit = 100) {
    return this.all(`SELECT * FROM audit ORDER BY created_at DESC LIMIT ?`, [limit]);
  }

  // ─── Config Operations ─────────────────────────────────────────────────

  getConfig(key) {
    const row = this.get(`SELECT value FROM config WHERE key = ?`, [key]);
    return row ? row.value : null;
  }

  setConfig(key, value) {
    return this.run(
      `INSERT INTO config (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = CURRENT_TIMESTAMP`,
      [key, value, value]
    );
  }

  // ─── Persistence ───────────────────────────────────────────────────────

  _saveTimer = null;

  _scheduleSave() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._save(), 1000);
  }

  _save() {
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    } catch (e) {
      console.error(`[DB] Save error:`, e.message);
    }
  }

  close() {
    this._save();
    this.db.close();
    this.ready = false;
  }
}

// Singleton
let _instance = null;

export async function getDatabase(dbPath) {
  if (!_instance) {
    _instance = new Database(dbPath);
    await _instance.init();
  }
  return _instance;
}

export default Database;

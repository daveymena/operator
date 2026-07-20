/**
 * Operator Pro — Filesystem & Network Engine
 * 
 * Unified file operations + HTTP client:
 * - CRUD file operations
 * - Directory management
 * - File watching
 * - HTTP requests (GET, POST, PUT, DELETE)
 * - File download/upload
 * - Archive support
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { pipeline } from 'stream/promises';
import { createWriteStream, createReadStream } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class FilesystemEngine {
  constructor(opts = {}) {
    this.verbose = opts.verbose || false;
    this.basePath = opts.basePath || process.cwd();
    this._watchers = new Map();
  }

  // ─── File Operations ───────────────────────────────────────────────────────

  async readFile(filepath, opts = {}) {
    try {
      const resolved = this._resolve(filepath);
      const encoding = opts.encoding || 'utf8';
      const content = fs.readFileSync(resolved, encoding);
      const stat = fs.statSync(resolved);
      return {
        ok: true, content, path: resolved,
        size: stat.size, modified: stat.mtime.toISOString(),
        encoding
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async writeFile(filepath, content, opts = {}) {
    try {
      const resolved = this._resolve(filepath);
      const dir = path.dirname(resolved);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(resolved, content, opts.encoding || 'utf8');
      const stat = fs.statSync(resolved);
      return { ok: true, path: resolved, size: stat.size };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async appendFile(filepath, content) {
    try {
      const resolved = this._resolve(filepath);
      fs.appendFileSync(resolved, content, 'utf8');
      return { ok: true, path: resolved };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async deleteFile(filepath) {
    try {
      const resolved = this._resolve(filepath);
      fs.unlinkSync(resolved);
      return { ok: true, path: resolved };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async copyFile(src, dest) {
    try {
      const srcResolved = this._resolve(src);
      const destResolved = this._resolve(dest);
      fs.mkdirSync(path.dirname(destResolved), { recursive: true });
      fs.copyFileSync(srcResolved, destResolved);
      return { ok: true, from: srcResolved, to: destResolved };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async moveFile(src, dest) {
    try {
      const srcResolved = this._resolve(src);
      const destResolved = this._resolve(dest);
      fs.mkdirSync(path.dirname(destResolved), { recursive: true });
      fs.renameSync(srcResolved, destResolved);
      return { ok: true, from: srcResolved, to: destResolved };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async fileInfo(filepath) {
    try {
      const resolved = this._resolve(filepath);
      const stat = fs.statSync(resolved);
      return {
        ok: true, path: resolved,
        isFile: stat.isFile(), isDir: stat.isDirectory(),
        size: stat.size, modified: stat.mtime.toISOString(),
        created: stat.birthtime.toISOString(),
        permissions: stat.mode.toString(8)
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ─── Directory Operations ──────────────────────────────────────────────────

  async listDir(dirpath = '.', opts = {}) {
    try {
      const resolved = this._resolve(dirpath);
      const entries = fs.readdirSync(resolved, { withFileTypes: true });
      let items = entries.map(e => ({
        name: e.name,
        path: path.join(resolved, e.name),
        isDir: e.isDirectory(),
        isFile: e.isFile(),
        isSymlink: e.isSymbolicLink()
      }));

      // Filter
      if (opts.filter) {
        const pattern = new RegExp(opts.filter, 'i');
        items = items.filter(i => pattern.test(i.name));
      }

      // Include sizes
      if (opts.sizes) {
        items = items.map(i => {
          try { i.size = fs.statSync(i.path).size; } catch { i.size = 0; }
          return i;
        });
      }

      // Sort
      items.sort((a, b) => {
        if (a.isDir && !b.isDir) return -1;
        if (!a.isDir && b.isDir) return 1;
        return a.name.localeCompare(b.name);
      });

      return { ok: true, path: resolved, items, count: items.length };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async mkdir(dirpath) {
    try {
      const resolved = this._resolve(dirpath);
      fs.mkdirSync(resolved, { recursive: true });
      return { ok: true, path: resolved };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async deleteDir(dirpath, recursive = true) {
    try {
      const resolved = this._resolve(dirpath);
      fs.rmSync(resolved, { recursive, force: true });
      return { ok: true, path: resolved };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /**
   * Search for files matching a pattern
   */
  async search(dirpath, pattern, opts = {}) {
    try {
      const resolved = this._resolve(dirpath);
      const results = [];
      const maxResults = opts.maxResults || 100;
      const maxDepth = opts.maxDepth || 5;
      const regex = new RegExp(pattern, 'i');

      const walk = (dir, depth) => {
        if (depth > maxDepth || results.length >= maxResults) return;
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (results.length >= maxResults) break;
            if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
            const fullPath = path.join(dir, entry.name);
            if (regex.test(entry.name)) {
              results.push({
                name: entry.name, path: fullPath,
                isDir: entry.isDirectory(), isFile: entry.isFile()
              });
            }
            if (entry.isDirectory()) walk(fullPath, depth + 1);
          }
        } catch {}
      };

      walk(resolved, 0);
      return { ok: true, results, count: results.length, pattern, basePath: resolved };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /**
   * Search for text content in files
   */
  async grep(dirpath, textPattern, opts = {}) {
    try {
      const resolved = this._resolve(dirpath);
      const results = [];
      const maxResults = opts.maxResults || 50;
      const regex = new RegExp(textPattern, opts.caseSensitive ? '' : 'i');
      const exts = opts.extensions ? new Set(opts.extensions.map(e => e.startsWith('.') ? e : '.' + e)) : null;

      const walk = (dir, depth) => {
        if (depth > 5 || results.length >= maxResults) return;
        try {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (results.length >= maxResults) break;
            if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
            const fullPath = path.join(dir, entry.name);
            if (entry.isFile() && (!exts || exts.has(path.extname(entry.name)))) {
              try {
                const content = fs.readFileSync(fullPath, 'utf8');
                const lines = content.split('\n');
                for (let i = 0; i < lines.length; i++) {
                  if (regex.test(lines[i])) {
                    results.push({
                      file: fullPath, line: i + 1,
                      text: lines[i].trim().substring(0, 200),
                      match: lines[i].match(regex)?.[0] || ''
                    });
                    if (results.length >= maxResults) break;
                  }
                }
              } catch {} // Skip binary files
            } else if (entry.isDirectory()) {
              walk(fullPath, depth + 1);
            }
          }
        } catch {}
      };

      walk(resolved, 0);
      return { ok: true, results, count: results.length, pattern: textPattern };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ─── File Watching ─────────────────────────────────────────────────────────

  async watch(filepath, callback) {
    const resolved = this._resolve(filepath);
    const watcherId = `watch_${Date.now()}`;
    const watcher = fs.watch(resolved, { recursive: true }, (event, filename) => {
      callback({ event, filename, path: path.join(resolved, filename || ''), watcherId });
    });
    this._watchers.set(watcherId, watcher);
    return { ok: true, watcherId };
  }

  async unwatch(watcherId) {
    const watcher = this._watchers.get(watcherId);
    if (watcher) {
      watcher.close();
      this._watchers.delete(watcherId);
      return { ok: true };
    }
    return { ok: false, error: 'Watcher not found' };
  }

  // ─── HTTP / Network ────────────────────────────────────────────────────────

  async httpGet(url, opts = {}) {
    try {
      const res = await axios.get(url, {
        headers: opts.headers || {},
        timeout: opts.timeout || 30000,
        responseType: opts.responseType || 'json',
        params: opts.params
      });
      return {
        ok: true, status: res.status,
        data: typeof res.data === 'object' ? JSON.stringify(res.data).substring(0, 10000) : String(res.data).substring(0, 10000),
        headers: res.headers
      };
    } catch (e) {
      return { ok: false, error: e.message, status: e.response?.status };
    }
  }

  async httpPost(url, data, opts = {}) {
    try {
      const res = await axios.post(url, data, {
        headers: opts.headers || { 'Content-Type': 'application/json' },
        timeout: opts.timeout || 30000
      });
      return {
        ok: true, status: res.status,
        data: typeof res.data === 'object' ? JSON.stringify(res.data).substring(0, 10000) : String(res.data).substring(0, 10000)
      };
    } catch (e) {
      return { ok: false, error: e.message, status: e.response?.status };
    }
  }

  async httpRequest(method, url, opts = {}) {
    try {
      const res = await axios({
        method, url,
        data: opts.data,
        headers: opts.headers || {},
        params: opts.params,
        timeout: opts.timeout || 30000,
        responseType: opts.responseType || 'json'
      });
      return {
        ok: true, status: res.status,
        data: typeof res.data === 'object' ? JSON.stringify(res.data).substring(0, 10000) : String(res.data).substring(0, 10000),
        headers: res.headers
      };
    } catch (e) {
      return { ok: false, error: e.message, status: e.response?.status };
    }
  }

  // ─── Download / Upload ─────────────────────────────────────────────────────

  async download(url, destPath, opts = {}) {
    try {
      const resolved = this._resolve(destPath);
      fs.mkdirSync(path.dirname(resolved), { recursive: true });

      const res = await axios.get(url, {
        responseType: 'stream',
        timeout: opts.timeout || 60000,
        headers: opts.headers || {}
      });

      const writer = createWriteStream(resolved);
      await pipeline(res.data, writer);

      const stat = fs.statSync(resolved);
      return { ok: true, path: resolved, size: stat.size, url };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async upload(url, filepath, opts = {}) {
    try {
      const resolved = this._resolve(filepath);
      const FormData = (await import('form-data')).default;
      const form = new FormData();
      form.append(opts.fieldName || 'file', createReadStream(resolved));

      const res = await axios.post(url, form, {
        headers: { ...form.getHeaders(), ...(opts.headers || {}) },
        timeout: opts.timeout || 60000
      });

      return { ok: true, status: res.status, data: res.data };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  _resolve(filepath) {
    if (path.isAbsolute(filepath)) return filepath;
    return path.resolve(this.basePath, filepath);
  }

  _log(msg) { if (this.verbose) console.log(`  [FS] ${msg}`); }
}

// Singleton
let _instance = null;
export function getFilesystem(opts = {}) {
  if (!_instance) _instance = new FilesystemEngine(opts);
  return _instance;
}

export default FilesystemEngine;

/**
 * Operator Pro — Terminal Engine
 * 
 * Cross-platform terminal/shell execution with:
 * - Persistent shell sessions (keeps environment between commands)
 * - Command history
 * - Working directory tracking
 * - Timeout handling
 * - Streaming output
 * - Multi-shell support (bash, zsh, cmd, powershell)
 */

import { spawn, exec, execSync } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { EventEmitter } from 'events';

const OS = os.platform();
const HOME = os.homedir();

export class TerminalEngine extends EventEmitter {
  constructor(opts = {}) {
    super();
    this.verbose = opts.verbose || false;
    this.sessions = new Map();
    this.defaultCwd = opts.cwd || HOME;
    this.history = [];
    this.maxHistory = 500;
    this._shellProcess = null;
    this._shellBuffer = '';
    this._shellReady = false;
  }

  // ─── One-shot Command Execution ────────────────────────────────────────────

  /**
   * Execute a command and return the result
   */
  async exec(command, opts = {}) {
    const t0 = Date.now();
    const cwd = opts.cwd || this.defaultCwd;
    const timeout = opts.timeout || 30000;
    const env = { ...process.env, ...(opts.env || {}) };
    const shell = opts.shell || this._getShell();

    this.history.push({ command, cwd, time: new Date().toISOString() });
    if (this.history.length > this.maxHistory) this.history.shift();

    return new Promise((resolve) => {
      const proc = exec(command, {
        cwd, timeout, env, shell, maxBuffer: 10 * 1024 * 1024
      }, (error, stdout, stderr) => {
        const duration = Date.now() - t0;
        const result = {
          ok: !error,
          stdout: stdout?.toString().trim() || '',
          stderr: stderr?.toString().trim() || '',
          code: error?.code || 0,
          signal: error?.signal || null,
          killed: error?.killed || false,
          duration,
          command,
          cwd
        };
        this.emit('exec', result);
        resolve(result);
      });

      // Stream output if callback provided
      if (opts.onStdout) proc.stdout?.on('data', opts.onStdout);
      if (opts.onStderr) proc.stderr?.on('data', opts.onStderr);
    });
  }

  /**
   * Execute a command synchronously (for simple/fast operations)
   */
  execSync(command, opts = {}) {
    const cwd = opts.cwd || this.defaultCwd;
    const timeout = opts.timeout || 15000;
    try {
      const output = execSync(command, {
        cwd, timeout, encoding: 'utf8', maxBuffer: 5 * 1024 * 1024,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return { ok: true, output: output.trim(), command };
    } catch (e) {
      return { ok: false, error: e.message, output: e.stdout?.toString().trim() || '', command };
    }
  }

  // ─── Persistent Shell Session ──────────────────────────────────────────────

  /**
   * Start a persistent shell session that maintains state between commands
   */
  async startSession(opts = {}) {
    const sessionId = opts.id || `shell_${Date.now()}`;
    const shell = opts.shell || this._getShell();
    const cwd = opts.cwd || this.defaultCwd;

    if (this.sessions.has(sessionId)) {
      return { ok: true, sessionId, existing: true };
    }

    const shellArgs = OS === 'win32' ? [] : ['-i'];
    const proc = spawn(shell, shellArgs, {
      cwd,
      env: { ...process.env, TERM: 'xterm-256color' },
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const session = {
      id: sessionId,
      process: proc,
      cwd,
      shell,
      started: Date.now(),
      buffer: '',
      ready: false,
      lastCommand: null
    };

    // Set up output handling
    proc.stdout.on('data', (data) => {
      const text = data.toString();
      session.buffer += text;
      this.emit('session:output', { sessionId, data: text });
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      session.buffer += text;
      this.emit('session:error', { sessionId, data: text });
    });

    proc.on('exit', (code) => {
      this.sessions.delete(sessionId);
      this.emit('session:exit', { sessionId, code });
    });

    // Wait for shell to be ready
    await new Promise(r => setTimeout(r, 500));
    session.ready = true;
    this.sessions.set(sessionId, session);

    return { ok: true, sessionId, shell, cwd };
  }

  /**
   * Execute a command in a persistent session
   */
  async sessionExec(sessionId, command, opts = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) return { ok: false, error: `Session ${sessionId} not found` };

    const timeout = opts.timeout || 30000;
    session.buffer = '';
    session.lastCommand = command;

    // Use a unique marker to detect command completion
    const marker = `__OPERATOR_DONE_${Date.now()}__`;
    const wrappedCmd = OS === 'win32'
      ? `${command}\necho ${marker} %ERRORLEVEL%`
      : `${command}\necho ${marker} $?`;

    return new Promise((resolve) => {
      session.process.stdin.write(wrappedCmd + '\n');

      const checkInterval = setInterval(() => {
        if (session.buffer.includes(marker)) {
          clearInterval(checkInterval);
          clearTimeout(timeoutId);

          // Parse output, removing the marker line
          const lines = session.buffer.split('\n');
          const markerIdx = lines.findIndex(l => l.includes(marker));
          const exitCode = markerIdx >= 0 ? parseInt(lines[markerIdx].replace(marker, '').trim()) || 0 : -1;
          const output = lines.slice(0, markerIdx).join('\n').trim();

          resolve({
            ok: exitCode === 0,
            output,
            exitCode,
            command,
            sessionId
          });
        }
      }, 100);

      const timeoutId = setTimeout(() => {
        clearInterval(checkInterval);
        resolve({
          ok: false,
          output: session.buffer.trim(),
          error: `Timeout after ${timeout}ms`,
          command,
          sessionId
        });
      }, timeout);
    });
  }

  /**
   * Close a persistent session
   */
  async closeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return { ok: false, error: 'Session not found' };
    session.process.kill('SIGTERM');
    this.sessions.delete(sessionId);
    return { ok: true, sessionId };
  }

  /**
   * Close all sessions
   */
  async closeAll() {
    for (const [id] of this.sessions) {
      await this.closeSession(id);
    }
    return { ok: true };
  }

  // ─── High-level Operations ─────────────────────────────────────────────────

  /**
   * Run a script file
   */
  async runScript(scriptPath, args = [], opts = {}) {
    const ext = path.extname(scriptPath).toLowerCase();
    const runners = {
      '.js': 'node', '.mjs': 'node', '.cjs': 'node', '.ts': 'npx tsx',
      '.py': 'python3', '.pyw': 'python3',
      '.sh': 'bash', '.bash': 'bash', '.zsh': 'zsh',
      '.ps1': 'powershell -ExecutionPolicy Bypass -File',
      '.bat': 'cmd /c', '.cmd': 'cmd /c',
      '.rb': 'ruby', '.go': 'go run', '.rs': 'cargo run --'
    };
    const runner = runners[ext] || '';
    const fullCmd = `${runner} "${scriptPath}" ${args.join(' ')}`.trim();
    return this.exec(fullCmd, opts);
  }

  /**
   * Run a Node.js script with the project's node_modules
   */
  async runNodeScript(scriptPath, args = [], opts = {}) {
    const cwd = opts.cwd || this.defaultCwd;
    return this.exec(`node "${scriptPath}" ${args.join(' ')}`, { ...opts, cwd });
  }

  /**
   * Install npm packages
   */
  async npmInstall(packages = [], opts = {}) {
    const global = opts.global ? ' -g' : '';
    const dev = opts.dev ? ' --save-dev' : '';
    const pkgStr = packages.length ? packages.join(' ') : '';
    return this.exec(`npm install${global}${dev} ${pkgStr}`, {
      ...opts,
      timeout: opts.timeout || 120000
    });
  }

  /**
   * Run npm script
   */
  async npmRun(script, opts = {}) {
    return this.exec(`npm run ${script}`, opts);
  }

  /**
   * Git operations
   */
  async git(command, opts = {}) {
    return this.exec(`git ${command}`, opts);
  }

  // ─── System Operations ─────────────────────────────────────────────────────

  /**
   * Get current working directory
   */
  async pwd() {
    const cmd = OS === 'win32' ? 'cd' : 'pwd';
    return this.exec(cmd);
  }

  /**
   * List directory contents
   */
  async ls(dir = '.', opts = {}) {
    const cmd = OS === 'win32' ? `dir "${dir}"` : `ls -la "${dir}"`;
    return this.exec(cmd, opts);
  }

  /**
   * Read a file
   */
  async readFile(filepath) {
    try {
      const content = fs.readFileSync(filepath, 'utf8');
      return { ok: true, content, size: content.length, path: filepath };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /**
   * Write a file
   */
  async writeFile(filepath, content) {
    try {
      const dir = path.dirname(filepath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filepath, content, 'utf8');
      return { ok: true, path: filepath, size: content.length };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /**
   * Check if a command exists
   */
  async which(command) {
    const cmd = OS === 'win32' ? `where ${command}` : `which ${command}`;
    const r = this.execSync(cmd);
    return r.ok ? r.output.split('\n')[0].trim() : null;
  }

  /**
   * Get environment variables
   */
  async getEnv(key) {
    if (key) return process.env[key] || '';
    return process.env;
  }

  /**
   * Set environment variable for current process
   */
  setEnv(key, value) {
    process.env[key] = value;
    return { ok: true, key, value };
  }

  // ─── Command History ───────────────────────────────────────────────────────

  getHistory(limit = 50) {
    return this.history.slice(-limit);
  }

  clearHistory() {
    this.history = [];
    return { ok: true };
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  _getShell() {
    if (OS === 'win32') {
      // Prefer PowerShell over cmd
      return process.env.SHELL || 'powershell.exe';
    }
    return process.env.SHELL || '/bin/bash';
  }
}

// Singleton
let _instance = null;
export function getTerminal(opts = {}) {
  if (!_instance) _instance = new TerminalEngine(opts);
  return _instance;
}

export default TerminalEngine;

/**
 * Operator Pro — Task Orchestrator
 * 
 * The central coordinator that ties everything together:
 * - Receives tasks and breaks them into steps
 * - Coordinates Brain, Actions, Memory, and all Engines
 * - Manages task lifecycle (plan → execute → verify → complete)
 * - Handles multi-step workflows with error recovery
 * - Safety layer for destructive operations
 * - Plugin system for extensibility
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import { v4 as uuid } from 'uuid';

import { Brain } from '../brain.mjs';
import { Memory } from '../memory.mjs';
import { Knowledge } from '../knowledge.mjs';
import { getBrowser } from '../engines/browser.mjs';
import { getTerminal } from '../engines/terminal.mjs';
import { getScreen } from '../engines/screen.mjs';
import { getFilesystem } from '../engines/filesystem.mjs';
import platform from '../platform/index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MAX_STEPS = 50;

// ─── Safety Rules ──────────────────────────────────────────────────────────────

const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\//i,
  /format\s+[a-z]:/i,
  /del\s+\/[sfq]/i,
  /drop\s+database/i,
  /truncate\s+table/i,
  /:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;/,  // fork bomb
  /mkfs\./i,
  /dd\s+if=.*of=\/dev\/[sh]d/i,
  /shutdown/i,
  /reboot/i,
  /poweroff/i,
  /kill\s+-9\s+0/i,
];

const CONFIRM_ACTIONS = [
  'delete_file', 'delete_dir', 'powershell_rm',
  'drop_database', 'format_disk', 'kill_process'
];

export class Orchestrator extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = config;
    this.brain = null;
    this.memory = null;
    this.knowledge = null;
    this.browser = null;
    this.terminal = null;
    this.screen = null;
    this.filesystem = null;
    this.plugins = new Map();
    this.activeTasks = new Map();
    this.verbose = config.verbose || false;
    this.safetyEnabled = config.safety !== false;
    this.autoConfirm = config.autoConfirm || false;
    this.maxConcurrentTasks = config.maxConcurrent || 3;
  }

  // ─── Initialization ────────────────────────────────────────────────────────

  async init() {
    this.browser = getBrowser({ verbose: this.verbose });
    this.terminal = getTerminal({ verbose: this.verbose });
    this.screen = getScreen({ verbose: this.verbose });
    this.filesystem = getFilesystem({ verbose: this.verbose, basePath: this.config.basePath || process.cwd() });

    // Connect to browser (non-blocking)
    this.browser.connect({ headless: this.config.headless }).catch(() => {});

    return this;
  }

  // ─── Task Execution ────────────────────────────────────────────────────────

  /**
   * Execute a task from start to finish
   */
  async runTask(task, options = {}) {
    if (this.activeTasks.size >= this.maxConcurrentTasks) {
      return { ok: false, error: 'Maximum concurrent tasks reached' };
    }

    const taskId = options.taskId || uuid();
    const memory = new Memory(taskId);
    memory.init(task);

    const knowledge = new Knowledge();
    if (options.docs) {
      await knowledge.load(options.docs);
      memory.setKnowledge(knowledge.getSummary());
    } else {
      await knowledge.loadProjectDocs();
      await knowledge.loadOpenCodeTools();
    }

    const brain = new Brain({
      groqKey: options.groqKey || process.env.GROQ_API_KEY,
      backend: options.brain || 'auto',
      verbose: this.verbose,
      bridge: null
    });

    const taskState = {
      id: taskId,
      task,
      status: 'running',
      startedAt: new Date().toISOString(),
      steps: 0,
      maxSteps: options.maxSteps || MAX_STEPS,
      brain,
      memory,
      knowledge,
      options
    };

    this.activeTasks.set(taskId, taskState);
    this.emit('task:start', { taskId, task });

    try {
      // PHASE 1: PLANNING
      this.emit('task:phase', { taskId, phase: 'planning' });
      const plan = await brain.createPlan(task, knowledge.getSummary());
      if (plan?.goal) {
        taskState.plan = plan;
        this.emit('task:plan', { taskId, plan });
      }

      // PHASE 2: EXECUTION
      this.emit('task:phase', { taskId, phase: 'executing' });
      const result = await this._executeLoop(taskState);

      // PHASE 3: COMPLETE
      taskState.status = result.ok ? 'completed' : 'failed';
      taskState.completedAt = new Date().toISOString();
      taskState.result = result;

      this.emit('task:complete', { taskId, ...result });
      return { ok: true, taskId, ...result };

    } catch (e) {
      taskState.status = 'failed';
      taskState.error = e.message;
      this.emit('task:error', { taskId, error: e.message });
      return { ok: false, taskId, error: e.message };
    } finally {
      this.activeTasks.delete(taskId);
    }
  }

  // ─── Execution Loop ────────────────────────────────────────────────────────

  async _executeLoop(state) {
    const { task, brain, memory, knowledge, maxSteps } = state;
    let lastStateDesc = '';
    let consecutiveFailures = 0;

    for (let step = 1; step <= maxSteps; step++) {
      state.steps = step;
      this.emit('step:start', { taskId: state.id, step, maxSteps });

      // 1. Capture current state
      const screenState = await this._captureState();

      // 2. Detect if stuck
      if (screenState.description === lastStateDesc && step > 2) {
        consecutiveFailures++;
        this.emit('step:stuck', { taskId: state.id, step, count: consecutiveFailures });
        if (consecutiveFailures >= 3) {
          memory.markFailed('stuck_' + consecutiveFailures);
          return { ok: false, reason: 'stuck', steps: step };
        }
      } else {
        consecutiveFailures = 0;
      }
      lastStateDesc = screenState.description;

      // 3. Brain decides next action
      const brainInput = knowledge.getToolList() + '\n\n' + knowledge.getSummary(5000);
      const decision = await brain.think(task, screenState, brainInput, memory.getHistory());

      if (!decision) {
        memory.markFailed('brain_no_decision');
        return { ok: false, reason: 'brain_failed', steps: step };
      }

      if (decision.done) {
        memory.markDone(decision.reason || 'completed');
        return { ok: true, reason: decision.reason, steps: step };
      }

      if (!decision.action?.type) {
        memory.addStep(decision.thought || '', { type: 'none' }, { ok: false, error: 'invalid_action' }, '');
        continue;
      }

      // 4. Safety check
      if (this.safetyEnabled && this._isDangerous(decision.action)) {
        this.emit('step:dangerous', { taskId: state.id, action: decision.action, step });
        if (!this.autoConfirm) {
          const confirmed = await this._requestConfirmation(decision.action);
          if (!confirmed) {
            memory.addStep(decision.thought, decision.action, { ok: false, error: 'user_denied' }, '');
            this.emit('step:denied', { taskId: state.id, action: decision.action });
            continue;
          }
        }
      }

      // 5. Execute action
      this.emit('step:decision', {
        taskId: state.id, step,
        thought: decision.thought,
        action: decision.action,
        backend: decision._backend
      });

      const result = await this.executeAction(decision.action);

      this.emit('step:result', {
        taskId: state.id, step,
        ok: result.ok, error: result.error,
        duration: result.duration
      });

      memory.addStep(decision.thought, decision.action, result, screenState.description);

      if (!result.ok) {
        brain.failedActions++;
        if (brain.failedActions >= 5) {
          memory.markFailed('too_many_failures');
          return { ok: false, reason: 'too_many_failures', steps: step };
        }
      }

      // 6. Verify action result
      if (result.ok) {
        const newState = await this._captureState();
        const verification = await brain.verify(decision.action, result, screenState.description, newState.description);
        if (verification?.advance_plan) {
          const advance = brain.advancePlan();
          if (advance.done) {
            memory.markDone('plan_completed');
            return { ok: true, reason: 'plan_completed', steps: step };
          }
        }
      }

      // 7. Wait between steps
      const delays = { browser_goto: 3000, browser_click: 1500, browser_type: 1000, keyboard_type: 500, mouse_click: 1500, terminal_exec: 2000 };
      await new Promise(r => setTimeout(r, delays[decision.action?.type] || 800));
    }

    memory.markFailed('max_steps_reached');
    return { ok: false, reason: 'max_steps_reached', steps: maxSteps };
  }

  // ─── Action Execution (unified dispatch) ───────────────────────────────────

  async executeAction(action) {
    if (!action?.type) return { ok: false, error: 'no action type' };
    const t0 = Date.now();

    try {
      let result;
      const p = action.params || {};

      switch (action.type) {
        // Browser actions
        case 'browser_goto':      result = await this.browser.goto(p); break;
        case 'browser_click':     result = await this.browser.click(p); break;
        case 'browser_type':      result = await this.browser.type(p); break;
        case 'browser_press':     result = await this.browser.press(p.key || 'Enter'); break;
        case 'browser_select':    result = await this.browser.select(p); break;
        case 'browser_check':     result = await this.browser.check(p); break;
        case 'browser_evaluate':  result = await this.browser.evaluate(p.code || p.script); break;
        case 'browser_screenshot':result = await this.browser.screenshot(p); break;
        case 'browser_content':   result = await this.browser.getContent(p); break;
        case 'browser_find':      result = await this.browser.findElements(p); break;
        case 'browser_fill_form': result = await this.browser.fillForm(p.fields || []); break;
        case 'browser_submit':    result = await this.browser.submit(p.selector); break;
        case 'browser_wait':      result = await this.browser.waitFor(p); break;
        case 'browser_tabs':      result = await this.browser.listTabs(); break;
        case 'browser_switch_tab':result = await this.browser.switchTab(p.index || 0); break;
        case 'browser_new_tab':   result = await this.browser.newTab(p.url); break;
        case 'browser_back':      result = await this.browser.back(); break;
        case 'browser_forward':   result = await this.browser.forward(); break;
        case 'browser_reload':    result = await this.browser.reload(); break;
        case 'browser_cookies':   result = await this.browser.getCookies(p.domain); break;
        case 'browser_download':  result = await this.browser.download(p.url, p.path); break;

        // Screen actions
        case 'screenshot':        result = await this.screen.capture(p); break;
        case 'screen_region':     result = await this.screen.captureRegion(p.x, p.y, p.width, p.height); break;
        case 'screen_ocr':        result = await this.screen.ocr(p.path || p.image); break;
        case 'screen_find_text':  result = await this.screen.findTextOnScreen(p.text, p); break;
        case 'screen_info':       result = await this.screen.getInfo(); break;

        // Terminal actions
        case 'terminal_exec':     result = await this.terminal.exec(p.command || p.script, p); break;
        case 'terminal_run':      result = await this.terminal.runScript(p.path, p.args, p); break;
        case 'terminal_npm':      result = await this.terminal.npmRun(p.script, p); break;
        case 'terminal_git':      result = await this.terminal.git(p.command, p); break;

        // File actions
        case 'read_file':         result = await this.filesystem.readFile(p.path, p); break;
        case 'write_file':        result = await this.filesystem.writeFile(p.path, p.content, p); break;
        case 'list_dir':          result = await this.filesystem.listDir(p.path || '.', p); break;
        case 'search_files':      result = await this.filesystem.search(p.path || '.', p.pattern, p); break;
        case 'grep_files':        result = await this.filesystem.grep(p.path || '.', p.pattern, p); break;
        case 'delete_file':       result = await this.filesystem.deleteFile(p.path); break;
        case 'copy_file':         result = await this.filesystem.copyFile(p.src, p.dest); break;
        case 'move_file':         result = await this.filesystem.moveFile(p.src, p.dest); break;
        case 'mkdir':             result = await this.filesystem.mkdir(p.path); break;
        case 'delete_dir':        result = await this.filesystem.deleteDir(p.path); break;

        // Network actions
        case 'http_get':          result = await this.filesystem.httpGet(p.url, p); break;
        case 'http_post':         result = await this.filesystem.httpPost(p.url, p.data, p); break;
        case 'http_request':      result = await this.filesystem.httpRequest(p.method, p.url, p); break;
        case 'download':          result = await this.filesystem.download(p.url, p.path, p); break;

        // Platform actions (mouse, keyboard, system)
        case 'mouse_move':        result = await platform.mouseMove(p.x, p.y); break;
        case 'mouse_click':       result = await platform.mouseClick(p.x, p.y, p.button); break;
        case 'mouse_scroll':      result = await platform.mouseScroll(p.x, p.y, p.clicks); break;
        case 'keyboard_type':     result = await platform.keyboardType(p.text); break;
        case 'keyboard_press':    result = await platform.keyboardPress(p.key); break;
        case 'get_cursor':        result = await platform.getCursor(); break;
        case 'list_windows':      result = await platform.listWindows(); break;
        case 'list_processes':    result = await platform.listProcesses(); break;
        case 'sysinfo':           result = await platform.getSystemInfo(); break;
        case 'open_url':          result = await platform.openUrl(p.url); break;
        case 'open_file':         result = await platform.openFile(p.path); break;
        case 'get_clipboard':     result = await platform.getClipboard(); break;
        case 'set_clipboard':     result = await platform.setClipboard(p.text); break;
        case 'notify':            result = await platform.notify(p.title || 'Operator', p.message); break;

        // Meta actions
        case 'wait':
          await new Promise(r => setTimeout(r, p.ms || 1000));
          result = { ok: true, waited: p.ms || 1000 };
          break;
        case 'done':
          result = { ok: true, done: true, message: p.message || 'completed' };
          break;

        // Legacy compatibility
        case 'powershell':
          result = await this.terminal.exec(p.script || p.command);
          break;

        default:
          // Check plugins
          const plugin = this._findPluginFor(action.type);
          if (plugin) {
            result = await plugin.execute(action);
          } else {
            result = { ok: false, error: `Unknown action: ${action.type}` };
          }
      }

      result.duration = Date.now() - t0;
      return result;
    } catch (e) {
      return { ok: false, error: e.message, duration: Date.now() - t0 };
    }
  }

  // ─── State Capture ─────────────────────────────────────────────────────────

  async _captureState() {
    const state = { description: '', url: '', cursor: '' };

    // Try browser state first
    if (this.browser.connected) {
      try {
        const content = await this.browser.getContent({ text: true });
        if (content.ok) state.description = `[Browser: ${this.browser.page?.url()}] ${content.content?.substring(0, 2000)}`;
      } catch {}
    }

    // Try screenshot if no browser
    if (!state.description) {
      try {
        const ss = await this.screen.capture({ quality: 50, scale: 0.75 });
        if (ss.ok) {
          state.description = await this.brain?.describeImage(ss.base64) || 'Screenshot captured';
          state.screenshot = ss.file;
        }
      } catch {}
    }

    // Cursor position
    try {
      const cursor = await platform.getCursor();
      if (cursor.ok) state.cursor = `${cursor.x},${cursor.y}`;
    } catch {}

    return state;
  }

  // ─── Safety ────────────────────────────────────────────────────────────────

  _isDangerous(action) {
    const params = action.params || {};
    const cmd = params.script || params.command || '';
    return DANGEROUS_PATTERNS.some(p => p.test(cmd));
  }

  async _requestConfirmation(action) {
    return new Promise((resolve) => {
      this.emit('safety:confirm', {
        action,
        resolve: (confirmed) => resolve(confirmed)
      });
      // Auto-timeout after 30s
      setTimeout(() => resolve(false), 30000);
    });
  }

  // ─── Plugins ───────────────────────────────────────────────────────────────

  registerPlugin(plugin) {
    if (!plugin.name || !plugin.actions) {
      throw new Error('Plugin must have name and actions');
    }
    this.plugins.set(plugin.name, plugin);
    this._log(`Plugin registered: ${plugin.name} (${plugin.actions.length} actions)`);
    return { ok: true, plugin: plugin.name };
  }

  _findPluginFor(actionType) {
    for (const [, plugin] of this.plugins) {
      if (plugin.actions.includes(actionType)) return plugin;
    }
    return null;
  }

  // ─── Task Management ───────────────────────────────────────────────────────

  getActiveTasks() {
    return Array.from(this.activeTasks.entries()).map(([id, state]) => ({
      id,
      task: state.task,
      status: state.status,
      steps: state.steps,
      maxSteps: state.maxSteps,
      startedAt: state.startedAt
    }));
  }

  async cancelTask(taskId) {
    const task = this.activeTasks.get(taskId);
    if (!task) return { ok: false, error: 'Task not found' };
    task.status = 'cancelled';
    task.cancelled = true;
    this.activeTasks.delete(taskId);
    this.emit('task:cancelled', { taskId });
    return { ok: true, taskId };
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  async shutdown() {
    // Cancel all tasks
    for (const [id] of this.activeTasks) {
      await this.cancelTask(id);
    }
    // Close browser
    await this.browser?.disconnect();
    // Close terminal sessions
    await this.terminal?.closeAll();
    return { ok: true };
  }

  _log(msg) { if (this.verbose) console.log(`  [Orchestrator] ${msg}`); }
}

// Singleton
let _instance = null;
export function getOrchestrator(config = {}) {
  if (!_instance) _instance = new Orchestrator(config);
  return _instance;
}

export default Orchestrator;

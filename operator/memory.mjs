import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MEM_DIR = path.join(__dirname, 'memory');
fs.mkdirSync(MEM_DIR, { recursive: true });

export class Memory {
  constructor(taskId) {
    this.taskId = taskId || `task_${Date.now()}`;
    this.file = path.join(MEM_DIR, `${this.taskId}.json`);
    this.data = this._load();
  }

  _load() {
    try { return JSON.parse(fs.readFileSync(this.file, 'utf8')); }
    catch {
      return {
        id: this.taskId, created: new Date().toISOString(),
        task: '', knowledge: '', steps: [], status: 'running', currentStep: 0
      };
    }
  }

  init(task) {
    this.data.task = task;
    this._save();
    return this;
  }

  setKnowledge(knowledge) {
    this.data.knowledge = knowledge.substring(0, 5000);
    this._save();
  }

  addStep(thought, action, result, stateDesc) {
    this.data.currentStep++;
    this.data.steps.push({
      step: this.data.currentStep,
      timestamp: new Date().toISOString(),
      thought,
      action: typeof action === 'object' ? { type: action.type, params: action.params } : action,
      result: { ok: result?.ok, duration: result?.duration, error: result?.error },
      state: stateDesc?.substring(0, 500) || null
    });
    this._save();
  }

  markDone(reason) {
    this.data.status = 'completed';
    this.data.completedAt = new Date().toISOString();
    this.data.reason = reason;
    this._save();
  }

  markFailed(error) {
    this.data.status = 'failed';
    this.data.error = error;
    this._save();
  }

  getHistory() {
    return this.data.steps.map(s => ({
      step: s.step, thought: s.thought,
      action: `${s.action?.type}(${JSON.stringify(s.action?.params || {})})`,
      result: s.result?.ok ? '✅ ok' : `❌ ${s.result?.error || '?'}`
    }));
  }

  getSummary() {
    const s = this.data.steps;
    const ok = s.filter(x => x.result?.ok).length;
    const fail = s.filter(x => !x.result?.ok).length;
    const start = new Date(this.data.created).getTime();
    return {
      id: this.data.id,
      task: this.data.task,
      steps: s.length, successful: ok, failed: fail,
      status: this.data.status,
      duration: Math.round((Date.now() - start) / 1000) + 's',
      hasKnowledge: !!this.data.knowledge
    };
  }

  _save() {
    fs.writeFileSync(this.file, JSON.stringify(this.data, null, 2));
  }

  static listTasks() {
    try {
      return fs.readdirSync(MEM_DIR)
        .filter(f => f.endsWith('.json'))
        .map(f => {
          try {
            const d = JSON.parse(fs.readFileSync(path.join(MEM_DIR, f), 'utf8'));
            return { id: d.id, task: d.task?.substring(0, 80), steps: d.steps?.length || 0, status: d.status, created: d.created, hasKnowledge: !!d.knowledge };
          } catch { return null; }
        })
        .filter(Boolean)
        .sort((a, b) => new Date(b.created) - new Date(a.created));
    } catch { return []; }
  }
}

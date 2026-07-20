/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║          ⏰ Task Scheduler — v4.0                             ║
 * ║   Cron-like scheduling, recurring tasks, templates,         ║
 * ║   retry policies, notifications                             ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Usage:
 *   const scheduler = new TaskScheduler(orchestrator);
 *   scheduler.schedule({ task: 'update spreadsheet', cron: '0 9 * * 1' }); // Every Monday 9AM
 *   scheduler.schedule({ task: 'backup logs', interval: 86400000 }); // Every 24h
 *   scheduler.start();
 */

import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class TaskScheduler extends EventEmitter {
  constructor(orchestrator, config = {}) {
    super();
    this.orchestrator = orchestrator;
    this.jobs = new Map();
    this.running = false;
    this.timers = new Map();
    this.history = [];
    this.maxHistory = 1000;
    this.savePath = path.join(__dirname, '..', '..', 'data', 'scheduler.json');
    this._load();
  }

  /**
   * Schedule a new recurring task
   * @param {Object} params
   * @param {string} params.task - Task description
   * @param {string} [params.cron] - Cron expression (e.g., '0 9 * * 1')
   * @param {number} [params.interval] - Interval in ms (e.g., 86400000 for 24h)
   * @param {string} [params.name] - Job name
   * @param {Object} [params.options] - Task options (brain, maxSteps, etc.)
   * @param {number} [params.retryCount] - Retry attempts on failure (default: 2)
   * @param {number} [params.retryDelay] - Delay between retries in ms (default: 60000)
   * @param {string} [params.notifyUrl] - Webhook URL for notifications
   * @param {boolean} [params.enabled] - Enable/disable (default: true)
   */
  schedule(params) {
    const id = params.id || `job_${crypto.randomUUID().slice(0, 8)}`;
    const job = {
      id,
      name: params.name || `Scheduled task: ${params.task.slice(0, 50)}`,
      task: params.task,
      cron: params.cron || null,
      interval: params.interval || null,
      options: params.options || {},
      retryCount: params.retryCount ?? 2,
      retryDelay: params.retryDelay ?? 60000,
      notifyUrl: params.notifyUrl || null,
      enabled: params.enabled !== false,
      createdAt: new Date().toISOString(),
      lastRun: null,
      nextRun: null,
      runCount: 0,
      lastResult: null,
      status: 'scheduled'
    };

    // Calculate next run time
    job.nextRun = this._calculateNextRun(job);

    this.jobs.set(id, job);
    this._save();

    if (this.running) {
      this._scheduleJob(job);
    }

    this.emit('job:created', { id, job });
    return job;
  }

  /**
   * Remove a scheduled job
   */
  unschedule(jobId) {
    const job = this.jobs.get(jobId);
    if (!job) return false;

    // Clear timer
    if (this.timers.has(jobId)) {
      clearTimeout(this.timers.get(jobId));
      this.timers.delete(jobId);
    }

    this.jobs.delete(jobId);
    this._save();
    this.emit('job:removed', { id: jobId });
    return true;
  }

  /**
   * Enable/disable a job
   */
  toggle(jobId, enabled) {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    job.enabled = enabled;
    if (enabled && this.running) {
      this._scheduleJob(job);
    } else if (!enabled && this.timers.has(jobId)) {
      clearTimeout(this.timers.get(jobId));
      this.timers.delete(jobId);
    }

    this._save();
    return job;
  }

  /**
   * Start the scheduler
   */
  start() {
    if (this.running) return;
    this.running = true;

    for (const job of this.jobs.values()) {
      if (job.enabled) {
        this._scheduleJob(job);
      }
    }

    this.emit('scheduler:started');
  }

  /**
   * Stop the scheduler
   */
  stop() {
    this.running = false;
    for (const [id, timer] of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
    this.emit('scheduler:stopped');
  }

  /**
   * Get all scheduled jobs
   */
  listJobs() {
    return Array.from(this.jobs.values());
  }

  /**
   * Get job by ID
   */
  getJob(jobId) {
    return this.jobs.get(jobId);
  }

  /**
   * Get scheduler status
   */
  getStatus() {
    return {
      running: this.running,
      totalJobs: this.jobs.size,
      activeJobs: Array.from(this.jobs.values()).filter(j => j.enabled).length,
      recentRuns: this.history.slice(-10)
    };
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  _scheduleJob(job) {
    if (!job.enabled || !this.running) return;

    // Clear existing timer
    if (this.timers.has(job.id)) {
      clearTimeout(this.timers.get(job.id));
    }

    const now = Date.now();
    let nextRun = this._calculateNextRun(job);

    if (!nextRun) {
      // If we can't calculate next run, skip
      return;
    }

    const delay = Math.max(nextRun.getTime() - now, 1000); // Min 1 second

    const timer = setTimeout(async () => {
      await this._executeJob(job);
      // Reschedule
      if (job.enabled && this.running) {
        this._scheduleJob(job);
      }
    }, delay);

    this.timers.set(job.id, timer);
    job.nextRun = nextRun.toISOString();
    this._save();
  }

  async _executeJob(job) {
    job.status = 'running';
    job.lastRun = new Date().toISOString();
    this.emit('job:started', { id: job.id, name: job.name });

    let attempts = 0;
    const maxAttempts = 1 + job.retryCount;
    let result = null;

    while (attempts < maxAttempts) {
      try {
        result = await this.orchestrator.runTask(job.task, {
          ...job.options,
          taskId: `scheduled_${job.id}_${Date.now()}`
        });

        if (result.ok) {
          job.status = 'completed';
          job.lastResult = { ok: true, ...result };
          break;
        }

        attempts++;
        if (attempts < maxAttempts) {
          this.emit('job:retry', { id: job.id, attempt: attempts });
          await this._sleep(job.retryDelay);
        }
      } catch (error) {
        attempts++;
        if (attempts < maxAttempts) {
          await this._sleep(job.retryDelay);
        } else {
          job.status = 'failed';
          job.lastResult = { ok: false, error: error.message };
        }
      }
    }

    job.runCount++;
    this._save();

    // Log to history
    this.history.push({
      jobId: job.id,
      jobName: job.name,
      task: job.task,
      ranAt: job.lastRun,
      status: job.status,
      result: job.lastResult
    });
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }

    // Send notification if configured
    if (job.notifyUrl) {
      this._notify(job).catch(() => {});
    }

    this.emit('job:completed', { id: job.id, status: job.status, result: job.lastResult });
  }

  _calculateNextRun(job) {
    if (job.interval) {
      return new Date(Date.now() + job.interval);
    }

    if (job.cron) {
      return this._parseCronNextRun(job.cron);
    }

    return null;
  }

  /**
   * Simple cron parser (supports: minute hour day month weekday)
   * Format: "0 9 * * 1" = Every Monday at 9:00
   */
  _parseCronNextRun(cronStr) {
    const parts = cronStr.trim().split(/\s+/);
    if (parts.length !== 5) return null;

    const [minuteStr, hourStr, dayStr, monthStr, weekdayStr] = parts;
    const now = new Date();

    const minute = minuteStr === '*' ? now.getMinutes() : parseInt(minuteStr);
    const hour = hourStr === '*' ? now.getHours() : parseInt(hourStr);
    const day = dayStr === '*' ? now.getDate() : parseInt(dayStr);
    const month = monthStr === '*' ? now.getMonth() : parseInt(monthStr) - 1;
    const weekday = weekdayStr === '*' ? -1 : parseInt(weekdayStr);

    // Start from now + 1 minute and find next matching time
    let candidate = new Date(now.getTime() + 60000);
    candidate.setSeconds(0, 0);

    for (let i = 0; i < 525600; i++) { // Max 1 year of minutes
      const match = (
        (minuteStr === '*' || candidate.getMinutes() === minute) &&
        (hourStr === '*' || candidate.getHours() === hour) &&
        (dayStr === '*' || candidate.getDate() === day) &&
        (monthStr === '*' || candidate.getMonth() === month) &&
        (weekdayStr === '*' || candidate.getDay() === weekday)
      );

      if (match && candidate > now) {
        return candidate;
      }

      candidate = new Date(candidate.getTime() + 60000);
    }

    return null;
  }

  async _notify(job) {
    try {
      const { default: axios } = await import('axios');
      await axios.post(job.notifyUrl, {
        event: 'job_completed',
        jobId: job.id,
        jobName: job.name,
        status: job.status,
        result: job.lastResult,
        timestamp: new Date().toISOString()
      }, { timeout: 10000 });
    } catch {}
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  _load() {
    try {
      if (fs.existsSync(this.savePath)) {
        const data = JSON.parse(fs.readFileSync(this.savePath, 'utf8'));
        if (data.jobs) {
          for (const job of Object.values(data.jobs)) {
            this.jobs.set(job.id, job);
          }
        }
        if (data.history) {
          this.history = data.history;
        }
      }
    } catch {}
  }

  _save() {
    try {
      const dir = path.dirname(this.savePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.savePath, JSON.stringify({
        jobs: Object.fromEntries(this.jobs),
        history: this.history.slice(-100)
      }, null, 2));
    } catch {}
  }
}

export default TaskScheduler;

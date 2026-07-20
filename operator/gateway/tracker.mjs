/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║          📊 Usage Tracker — v4.0                             ║
 * ║   Cost tracking, token counting, analytics per provider     ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class UsageTracker {
  constructor() {
    this.usage = new Map(); // provider -> { requests, tokens, cost }
    this.history = [];      // Last N requests
    this.maxHistory = 1000;
    this.savePath = path.join(__dirname, '..', '..', 'data', 'usage.json');
    this._load();
  }

  record(providerId, model, usage = {}) {
    const entry = {
      timestamp: Date.now(),
      provider: providerId,
      model,
      promptTokens: usage.prompt_tokens || 0,
      completionTokens: usage.completion_tokens || 0,
      totalTokens: usage.total_tokens || 0
    };

    // Update provider stats
    if (!this.usage.has(providerId)) {
      this.usage.set(providerId, {
        requests: 0, promptTokens: 0, completionTokens: 0,
        totalTokens: 0, estimatedCost: 0
      });
    }
    const stats = this.usage.get(providerId);
    stats.requests++;
    stats.promptTokens += entry.promptTokens;
    stats.completionTokens += entry.completionTokens;
    stats.totalTokens += entry.totalTokens;

    // Estimate cost (rough averages)
    const avgCostPerToken = 0.000005;
    stats.estimatedCost += entry.totalTokens * avgCostPerToken;

    // Add to history
    this.history.push(entry);
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(-this.maxHistory);
    }

    // Auto-save every 10 requests
    if (stats.requests % 10 === 0) {
      this._save();
    }

    return entry;
  }

  getSummary() {
    const providers = {};
    for (const [id, stats] of this.usage) {
      providers[id] = { ...stats, estimatedCost: `$${stats.estimatedCost.toFixed(4)}` };
    }

    const totals = {
      requests: 0, promptTokens: 0, completionTokens: 0,
      totalTokens: 0, estimatedCost: 0
    };
    for (const stats of this.usage.values()) {
      totals.requests += stats.requests;
      totals.promptTokens += stats.promptTokens;
      totals.completionTokens += stats.completionTokens;
      totals.totalTokens += stats.totalTokens;
      totals.estimatedCost += stats.estimatedCost;
    }

    return {
      providers,
      totals: { ...totals, estimatedCost: `$${totals.estimatedCost.toFixed(4)}` },
      recentRequests: this.history.slice(-10)
    };
  }

  getProviderStats(providerId) {
    return this.usage.get(providerId) || null;
  }

  getRecentActivity(limit = 20) {
    return this.history.slice(-limit);
  }

  _load() {
    try {
      if (fs.existsSync(this.savePath)) {
        const data = JSON.parse(fs.readFileSync(this.savePath, 'utf8'));
        if (data.usage) {
          for (const [k, v] of Object.entries(data.usage)) {
            this.usage.set(k, v);
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

      const data = {
        usage: Object.fromEntries(this.usage),
        history: this.history.slice(-100) // Keep last 100 in file
      };
      fs.writeFileSync(this.savePath, JSON.stringify(data, null, 2));
    } catch {}
  }
}

export default UsageTracker;

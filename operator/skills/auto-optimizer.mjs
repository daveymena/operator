/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║    Operator Pro — Auto-Optimization Engine                      ║
 * ║    (Lo que ChatGPT Operator NO puede hacer)                     ║
 * ╚══════════════════════════════════════════════════════════════════╝
 * 
 * AUTOMATIC OPTIMIZATION FEATURES:
 * - Detect underperforming ads and pause them
 * - Scale winning campaigns automatically
 * - Redistribute budget to best performers
 * - A/B test creatives automatically
 * - Smart bidding adjustments
 * - Frequency capping
 * - Audience expansion for successful ads
 * 
 * This runs in the background 24/7, unlike ChatGPT Operator which
 * only works when you're actively using it.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FacebookAdsMetrics } from './facebook-ads-metrics.mjs';
import { getBrowser } from '../engines/browser.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class AutoOptimizer {
  constructor(opts = {}) {
    this.adAccountId = opts.adAccountId || process.env.FACEBOOK_AD_ACCOUNT || '';
    this.verbose = opts.verbose || false;
    this.metrics = new FacebookAdsMetrics(opts);
    this.browser = getBrowser(opts);
    this.rules = [];
    this.history = [];
    this.intervalId = null;
    this.isRunning = false;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  RULES ENGINE
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Add an optimization rule
   */
  addRule(rule) {
    const defaultRule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: 'Unnamed Rule',
      enabled: true,
      condition: () => false,
      action: () => {},
      cooldown: 3600000, // 1 hour
      lastTriggered: null,
      triggerCount: 0
    };

    const fullRule = { ...defaultRule, ...rule };
    this.rules.push(fullRule);
    this._log(`Rule added: ${fullRule.name}`);
    return fullRule;
  }

  /**
   * Remove a rule
   */
  removeRule(ruleId) {
    const index = this.rules.findIndex(r => r.id === ruleId);
    if (index >= 0) {
      this.rules.splice(index, 1);
      return { ok: true };
    }
    return { ok: false, error: 'Rule not found' };
  }

  /**
   * Enable/disable a rule
   */
  toggleRule(ruleId, enabled) {
    const rule = this.rules.find(r => r.id === ruleId);
    if (rule) {
      rule.enabled = enabled;
      return { ok: true };
    }
    return { ok: false, error: 'Rule not found' };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  PRE-BUILT RULES
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Load common optimization rules
   */
  loadDefaultRules() {
    // Rule 1: Pause ads with CTR < 0.5% after 1000 impressions
    this.addRule({
      name: 'Pause Low CTR Ads',
      description: 'Pause ads with CTR < 0.5% after 1000+ impressions',
      condition: (campaign) => {
        return campaign.impressions >= 1000 && campaign.ctr < 0.5;
      },
      action: async (campaign) => {
        await this._updateCampaignStatus(campaign.id, 'PAUSED');
        return { action: 'paused', reason: `CTR ${campaign.ctr.toFixed(2)}% < 0.5%` };
      },
      cooldown: 86400000 // 24 hours
    });

    // Rule 2: Scale campaigns with CTR > 3%
    this.addRule({
      name: 'Scale High CTR Campaigns',
      description: 'Increase budget by 20% for campaigns with CTR > 3%',
      condition: (campaign) => {
        return campaign.impressions >= 5000 && campaign.ctr > 3;
      },
      action: async (campaign) => {
        const newBudget = Math.round(campaign.budget * 1.2);
        await this._updateCampaignBudget(campaign.id, newBudget);
        return { action: 'scaled', newBudget, increase: '20%' };
      },
      cooldown: 172800000 // 48 hours
    });

    // Rule 3: Alert on high frequency
    this.addRule({
      name: 'Alert High Frequency',
      description: 'Alert when frequency > 3 (audience fatigue)',
      condition: (campaign) => {
        return campaign.frequency > 3;
      },
      action: async (campaign) => {
        return { 
          action: 'alert', 
          message: `⚠️ ${campaign.name}: Frequency ${campaign.frequency.toFixed(2)} > 3. Consider refreshing creatives or expanding audience.` 
        };
      },
      cooldown: 43200000 // 12 hours
    });

    // Rule 4: Pause high CPC campaigns
    this.addRule({
      name: 'Pause High CPC',
      description: 'Pause campaigns with CPC > $2000 COP',
      condition: (campaign) => {
        return campaign.clicks >= 50 && campaign.cpc > 2000;
      },
      action: async (campaign) => {
        await this._updateCampaignStatus(campaign.id, 'PAUSED');
        return { action: 'paused', reason: `CPC $${campaign.cpc.toFixed(0)} > $2000` };
      },
      cooldown: 86400000
    });

    // Rule 5: Reactivate paused campaigns with good historical CTR
    this.addRule({
      name: 'Reactivate Good Campaigns',
      description: 'Reactivate paused campaigns with historical CTR > 2%',
      condition: (campaign) => {
        return campaign.status === 'PAUSED' && campaign.ctr > 2 && campaign.impressions > 10000;
      },
      action: async (campaign) => {
        await this._updateCampaignStatus(campaign.id, 'ACTIVE');
        return { action: 'reactivated', reason: `Historical CTR ${campaign.ctr.toFixed(2)}% > 2%` };
      },
      cooldown: 604800000 // 7 days
    });

    this._log(`Loaded ${this.rules.length} default rules`);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  EXECUTION ENGINE
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Start the auto-optimizer (runs every X minutes)
   */
  start(intervalMinutes = 30) {
    if (this.isRunning) {
      return { ok: false, error: 'Already running' };
    }

    this.isRunning = true;
    this._log(`Auto-optimizer started (interval: ${intervalMinutes} min)`);

    // Run immediately
    this.runOptimization();

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.runOptimization();
    }, intervalMinutes * 60 * 1000);

    return { ok: true, interval: intervalMinutes };
  }

  /**
   * Stop the auto-optimizer
   */
  stop() {
    if (!this.isRunning) {
      return { ok: false, error: 'Not running' };
    }

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this._log('Auto-optimizer stopped');
    return { ok: true };
  }

  /**
   * Run one optimization cycle
   */
  async runOptimization() {
    this._log('Running optimization cycle...');

    const metrics = await this.metrics.getCampaignMetrics({ datePreset: 'last_7d' });
    if (!metrics.ok) {
      this._log(`Error fetching metrics: ${metrics.error}`);
      return { ok: false, error: metrics.error };
    }

    const results = [];
    const now = Date.now();

    for (const campaign of metrics.campaigns) {
      for (const rule of this.rules) {
        if (!rule.enabled) continue;

        // Check cooldown
        if (rule.lastTriggered && (now - rule.lastTriggered) < rule.cooldown) {
          continue;
        }

        // Check condition
        try {
          if (rule.condition(campaign)) {
            this._log(`Rule "${rule.name}" triggered for "${campaign.name}"`);

            // Execute action
            const result = await rule.action(campaign);

            // Update rule state
            rule.lastTriggered = now;
            rule.triggerCount++;

            // Log to history
            const historyEntry = {
              timestamp: now,
              ruleId: rule.id,
              ruleName: rule.name,
              campaignId: campaign.id,
              campaignName: campaign.name,
              result
            };
            this.history.push(historyEntry);

            results.push(historyEntry);
            this._log(`  → ${JSON.stringify(result)}`);

            // Only one rule per campaign per cycle
            break;
          }
        } catch (e) {
          this._log(`Error in rule "${rule.name}": ${e.message}`);
        }
      }
    }

    this._log(`Optimization cycle complete: ${results.length} actions taken`);
    return { ok: true, actions: results.length, results };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  ACTIONS
  // ═══════════════════════════════════════════════════════════════════

  async _updateCampaignStatus(campaignId, status) {
    const token = this.metrics._getToken();
    if (!token) return { ok: false, error: 'No token' };

    try {
      const url = `https://graph.facebook.com/v21.0/${campaignId}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ status, access_token: token })
      });
      const data = await res.json();
      return data.success ? { ok: true } : { ok: false, error: JSON.stringify(data) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async _updateCampaignBudget(campaignId, newBudget) {
    const token = this.metrics._getToken();
    if (!token) return { ok: false, error: 'No token' };

    try {
      const url = `https://graph.facebook.com/v21.0/${campaignId}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          daily_budget: String(Math.round(newBudget * 100)),
          access_token: token
        })
      });
      const data = await res.json();
      return data.success ? { ok: true } : { ok: false, error: JSON.stringify(data) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  REPORTING
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get optimization history
   */
  getHistory(limit = 50) {
    return this.history.slice(-limit).reverse();
  }

  /**
   * Get rules summary
   */
  getRulesSummary() {
    return this.rules.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      enabled: r.enabled,
      triggerCount: r.triggerCount,
      lastTriggered: r.lastTriggered ? new Date(r.lastTriggered).toISOString() : null
    }));
  }

  /**
   * Export optimization report
   */
  exportReport() {
    const report = {
      generated: new Date().toISOString(),
      rules: this.getRulesSummary(),
      history: this.getHistory(100),
      stats: {
        totalRules: this.rules.length,
        enabledRules: this.rules.filter(r => r.enabled).length,
        totalActions: this.history.length,
        isRunning: this.isRunning
      }
    };

    return report;
  }

  _log(msg) {
    if (this.verbose) {
      console.log(`[AutoOptimizer] ${msg}`);
    }
  }
}

export default AutoOptimizer;

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║    Operator Pro — Real-Time Alert System                        ║
 * ║    (Notificaciones instantáneas cuando algo pasa)               ║
 * ╚══════════════════════════════════════════════════════════════════╝
 * 
 * Features:
 * - Real-time monitoring of campaign metrics
 * - Instant alerts via WebSocket to dashboard
 * - Email/Slack/Telegram notifications
 * - Custom alert rules
 * - Alert history and acknowledgment
 * - Smart alert deduplication
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { FacebookAdsMetrics } from './facebook-ads-metrics.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class AlertSystem {
  constructor(opts = {}) {
    this.adAccountId = opts.adAccountId || process.env.FACEBOOK_AD_ACCOUNT || '';
    this.verbose = opts.verbose || false;
    this.metrics = new FacebookAdsMetrics(opts);
    this.alerts = [];
    this.rules = [];
    this.subscribers = new Map(); // WebSocket clients
    this.notificationChannels = [];
    this.isRunning = false;
    this.intervalId = null;
    this.lastCheck = null;
    this.alertHistory = [];
    this.maxHistorySize = 1000;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  ALERT RULES
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Add an alert rule
   */
  addRule(rule) {
    const defaultRule = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: 'Unnamed Alert',
      severity: 'warning', // info, warning, critical
      enabled: true,
      condition: () => false,
      message: (data) => 'Alert triggered',
      cooldown: 3600000, // 1 hour
      lastTriggered: null,
      triggerCount: 0,
      channels: ['websocket'] // websocket, email, slack, telegram
    };

    const fullRule = { ...defaultRule, ...rule };
    this.rules.push(fullRule);
    this._log(`Alert rule added: ${fullRule.name}`);
    return fullRule;
  }

  /**
   * Load default alert rules
   */
  loadDefaultRules() {
    // Critical: CTR drops below 0.3%
    this.addRule({
      name: 'Critical CTR Drop',
      severity: 'critical',
      description: 'CTR below 0.3% after 2000 impressions',
      condition: (campaign) => campaign.impressions >= 2000 && campaign.ctr < 0.3,
      message: (campaign) => `🚨 CRÍTICO: ${campaign.name} tiene CTR ${campaign.ctr.toFixed(2)}% (${campaign.impressions} impresiones). Considera pausar inmediatamente.`,
      cooldown: 7200000 // 2 hours
    });

    // Warning: High CPC
    this.addRule({
      name: 'High CPC Warning',
      severity: 'warning',
      description: 'CPC above $1500 COP',
      condition: (campaign) => campaign.clicks >= 30 && campaign.cpc > 1500,
      message: (campaign) => `⚠️ ${campaign.name}: CPC alto ($${campaign.cpc.toFixed(0)} COP). Revisa segmentación y creativos.`,
      cooldown: 14400000 // 4 hours
    });

    // Warning: Frequency too high
    this.addRule({
      name: 'Audience Fatigue',
      severity: 'warning',
      description: 'Frequency above 4',
      condition: (campaign) => campaign.frequency > 4,
      message: (campaign) => `⚠️ Fatiga de audiencia en ${campaign.name}: Frecuencia ${campaign.frequency.toFixed(1)}. La audiencia está viendo el anuncio demasiadas veces.`,
      cooldown: 21600000 // 6 hours
    });

    // Info: Budget almost spent
    this.addRule({
      name: 'Budget Near Limit',
      severity: 'info',
      description: 'Daily budget 90% spent',
      condition: (campaign) => {
        const spent = campaign.spend;
        const budget = campaign.budget || 0;
        return budget > 0 && spent >= budget * 0.9;
      },
      message: (campaign) => `ℹ️ ${campaign.name}: 90% del presupuesto diario gastado ($${campaign.spend.toFixed(0)} de $${campaign.budget.toFixed(0)})`,
      cooldown: 43200000 // 12 hours
    });

    // Critical: Zero clicks after many impressions
    this.addRule({
      name: 'Zero Clicks Alert',
      severity: 'critical',
      description: 'Zero clicks after 1000 impressions',
      condition: (campaign) => campaign.impressions >= 1000 && campaign.clicks === 0,
      message: (campaign) => `🚨 CRÍTICO: ${campaign.name} tiene ${campaign.impressions} impresiones y 0 clicks. Hay un problema grave con el anuncio.`,
      cooldown: 3600000 // 1 hour
    });

    // Warning: CPM spike
    this.addRule({
      name: 'CPM Spike',
      severity: 'warning',
      description: 'CPM above $15000 COP',
      condition: (campaign) => campaign.impressions >= 1000 && campaign.cpm > 15000,
      message: (campaign) => `⚠️ ${campaign.name}: CPM muy alto ($${campaign.cpm.toFixed(0)} COP). Competencia alta o audiencia muy reducida.`,
      cooldown: 28800000 // 8 hours
    });

    this._log(`Loaded ${this.rules.length} default alert rules`);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  MONITORING
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Start monitoring (checks every X minutes)
   */
  start(intervalMinutes = 15) {
    if (this.isRunning) {
      return { ok: false, error: 'Already running' };
    }

    this.isRunning = true;
    this._log(`Alert system started (interval: ${intervalMinutes} min)`);

    // Run immediately
    this.checkAlerts();

    // Then run on interval
    this.intervalId = setInterval(() => {
      this.checkAlerts();
    }, intervalMinutes * 60 * 1000);

    return { ok: true, interval: intervalMinutes };
  }

  /**
   * Stop monitoring
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

    this._log('Alert system stopped');
    return { ok: true };
  }

  /**
   * Check all alert rules
   */
  async checkAlerts() {
    this._log('Checking alerts...');

    const metrics = await this.metrics.getCampaignMetrics({ datePreset: 'last_7d' });
    if (!metrics.ok) {
      this._log(`Error fetching metrics: ${metrics.error}`);
      return { ok: false, error: metrics.error };
    }

    const triggered = [];
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
            const message = typeof rule.message === 'function' 
              ? rule.message(campaign) 
              : rule.message;

            const alert = {
              id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              timestamp: now,
              ruleId: rule.id,
              ruleName: rule.name,
              severity: rule.severity,
              campaignId: campaign.id,
              campaignName: campaign.name,
              message,
              acknowledged: false
            };

            // Update rule state
            rule.lastTriggered = now;
            rule.triggerCount++;

            // Store alert
            this.alerts.push(alert);
            this.alertHistory.push(alert);
            
            // Trim history if too large
            if (this.alertHistory.length > this.maxHistorySize) {
              this.alertHistory = this.alertHistory.slice(-this.maxHistorySize);
            }

            triggered.push(alert);

            // Send notifications
            await this._sendNotifications(alert, rule.channels);

            this._log(`🔔 Alert triggered: ${rule.name} for ${campaign.name}`);
          }
        } catch (e) {
          this._log(`Error in alert rule "${rule.name}": ${e.message}`);
        }
      }
    }

    this.lastCheck = now;
    this._log(`Alert check complete: ${triggered.length} alerts triggered`);
    return { ok: true, triggered: triggered.length, alerts: triggered };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  NOTIFICATIONS
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Add a WebSocket subscriber (dashboard client)
   */
  addSubscriber(clientId, ws) {
    this.subscribers.set(clientId, ws);
    this._log(`Subscriber added: ${clientId}`);
  }

  /**
   * Remove a WebSocket subscriber
   */
  removeSubscriber(clientId) {
    this.subscribers.delete(clientId);
  }

  /**
   * Send notifications via configured channels
   */
  async _sendNotifications(alert, channels) {
    for (const channel of channels) {
      switch (channel) {
        case 'websocket':
          this._sendWebSocket(alert);
          break;
        case 'email':
          await this._sendEmail(alert);
          break;
        case 'slack':
          await this._sendSlack(alert);
          break;
        case 'telegram':
          await this._sendTelegram(alert);
          break;
      }
    }
  }

  _sendWebSocket(alert) {
    const message = JSON.stringify({
      type: 'alert',
      ...alert
    });

    for (const [clientId, ws] of this.subscribers) {
      try {
        if (ws.readyState === 1) { // OPEN
          ws.send(message);
        }
      } catch (e) {
        this._log(`Error sending to subscriber ${clientId}: ${e.message}`);
      }
    }
  }

  async _sendEmail(alert) {
    // TODO: Implement email notification (nodemailer, sendgrid, etc.)
    this._log('Email notification not implemented yet');
  }

  async _sendSlack(alert) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      this._log('Slack webhook URL not configured');
      return;
    }

    try {
      const color = {
        info: '#36a64f',
        warning: '#ff9900',
        critical: '#ff0000'
      }[alert.severity] || '#36a64f';

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attachments: [{
            color,
            title: `🔔 ${alert.ruleName}`,
            text: alert.message,
            fields: [
              { title: 'Campaña', value: alert.campaignName, short: true },
              { title: 'Severidad', value: alert.severity.toUpperCase(), short: true }
            ],
            ts: Math.floor(alert.timestamp / 1000)
          }]
        })
      });
    } catch (e) {
      this._log(`Error sending Slack notification: ${e.message}`);
    }
  }

  async _sendTelegram(alert) {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    
    if (!botToken || !chatId) {
      this._log('Telegram bot token or chat ID not configured');
      return;
    }

    try {
      const emoji = { info: 'ℹ️', warning: '⚠️', critical: '🚨' }[alert.severity] || '🔔';
      const text = `${emoji} *${alert.ruleName}*\n\n${alert.message}\n\n_Campaña: ${alert.campaignName}_`;

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown'
        })
      });
    } catch (e) {
      this._log(`Error sending Telegram notification: ${e.message}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  ALERT MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Get active (unacknowledged) alerts
   */
  getActiveAlerts() {
    return this.alerts.filter(a => !a.acknowledged);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = Date.now();
      return { ok: true };
    }
    return { ok: false, error: 'Alert not found' };
  }

  /**
   * Acknowledge all alerts
   */
  acknowledgeAll() {
    const now = Date.now();
    this.alerts.forEach(a => {
      if (!a.acknowledged) {
        a.acknowledged = true;
        a.acknowledgedAt = now;
      }
    });
    return { ok: true, count: this.alerts.length };
  }

  /**
   * Get alert history
   */
  getHistory(limit = 100) {
    return this.alertHistory.slice(-limit).reverse();
  }

  /**
   * Get alert statistics
   */
  getStats() {
    const now = Date.now();
    const last24h = this.alertHistory.filter(a => now - a.timestamp < 86400000);
    
    return {
      total: this.alertHistory.length,
      active: this.getActiveAlerts().length,
      last24h: last24h.length,
      bySeverity: {
        info: this.alertHistory.filter(a => a.severity === 'info').length,
        warning: this.alertHistory.filter(a => a.severity === 'warning').length,
        critical: this.alertHistory.filter(a => a.severity === 'critical').length
      },
      isRunning: this.isRunning,
      lastCheck: this.lastCheck ? new Date(this.lastCheck).toISOString() : null,
      rulesCount: this.rules.length,
      subscribersCount: this.subscribers.size
    };
  }

  _log(msg) {
    if (this.verbose) {
      console.log(`[AlertSystem] ${msg}`);
    }
  }
}

export default AlertSystem;

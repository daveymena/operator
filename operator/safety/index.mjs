/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║          🛡️ Watch Mode & Safety System — v4.0                ║
 * ║   Monitors sensitive operations, blocks dangerous actions,  ║
 * ║   requires confirmation for irreversible operations         ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Features:
 * - URL category detection (financial, social, admin, etc.)
 * - Action approval for irreversible operations
 * - Audit trail logging
 * - Rate limiting for sensitive domains
 * - PII detection in outbound data
 * - Screenshot redaction for sensitive pages
 */

import { EventEmitter } from 'events';

// ─── URL Categories ───────────────────────────────────────────────────────────

const URL_CATEGORIES = {
  financial: {
    patterns: [
      /banking/i, /banco/i, /paypal/i, /stripe/i, /venmo/i, /cashapp/i,
      /transfer.?wise/i, /revolut/i, /mercadopago/i, /nequi/i, /daviplata/i,
      /bancolombia/i, /davivienda/i, /bbva/i, /scotiabank/i,
      /checkout/i, /payment/i, /billing/i, /invoice/i
    ],
    level: 'high',
    description: 'Financial services — requires user presence (Watch Mode)',
    autoConfirm: false
  },
  social: {
    patterns: [
      /facebook\.com/i, /twitter\.com/i, /x\.com/i, /instagram\.com/i,
      /linkedin\.com/i, /tiktok\.com/i, /whatsapp\.com/i, /telegram\.org/i
    ],
    level: 'medium',
    description: 'Social media — post/message actions need confirmation',
    autoConfirm: false
  },
  admin: {
    patterns: [
      /admin/i, /dashboard/i, /manage/i, /console/i, /control.?panel/i,
      /aws\.amazon/i, /cloud\.google/i, /azure\.microsoft/i,
      /heroku/i, /vercel/i, /netlify/i
    ],
    level: 'high',
    description: 'Admin panels — destructive actions need confirmation',
    autoConfirm: false
  },
  email: {
    patterns: [
      /gmail\.com/i, /outlook\.com/i, /mail\.google/i, /protonmail/i,
      /yahoo\.com\/mail/i
    ],
    level: 'high',
    description: 'Email — sending emails needs confirmation',
    autoConfirm: false
  },
  commerce: {
    patterns: [
      /amazon\.com/i, /ebay\.com/i, /shopify/i, /mercadolibre/i,
      /aliexpress/i, /etsy\.com/i, /walmart\.com/i
    ],
    level: 'medium',
    description: 'E-commerce — purchase actions need confirmation',
    autoConfirm: false
  },
  government: {
    patterns: [
      /gov\./i, /gob\./i, /mvd/i, /dian/i, /procuraduria/i, /policia/i
    ],
    level: 'critical',
    description: 'Government sites — all actions need confirmation',
    autoConfirm: false
  }
};

// ─── Dangerous Action Patterns ────────────────────────────────────────────────

const DANGEROUS_ACTIONS = {
  terminal: {
    critical: [
      { pattern: /rm\s+-rf\s+\//i, description: 'Recursive root delete', block: true },
      { pattern: /format\s+[a-z]:/i, description: 'Disk format', block: true },
      { pattern: /mkfs\./i, description: 'Filesystem format', block: true },
      { pattern: /dd\s+if=.*of=\/dev/i, description: 'Raw disk write', block: true },
      { pattern: /:\(\)\s*\{\s*:\|:\s*&\s*\}\s*;/, description: 'Fork bomb', block: true },
    ],
    high: [
      { pattern: /shutdown/i, description: 'System shutdown', block: false },
      { pattern: /reboot/i, description: 'System reboot', block: false },
      { pattern: /poweroff/i, description: 'System poweroff', block: false },
      { pattern: /kill\s+-9\s+0/i, description: 'Kill all processes', block: true },
      { pattern: /drop\s+database/i, description: 'Drop database', block: false },
      { pattern: /truncate\s+table/i, description: 'Truncate table', block: false },
      { pattern: /rm\s+-rf\s+/i, description: 'Recursive force delete', block: false },
    ],
    medium: [
      { pattern: /git\s+push\s+--force/i, description: 'Force push', block: false },
      { pattern: /npm\s+publish/i, description: 'Publish package', block: false },
      { pattern: /docker\s+rm/i, description: 'Remove container', block: false },
    ]
  },
  browser: {
    critical: [
      { pattern: /type.*password/i, description: 'Entering password', block: false },
      { pattern: /type.*credit.?card/i, description: 'Entering credit card', block: false },
      { pattern: /type.*ssn/i, description: 'Entering SSN', block: true },
    ],
    high: [
      { pattern: /click.*submit.*order/i, description: 'Submitting order', block: false },
      { pattern: /click.*send.*message/i, description: 'Sending message', block: false },
      { pattern: /click.*delete.*account/i, description: 'Deleting account', block: true },
    ]
  }
};

// ─── PII Detection Patterns ──────────────────────────────────────────────────

const PII_PATTERNS = [
  { pattern: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, type: 'phone' },
  { pattern: /\b\d{3}[-.]\d{2}[-.]\d{4}\b/g, type: 'ssn' },
  { pattern: /\b\d{4}[-.]?\d{4}[-.]?\d{4}[-.]?\d{4}\b/g, type: 'credit_card' },
  { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, type: 'email' },
];

// ─── Safety System ────────────────────────────────────────────────────────────

export class SafetySystem extends EventEmitter {
  constructor(config = {}) {
    super();
    this.enabled = config.safety !== false;
    this.watchMode = config.watchMode || false;
    this.autoConfirm = config.autoConfirm || false;
    this.auditLog = [];
    this.maxAuditLog = 10000;
    this.pendingConfirmations = new Map(); // id -> { action, resolve, reject, timeout }
  }

  /**
   * Check if an action is safe to execute
   * @param {Object} action - The action to check
   * @returns {Object} { safe, level, reason, requiresConfirmation, blocked }
   */
  checkAction(action) {
    if (!this.enabled) return { safe: true, level: 'none', reason: 'Safety disabled' };

    const result = { safe: true, level: 'none', reason: '', requiresConfirmation: false, blocked: false };

    // Check terminal commands
    if (action.type === 'terminal_exec' || action.type === 'terminal') {
      const cmd = action.params?.command || action.params?.cmd || '';
      const check = this._checkTerminalCommand(cmd);
      if (check) {
        result.safe = !check.block && (this.autoConfirm || !check.block);
        result.level = check.level;
        result.reason = check.description;
        result.requiresConfirmation = !check.block && !this.autoConfirm;
        result.blocked = check.block;
      }
    }

    // Check browser actions
    if (action.type?.startsWith('browser_')) {
      const url = action.params?.url || '';
      const check = this._checkBrowserAction(action, url);
      if (check) {
        result.level = check.level;
        result.reason = check.description;
        result.requiresConfirmation = !this.autoConfirm && check.level !== 'low';
        result.safe = !check.block && (this.autoConfirm || !check.requiresConfirmation);
        result.blocked = check.block;
      }
    }

    // Check for PII in data
    if (action.params?.text || action.params?.content) {
      const text = action.params.text || action.params.content;
      const piiFound = this._detectPII(text);
      if (piiFound.length > 0) {
        result.piiDetected = piiFound;
        result.level = 'medium';
        result.reason = `PII detected: ${piiFound.map(p => p.type).join(', ')}`;
      }
    }

    // Log the action
    this._auditLog(action, result);

    // Emit event
    if (result.level !== 'none') {
      this.emit('safety:alert', { action, result });
    }

    return result;
  }

  /**
   * Check a URL and return its category
   */
  checkURL(url) {
    for (const [category, config] of Object.entries(URL_CATEGORIES)) {
      for (const pattern of config.patterns) {
        if (pattern.test(url)) {
          return {
            category,
            level: config.level,
            description: config.description,
            autoConfirm: config.autoConfirm,
            watchMode: this.watchMode
          };
        }
      }
    }
    return { category: 'general', level: 'low', description: 'General website', autoConfirm: true, watchMode: false };
  }

  /**
   * Request user confirmation for an action
   * Returns a promise that resolves with true (confirm) or false (deny)
   */
  requestConfirmation(action, reason) {
    return new Promise((resolve, reject) => {
      if (this.autoConfirm) {
        resolve(true);
        return;
      }

      const id = `confirm_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const timeout = setTimeout(() => {
        this.pendingConfirmations.delete(id);
        resolve(false); // Deny on timeout
      }, 120000); // 2 minute timeout

      this.pendingConfirmations.set(id, { action, resolve, timeout });
      this.emit('safety:confirmation', { id, action, reason });
    });
  }

  /**
   * Respond to a confirmation request
   */
  confirmAction(id, approved) {
    const pending = this.pendingConfirmations.get(id);
    if (!pending) return false;

    clearTimeout(pending.timeout);
    this.pendingConfirmations.delete(id);
    pending.resolve(approved);
    return true;
  }

  /**
   * Get audit log
   */
  getAuditLog(limit = 100) {
    return this.auditLog.slice(-limit);
  }

  // ─── Internal Checks ─────────────────────────────────────────────────────

  _checkTerminalCommand(cmd) {
    for (const level of ['critical', 'high', 'medium']) {
      for (const rule of DANGEROUS_ACTIONS.terminal[level] || []) {
        if (rule.pattern.test(cmd)) {
          return { level, description: rule.description, block: rule.block };
        }
      }
    }
    return null;
  }

  _checkBrowserAction(action, url) {
    // Check URL category
    if (url) {
      const category = this.checkURL(url);
      if (category.level !== 'low') {
        return category;
      }
    }

    // Check for dangerous browser patterns
    const actionStr = JSON.stringify(action);
    for (const level of ['critical', 'high']) {
      for (const rule of DANGEROUS_ACTIONS.browser[level] || []) {
        if (rule.pattern.test(actionStr)) {
          return { level, description: rule.description, block: rule.block };
        }
      }
    }
    return null;
  }

  _detectPII(text) {
    const found = [];
    for (const { pattern, type } of PII_PATTERNS) {
      if (pattern.test(text)) {
        found.push({ type, pattern: pattern.source });
      }
      pattern.lastIndex = 0; // Reset regex
    }
    return found;
  }

  _auditLog(action, result) {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: { type: action.type, params: action.params ? '...' : undefined },
      result: { safe: result.safe, level: result.level, reason: result.reason, blocked: result.blocked }
    });
    if (this.auditLog.length > this.maxAuditLog) {
      this.auditLog = this.auditLog.slice(-this.maxAuditLog);
    }
  }
}

// Singleton
let _safety = null;

export function getSafety(config) {
  if (!_safety) _safety = new SafetySystem(config);
  return _safety;
}

export default SafetySystem;

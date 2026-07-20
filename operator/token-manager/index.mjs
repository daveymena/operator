/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║      🔄 Token Manager — Auto-renewal & Rotation             ║
 * ║                                                              ║
 * ║   • Detecta cuando los tokens de OpenCode Zen se agotan     ║
 * ║   • Renueva automáticamente creando nuevos tokens           ║
 * ║   • Rota entre múltiples API keys por proveedor             ║
 * ║   • Reinicia el servidor cuando es necesario                ║
 * ║   • Persiste todo en la base de datos SQLite                ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Flujo de Auto-Renovación:
 * ┌─────────────┐    429/403     ┌──────────────┐
 * │ Request con  │──────────────►│ Token marcado │
 * │ token activo │               │ como exhausted│
 * └─────────────┘               └──────┬───────┘
 *                                       │
 *                                ┌──────▼───────┐
 *                                │ ¿Hay otro    │
 *                                │ token activo? │
 *                                └──┬────────┬──┘
 *                                   │ Sí     │ No
 *                            ┌──────▼──┐  ┌──▼──────────┐
 *                            │ Rotar al │  │ Auto-renew   │
 *                            │ sig. key │  │ (nuevo token)│
 *                            └─────────┘  └──┬──────────┘
 *                                            │
 *                                    ┌───────▼────────┐
 *                                    │ ¿Se pudo renovar│
 *                                    │ automáticamente? │
 *                                    └──┬──────────┬───┘
 *                                       │ No       │ Sí
 *                                ┌──────▼────┐  ┌──▼──────┐
 *                                │ Restart   │  │ Reactivar│
 *                                │ servidor  │  │ tokens   │
 *                                └───────────┘  └─────────┘
 */

import { EventEmitter } from 'events';
import { getDatabase } from '../db/index.mjs';
import axios from 'axios';

export class TokenManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.db = null;
    this.verbose = config.verbose || false;
    this.healthCheckInterval = config.healthCheckInterval || 60000; // 1 min
    this.renewalCooldown = config.renewalCooldown || 300000; // 5 min
    this.lastRenewalAttempt = new Map(); // provider -> timestamp
    this.healthTimer = null;
    this.running = false;
  }

  async init() {
    this.db = await getDatabase();
    await this._loadTokensFromEnv();
    this._log('Token Manager initialized');
    return this;
  }

  start() {
    if (this.running) return;
    this.running = true;

    // Health check every minute
    this.healthTimer = setInterval(() => this._healthCheck(), this.healthCheckInterval);
    this._log('Health monitoring started');
    this.emit('manager:started');
  }

  stop() {
    if (this.healthTimer) clearInterval(this.healthTimer);
    this.running = false;
    this._log('Health monitoring stopped');
  }

  // ─── Token Selection ──────────────────────────────────────────────────

  /**
   * Get the best available token for a provider
   */
  getToken(provider) {
    const token = this.db.getTokenForUse(provider);
    if (!token) {
      this.emit('token:exhausted', { provider });
      this._log(`No active tokens for ${provider}!`);
      return null;
    }
    return {
      id: token.id,
      key: token.api_key,
      provider: token.provider,
      label: token.key_label,
      used: token.daily_used,
      limit: token.daily_limit,
      totalUsed: token.total_used
    };
  }

  /**
   * Report token usage result
   */
  async reportResult(tokenId, result) {
    const { success, tokensUsed = 0, cost = 0, error = null, httpStatus = null } = result;

    this.db.recordTokenUsage(tokenId, success, tokensUsed, cost, error);

    if (!success) {
      // Handle rate limits and auth errors
      if (httpStatus === 429) {
        this._log(`Token ${tokenId} rate limited`);
        this.db.markTokenExhausted(tokenId, 'rate_limited');
        this.emit('token:rate_limited', { tokenId, provider: this._getProviderForToken(tokenId) });

        // Try to find alternative
        await this._handleExhaustion(tokenId);
      } else if (httpStatus === 401 || httpStatus === 403) {
        this._log(`Token ${tokenId} auth error`);
        this.db.markTokenExhausted(tokenId, 'auth_error');
        this.emit('token:auth_error', { tokenId });

        // Try auto-renewal for this provider
        await this._handleExhaustion(tokenId);
      }
    }
  }

  // ─── Auto-Renewal ──────────────────────────────────────────────────────

  /**
   * Handle token exhaustion - try rotation, then renewal
   */
  async _handleExhaustion(exhaustedTokenId) {
    const token = this.db.get(`SELECT * FROM tokens WHERE id = ?`, [exhaustedTokenId]);
    if (!token) return;

    const provider = token.provider;
    this._log(`Handling exhaustion for ${provider} (token ${exhaustedTokenId})`);

    // Step 1: Check if there are other active tokens for this provider
    const activeTokens = this.db.getActiveTokens(provider);

    if (activeTokens.length > 0) {
      this._log(`Rotating to next token for ${provider} (${activeTokens.length} available)`);
      this.emit('token:rotated', { provider, from: exhaustedTokenId, to: activeTokens[0].id });
      return; // Other tokens available, rotation handled
    }

    // Step 2: All tokens exhausted - try auto-renewal
    this._log(`All tokens exhausted for ${provider}! Attempting auto-renewal...`);
    this.emit('provider:exhausted', { provider });

    const renewed = await this._attemptAutoRenewal(provider);

    if (renewed) {
      this._log(`✅ ${provider} tokens renewed successfully!`);
      this.emit('provider:renewed', { provider });

      // Reactivate all tokens for this provider (new day, limits reset)
      const allProviderTokens = this.db.all(`SELECT id FROM tokens WHERE provider = ?`, [provider]);
      for (const t of allProviderTokens) {
        this.db.reactivateToken(t.id);
      }
    } else {
      this._log(`❌ Could not auto-renew ${provider}. Need manual intervention.`);
      this.emit('provider:renewal_failed', { provider });

      // Step 3: Restart server to force fresh initialization
      this._log(`Restarting server to reinitialize tokens...`);
      this.emit('server:restart_needed', { provider, reason: 'all_tokens_exhausted' });
    }
  }

  /**
   * Attempt automatic token renewal
   */
  async _attemptAutoRenewal(provider) {
    // Check cooldown
    const lastAttempt = this.lastRenewalAttempt.get(provider) || 0;
    if (Date.now() - lastAttempt < this.renewalCooldown) {
      this._log(`Renewal for ${provider} on cooldown (last: ${Date.now() - lastAttempt}ms ago)`);
      return false;
    }

    this.lastRenewalAttempt.set(provider, Date.now());

    switch (provider) {
      case 'opencode-zen':
        return await this._renewOpenCodeZen();
      case 'gmi':
        return await this._renewGMICloud();
      default:
        // For other providers, try resetting daily limits
        return this._resetDailyLimits(provider);
    }
  }

  /**
   * Renew OpenCode Zen tokens
   *
   * Strategy:
   * 1. Try to refresh existing session
   * 2. Check if limits have reset (new day)
   * 3. Try alternative free models
   * 4. Fall back to other providers
   */
  async _renewOpenCodeZen() {
    this._log('Attempting OpenCode Zen renewal...');

    try {
      // Step 1: Try a test request to see if limits have reset
      const tokens = this.db.getActiveTokens('opencode-zen');
      if (tokens.length === 0) {
        // No keys at all - try loading from env again
        const envKey = process.env.OPENCODE_ZEN_API_KEY;
        if (envKey) {
          this.db.addToken('opencode-zen', envKey, 'env-key', true);
          this._log('Reloaded OpenCode Zen key from environment');
          return true;
        }
      }

      // Step 2: Test if any existing key works again
      const allKeys = this.db.all(`SELECT * FROM tokens WHERE provider = 'opencode-zen'`);

      for (const token of allKeys) {
        try {
          const response = await axios.post(
            'https://opencode.ai/zen/v1/chat/completions',
            {
              model: 'big-pickle',
              messages: [{ role: 'user', content: 'ping' }],
              max_tokens: 5
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token.api_key}`
              },
              timeout: 15000
            }
          );

          if (response.status === 200) {
            // Key works again! Reactivate it
            this.db.reactivateToken(token.id);
            this._log(`OpenCode Zen token ${token.id} reactivated (limits reset)`);
            return true;
          }
        } catch (error) {
          if (error.response?.status === 429) {
            // Still rate limited, try next
            continue;
          }
          if (error.response?.status === 401) {
            // Key is invalid, mark it
            this.db.markTokenExhausted(token.id, 'auth_error');
            continue;
          }
        }
      }

      // Step 3: All Zen keys still exhausted - try Go plan
      const goKey = process.env.OPENCODE_GO_API_KEY;
      if (goKey) {
        const goTokens = this.db.getActiveTokens('opencode-go');
        if (goTokens.length === 0) {
          this.db.addToken('opencode-go', goKey, 'env-key-fallback', true);
          this._log('Activated OpenCode Go as fallback');
        }
        return true;
      }

      // Step 4: Try free alternative providers
      return this._activateFallbackProviders();

    } catch (error) {
      this._log(`OpenCode Zen renewal error: ${error.message}`);
      return false;
    }
  }

  /**
   * Renew GMI Cloud tokens
   */
  async _renewGMICloud() {
    this._log('Attempting GMI Cloud renewal...');

    // GMI doesn't have free tier rotation, but we can check if limits reset
    const gmiKey = process.env.GMI_API_KEY;
    if (gmiKey) {
      try {
        const response = await axios.get('https://api.gmi-serving.com/v1/models', {
          headers: { 'Authorization': `Bearer ${gmiKey}` },
          timeout: 10000
        });

        if (response.status === 200) {
          const allGMi = this.db.all(`SELECT id FROM tokens WHERE provider = 'gmi'`);
          for (const t of allGMi) {
            this.db.reactivateToken(t.id);
          }
          this._log('GMI Cloud tokens reactivated');
          return true;
        }
      } catch (error) {
        this._log(`GMI Cloud test failed: ${error.message}`);
      }
    }

    return this._activateFallbackProviders();
  }

  /**
   * Reset daily limits for a provider (new day, limits should reset)
   */
  _resetDailyLimits(provider) {
    const today = new Date().toISOString().slice(0, 10);
    const tokens = this.db.all(`SELECT id, daily_reset FROM tokens WHERE provider = ?`, [provider]);

    for (const token of tokens) {
      if (token.daily_reset !== today) {
        this.db.reactivateToken(token.id);
        this._log(`Reset daily limits for ${provider} token ${token.id}`);
      }
    }

    return tokens.length > 0;
  }

  /**
   * Activate fallback providers when primary is exhausted
   */
  async _activateFallbackProviders() {
    const fallbackOrder = [
      { provider: 'copilot', envKey: 'GITHUB_COPILOT_TOKEN' },
      { provider: 'gemini', envKey: 'GOOGLE_API_KEY' },
      { provider: 'nous', envKey: 'NOUS_API_KEY' },
      { provider: 'deepseek', envKey: 'DEEPSEEK_API_KEY' },
      { provider: 'nvidia', envKey: 'NVIDIA_API_KEY' },
      { provider: 'freemodel', envKey: 'FREEMODEL_API_KEY' },
      { provider: 'huggingface', envKey: 'HF_TOKEN' },
    ];

    for (const fb of fallbackOrder) {
      const key = process.env[fb.envKey];
      if (key) {
        const existing = this.db.getActiveTokens(fb.provider);
        if (existing.length === 0) {
          this.db.addToken(fb.provider, key, 'auto-fallback', false);
          this._log(`Activated fallback provider: ${fb.provider}`);
          this.emit('provider:fallback', { provider: fb.provider });
          return true;
        }
      }
    }

    return false;
  }

  // ─── Health Check ──────────────────────────────────────────────────────

  async _healthCheck() {
    if (!this.running) return;

    const providers = this.db.all(`SELECT DISTINCT provider FROM tokens WHERE is_active = 1`);

    for (const { provider } of providers) {
      const token = this.db.getTokenForUse(provider);
      if (!token) continue;

      try {
        // Quick health check ping
        const testUrl = provider === 'opencode-zen'
          ? 'https://opencode.ai/zen/v1/models'
          : provider === 'gmi'
            ? 'https://api.gmi-serving.com/v1/models'
            : null;

        if (testUrl) {
          const response = await axios.get(testUrl, {
            headers: { 'Authorization': `Bearer ${token.api_key}` },
            timeout: 10000
          });

          if (response.status === 200) {
            this.emit('provider:healthy', { provider });
          }
        }
      } catch (error) {
        const status = error.response?.status;
        if (status === 429 || status === 401 || status === 403) {
          this.db.markTokenExhausted(token.id, status === 429 ? 'rate_limited' : 'auth_error');
          this.emit('provider:degraded', { provider, status });
          await this._handleExhaustion(token.id);
        }
      }
    }

    // Check if all primary providers are down
    const primaryProviders = ['opencode-zen', 'gmi'];
    const activePrimary = primaryProviders.filter(p => {
      const tokens = this.db.getActiveTokens(p);
      return tokens.length > 0;
    });

    if (activePrimary.length === 0 && primaryProviders.length > 0) {
      this._log('⚠️ All primary providers exhausted!');
      this.emit('all:exhausted', { providers: primaryProviders });
    }
  }

  // ─── Token Loading ─────────────────────────────────────────────────────

  async _loadTokensFromEnv() {
    const envMappings = [
      { provider: 'opencode-zen', key: 'OPENCODE_ZEN_API_KEY', label: 'Zen Primary', primary: true },
      { provider: 'opencode-zen', key: 'OPENCODE_ZEN_API_KEY_2', label: 'Zen Backup 2' },
      { provider: 'opencode-zen', key: 'OPENCODE_ZEN_API_KEY_3', label: 'Zen Backup 3' },
      { provider: 'opencode-go', key: 'OPENCODE_GO_API_KEY', label: 'Go Primary', primary: true },
      { provider: 'gmi', key: 'GMI_API_KEY', label: 'GMI Primary', primary: true },
      { provider: 'copilot', key: 'GITHUB_COPILOT_TOKEN', label: 'Copilot' },
      { provider: 'nvidia', key: 'NVIDIA_API_KEY', label: 'NVIDIA' },
      { provider: 'anthropic', key: 'ANTHROPIC_API_KEY', label: 'Anthropic' },
      { provider: 'openai', key: 'OPENAI_API_KEY', label: 'OpenAI' },
      { provider: 'gemini', key: 'GOOGLE_API_KEY', label: 'Gemini' },
      { provider: 'deepseek', key: 'DEEPSEEK_API_KEY', label: 'DeepSeek' },
      { provider: 'zai', key: 'GLM_API_KEY', label: 'Z.AI' },
      { provider: 'kimi', key: 'KIMI_API_KEY', label: 'Kimi' },
      { provider: 'xiaomi', key: 'XIAOMI_API_KEY', label: 'MiMo' },
      { provider: 'minimax', key: 'MINIMAX_API_KEY', label: 'MiniMax' },
      { provider: 'huggingface', key: 'HF_TOKEN', label: 'HuggingFace' },
      { provider: 'xai', key: 'XAI_API_KEY', label: 'xAI' },
      { provider: 'alibaba', key: 'DASHSCOPE_API_KEY', label: 'DashScope' },
      { provider: 'nous', key: 'NOUS_API_KEY', label: 'Nous' },
      { provider: 'freemodel', key: 'FREEMODEL_API_KEY', label: 'FreeModel' },
    ];

    let loaded = 0;
    for (const mapping of envMappings) {
      const envValue = process.env[mapping.key];
      if (!envValue) continue;

      // Handle comma-separated keys
      const keys = envValue.split(',').map(k => k.trim()).filter(Boolean);

      for (const apiKey of keys) {
        // Check if already in DB
        const existing = this.db.get(`SELECT id FROM tokens WHERE api_key = ?`, [apiKey]);
        if (existing) continue;

        this.db.addToken(mapping.provider, apiKey, mapping.label, mapping.primary || false);
        loaded++;
      }
    }

    if (loaded > 0) {
      this._log(`Loaded ${loaded} new tokens from environment`);
    }
  }

  // ─── Status ────────────────────────────────────────────────────────────

  getStatus() {
    const stats = this.db.getTokenStats();
    const activeTokens = this.db.getActiveTokens();

    const byProvider = {};
    for (const token of activeTokens) {
      if (!byProvider[token.provider]) {
        byProvider[token.provider] = { active: 0, totalUsed: 0, healthy: true };
      }
      byProvider[token.provider].active++;
      byProvider[token.provider].totalUsed += token.total_used;
    }

    return {
      running: this.running,
      providers: byProvider,
      totalActive: activeTokens.length,
      stats
    };
  }

  // ─── Utility ───────────────────────────────────────────────────────────

  _getProviderForToken(tokenId) {
    const token = this.db.get(`SELECT provider FROM tokens WHERE id = ?`, [tokenId]);
    return token?.provider || 'unknown';
  }

  _log(...args) {
    if (this.verbose) {
      console.log(`[TOKEN-MGR]`, ...args);
    } else {
      console.log(`[TOKEN-MGR]`, ...args);
    }
  }
}

export default TokenManager;

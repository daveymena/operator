/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║      🔄 Auto-Restart Manager — Server Recovery              ║
 * ║                                                              ║
 * ║   Cuando todos los tokens se agotan:                        ║
 * ║   1. Espera cooldown                                        ║
 * ║   2. Renueva tokens si es posible                           ║
 * ║   3. Reinicia componentes del servidor                      ║
 * ║   4. Si no se puede renovar → reinicia proceso completo     ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { EventEmitter } from 'events';
import { getDatabase } from '../db/index.mjs';
import { TokenManager } from '../token-manager/index.mjs';

export class AutoRestartManager extends EventEmitter {
  constructor(config = {}) {
    super();
    this.restartCooldown = config.restartCooldown || 300000; // 5 min
    this.maxRestartAttempts = config.maxRestartAttempts || 5;
    this.restartAttempts = 0;
    this.lastRestart = 0;
    this.serverRef = null;
    this.tokenManager = null;
    this.running = false;
  }

  /**
   * Initialize with server reference
   */
  init(server, tokenManager) {
    this.serverRef = server;
    this.tokenManager = tokenManager;

    // Listen for exhaustion events
    this.tokenManager.on('server:restart_needed', async (data) => {
      await this.handleRestartNeeded(data);
    });

    this.tokenManager.on('all:exhausted', async (data) => {
      await this.handleAllExhausted(data);
    });

    this.running = true;
    console.log('[AUTO-RESTART] Initialized and monitoring');
    return this;
  }

  /**
   * Handle restart needed event
   */
  async handleRestartNeeded(data) {
    const { provider, reason } = data;

    console.log(`[AUTO-RESTART] Restart needed: ${provider} (${reason})`);

    // Check cooldown
    const now = Date.now();
    if (now - this.lastRestart < this.restartCooldown) {
      console.log(`[AUTO-RESTART] On cooldown. Next restart in ${Math.ceil((this.restartCooldown - (now - this.lastRestart)) / 1000)}s`);
      return;
    }

    // Check max attempts
    if (this.restartAttempts >= this.maxRestartAttempts) {
      console.log(`[AUTO-RESTART] Max restart attempts reached (${this.maxRestartAttempts}). Manual intervention required.`);
      this.emit('restart:failed', { attempts: this.restartAttempts, provider, reason });
      return;
    }

    await this._attemptRestart(provider, reason);
  }

  /**
   * Handle all providers exhausted
   */
  async handleAllExhausted(data) {
    console.log(`[AUTO-RESTART] ALL PROVIDERS EXHAUSTED: ${data.providers.join(', ')}`);

    // Try to activate any fallback providers
    const renewed = await this.tokenManager._activateFallbackProviders();

    if (renewed) {
      console.log('[AUTO-RESTART] Fallback providers activated');
      this.emit('restart:recovered', { method: 'fallback' });
      return;
    }

    // No fallbacks available - schedule a full restart
    console.log('[AUTO-RESTART] No fallbacks available. Scheduling process restart...');
    this._scheduleProcessRestart();
  }

  /**
   * Attempt a graceful restart
   */
  async _attemptRestart(provider, reason) {
    this.restartAttempts++;
    this.lastRestart = Date.now();

    console.log(`[AUTO-RESTART] Attempt ${this.restartAttempts}/${this.maxRestartAttempts}...`);

    this.emit('restart:attempt', { attempt: this.restartAttempts, provider, reason });

    try {
      // Step 1: Try to renew tokens
      const renewed = await this.tokenManager._attemptAutoRenewal(provider);

      if (renewed) {
        console.log(`[AUTO-RESTART] ✅ Tokens renewed for ${provider}`);
        this.restartAttempts = 0; // Reset on success

        // Step 2: Reload server components
        if (this.serverRef) {
          // Reinitialize gateway if it exists
          if (this.serverRef.gateway?.init) {
            await this.serverRef.gateway.init();
          }
          console.log('[AUTO-RESTART] Server components reloaded');
        }

        this.emit('restart:success', { provider, method: 'token_renewal' });
        return;
      }

      // Step 3: Try waiting and checking again
      console.log(`[AUTO-RESTART] Renewal failed. Waiting 60s before next check...`);
      await this._sleep(60000);

      // Check if tokens have become available (daily reset, etc.)
      const db = await getDatabase();
      const activeTokens = db.getActiveTokens(provider);

      if (activeTokens.length > 0) {
        console.log(`[AUTO-RESTART] ✅ Tokens available after wait for ${provider}`);
        this.restartAttempts = 0;
        this.emit('restart:success', { provider, method: 'wait_and_check' });
        return;
      }

      // Step 4: Full process restart
      this._scheduleProcessRestart();

    } catch (error) {
      console.error(`[AUTO-RESTART] Error during restart:`, error.message);
      this.emit('restart:error', { error: error.message });
    }
  }

  /**
   * Schedule a full process restart
   * Uses process.exit with a code that Docker/systemd/pm2 will auto-restart
   */
  _scheduleProcessRestart() {
    console.log('[AUTO-RESTART] Scheduling full process restart in 30s...');
    console.log('[AUTO-RESTART] The process will exit with code 1.');
    console.log('[AUTO-RESTART] Ensure Docker restart policy or pm2 is configured to auto-restart.');

    this.emit('restart:scheduled', { method: 'process_restart' });

    setTimeout(() => {
      console.log('[AUTO-RESTART] 🔄 Restarting process now...');
      process.exit(1); // Docker/pm2/systemd will auto-restart
    }, 30000);
  }

  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStatus() {
    return {
      running: this.running,
      restartAttempts: this.restartAttempts,
      maxRestartAttempts: this.maxRestartAttempts,
      lastRestart: this.lastRestart ? new Date(this.lastRestart).toISOString() : null,
      nextRestartIn: this.lastRestart ? Math.max(0, this.restartCooldown - (Date.now() - this.lastRestart)) : 0
    };
  }
}

export default AutoRestartManager;

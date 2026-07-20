/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║     🤖 Operator Pro v4.0 — Dashboard Application            ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const API_BASE = window.location.origin;
const WS_URL = `ws://${window.location.host}/ws`;

class OperatorApp {
  constructor() {
    this.ws = null;
    this.token = localStorage.getItem('operator_token');
    this.models = [];
    this.tasks = [];
    this.reconnectAttempts = 0;
    this.maxReconnect = 10;

    this.init();
  }

  init() {
    this.connectWebSocket();
    this.setupNavigation();
    this.loadOverview();
  }

  // ─── WebSocket ──────────────────────────────────────────────────────────

  connectWebSocket() {
    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.updateConnectionStatus(true);
        console.log('[WS] Connected');
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleWSMessage(msg);
        } catch (e) {
          console.error('[WS] Parse error:', e);
        }
      };

      this.ws.onclose = () => {
        this.updateConnectionStatus(false);
        this.reconnectAttempts++;
        if (this.reconnectAttempts < this.maxReconnect) {
          setTimeout(() => this.connectWebSocket(), 3000);
        }
      };

      this.ws.onerror = () => {
        this.updateConnectionStatus(false);
      };
    } catch {
      this.updateConnectionStatus(false);
    }
  }

  handleWSMessage(msg) {
    switch (msg.type) {
      case 'connected':
        console.log('[WS] Server version:', msg.version);
        break;
      case 'confirmation_required':
        this.showConfirmation(msg);
        break;
      case 'research_progress':
        this.updateResearchProgress(msg);
        break;
      case 'research_complete':
        this.showResearchResult(msg.result);
        break;
      case 'watch_mode':
        this.showWatchModeAlert(msg);
        break;
      case 'task_result':
        this.refreshTasks();
        break;
      case 'chat_response':
        this.showChatResponse(msg);
        break;
    }
  }

  updateConnectionStatus(connected) {
    const el = document.getElementById('connectionStatus');
    if (el) {
      el.innerHTML = `<span class="status-dot ${connected ? 'online' : 'offline'}"></span> ${connected ? 'Connected' : 'Disconnected'}`;
    }
  }

  // ─── Navigation ─────────────────────────────────────────────────────────

  setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const section = item.dataset.section;
        this.navigateTo(section);
      });
    });
  }

  navigateTo(section) {
    // Update nav
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`[data-section="${section}"]`)?.classList.add('active');

    // Update sections
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(`section-${section}`)?.classList.add('active');

    // Update title
    const titles = {
      overview: 'Overview', tasks: 'Tasks', browser: 'Browser Control',
      terminal: 'Terminal', research: 'Deep Research', scheduler: 'Scheduler',
      gateway: 'AI Gateway', safety: 'Safety', settings: 'Settings'
    };
    document.getElementById('pageTitle').textContent = titles[section] || section;

    // Load section data
    this.loadSection(section);
  }

  async loadSection(section) {
    switch (section) {
      case 'overview': this.loadOverview(); break;
      case 'gateway': this.loadGateway(); break;
      case 'safety': this.loadSafetyLog(); break;
      case 'scheduler': this.loadScheduler(); break;
      case 'tasks': this.refreshTasks(); break;
    }
  }

  // ─── API Calls ──────────────────────────────────────────────────────────

  async api(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    try {
      const response = await fetch(`${API_BASE}${path}`, options);
      const data = await response.json();

      if (response.status === 401) {
        this.token = null;
        localStorage.removeItem('operator_token');
        // Prompt for login
        const apiKey = prompt('Enter your API key:');
        if (apiKey) {
          await this.loginWithKey(apiKey);
        }
      }

      return data;
    } catch (error) {
      console.error(`[API] ${method} ${path} failed:`, error);
      return { error: error.message };
    }
  }

  // ─── Overview ───────────────────────────────────────────────────────────

  async loadOverview() {
    const status = await this.api('GET', '/api/status');
    if (status.gateway) {
      document.getElementById('statProviders').textContent = Object.keys(status.gateway.providers || {}).length;
    }

    const sysInfo = await this.api('GET', '/api/system/info');
    if (sysInfo.ok) {
      document.getElementById('statUptime').textContent = this.formatUptime(sysInfo.uptime);
    }

    // Load provider details
    const gatewayStatus = await this.api('GET', '/api/gateway/status');
    if (gatewayStatus.ok) {
      document.getElementById('statProviders').textContent = Object.keys(gatewayStatus.providers || {}).length;
      document.getElementById('providerCount').textContent = Object.keys(gatewayStatus.providers || {}).length;

      // Render provider cards
      const providerList = document.getElementById('providerList');
      if (providerList) {
        providerList.innerHTML = Object.entries(gatewayStatus.providers || {}).map(([id, p]) => `
          <div class="provider-card ${p.status || 'unknown'}">
            <div class="provider-name">${p.name || id}</div>
            <div class="provider-health">${this.healthIcon(p.status)} ${p.status || 'unknown'}</div>
            <div class="provider-keys">🔑 ${p.keys || 0} keys</div>
            <div class="provider-stats">
              ${p.avgLatency ? `⚡ ${Math.round(p.avgLatency)}ms` : ''}
              ${p.successRate !== undefined ? ` ✅ ${(p.successRate * 100).toFixed(0)}%` : ''}
            </div>
          </div>
        `).join('');
      }
    }
  }

  // ─── Gateway ────────────────────────────────────────────────────────────

  async loadGateway() {
    const result = await this.api('GET', '/api/gateway/models');
    if (result.ok && result.models) {
      this.models = result.models;
      const modelGrid = document.getElementById('gatewayModels');
      if (modelGrid) {
        modelGrid.innerHTML = result.models.map(m => `
          <div class="model-card ${m.available ? 'available' : 'unavailable'}">
            <div class="model-id">${m.id}</div>
            <div class="model-provider">${m.providerName}</div>
            <div class="model-health">${this.healthIcon(m.health)} ${m.health}</div>
          </div>
        `).join('');
      }

      // Update chat model select
      const chatModel = document.getElementById('chatModel');
      if (chatModel && result.models.length > 0) {
        chatModel.innerHTML = result.models
          .filter(m => m.available)
          .map(m => `<option value="${m.id}">${m.id} (${m.providerName})</option>`)
          .join('');
      }
    }
  }

  async gatewayChat() {
    const model = document.getElementById('chatModel')?.value || 'big-pickle';
    const message = document.getElementById('chatMessage')?.value;
    if (!message) return;

    const responseDiv = document.getElementById('chatResponse');
    if (responseDiv) {
      responseDiv.classList.remove('hidden');
      responseDiv.innerHTML = '<div class="loading">Thinking...</div>';
    }

    const result = await this.api('POST', '/api/gateway/chat', {
      model,
      messages: [{ role: 'user', content: message }]
    });

    if (result.ok) {
      responseDiv.innerHTML = `
        <div class="chat-result">
          <div class="chat-content">${this.escapeHtml(result.content)}</div>
          <div class="chat-meta">
            Provider: ${result.provider} | Model: ${result.model} | Tokens: ${result.usage?.total_tokens || 0}
          </div>
        </div>
      `;
    } else {
      responseDiv.innerHTML = `<div class="error">${result.error || 'Request failed'}</div>`;
    }
  }

  // ─── Tasks ──────────────────────────────────────────────────────────────

  showNewTask() {
    document.getElementById('newTaskModal')?.classList.remove('hidden');
  }

  closeModal() {
    document.getElementById('newTaskModal')?.classList.add('hidden');
  }

  async createTask() {
    const task = document.getElementById('newTaskDesc')?.value;
    if (!task) return;

    const result = await this.api('POST', '/api/tasks', { task });
    if (result.ok) {
      this.closeModal();
      this.navigateTo('tasks');
      this.refreshTasks();
    }
  }

  async refreshTasks() {
    const result = await this.api('GET', '/api/tasks');
    if (result.ok) {
      this.tasks = result.tasks;
      document.getElementById('activeTaskCount').textContent = result.tasks.filter(t => t.status === 'running').length;
      document.getElementById('statActiveTasks').textContent = result.tasks.filter(t => t.status === 'running').length;
      document.getElementById('statCompletedTasks').textContent = result.tasks.filter(t => t.status === 'completed').length;

      const taskList = document.getElementById('taskList');
      if (taskList) {
        if (result.tasks.length === 0) {
          taskList.innerHTML = '<div class="empty-state">No active tasks. Click "New Task" to create one.</div>';
        } else {
          taskList.innerHTML = result.tasks.map(t => `
            <div class="task-item ${t.status}">
              <div class="task-status">${this.statusIcon(t.status)}</div>
              <div class="task-info">
                <div class="task-desc">${this.escapeHtml(t.task)}</div>
                <div class="task-meta">ID: ${t.id} | Started: ${t.startedAt} | Status: ${t.status}</div>
              </div>
              <button class="btn btn-sm" onclick="app.cancelTask('${t.id}')">Cancel</button>
            </div>
          `).join('');
        }
      }
    }
  }

  async cancelTask(id) {
    await this.api('DELETE', `/api/tasks/${id}`);
    this.refreshTasks();
  }

  // ─── Browser ────────────────────────────────────────────────────────────

  async browserGoto() {
    const url = document.getElementById('browserUrl')?.value;
    if (!url) return;

    const result = await this.api('POST', '/api/browser/goto', { url });
    if (result.ok) {
      if (result.category && result.category !== 'general') {
        this.showNotification(`⚠️ URL Category: ${result.category} (Level: ${result.level})`, 'warning');
      }
    }
  }

  async browserAction(action) {
    switch (action) {
      case 'screenshot':
        await this.api('POST', '/api/browser/screenshot', {});
        break;
      case 'back':
      case 'forward':
      case 'reload':
        // These would need browser API support
        break;
    }
  }

  // ─── Terminal ───────────────────────────────────────────────────────────

  async terminalExec() {
    const input = document.getElementById('terminalInput');
    const command = input?.value;
    if (!command) return;
    input.value = '';

    const output = document.getElementById('terminalOutput');
    if (output) {
      output.innerHTML += `<div class="terminal-line input"><span class="prompt">$</span> ${this.escapeHtml(command)}</div>`;
    }

    const result = await this.api('POST', '/api/terminal/exec', { command });

    if (output) {
      if (result.ok) {
        output.innerHTML += `<div class="terminal-line output">${this.escapeHtml(JSON.stringify(result.result, null, 2))}</div>`;
      } else {
        output.innerHTML += `<div class="terminal-line error">${this.escapeHtml(result.error || 'Command failed')}</div>`;
      }
      output.scrollTop = output.scrollHeight;
    }
  }

  // ─── Research ───────────────────────────────────────────────────────────

  async startResearch() {
    const query = document.getElementById('researchQuery')?.value;
    const depth = parseInt(document.getElementById('researchDepth')?.value || '2');
    const language = document.getElementById('researchLang')?.value || 'es';
    if (!query) return;

    // Show progress
    const progress = document.getElementById('researchProgress');
    if (progress) progress.classList.remove('hidden');

    const result = await this.api('POST', '/api/research', { query, options: { depth, language } });
    if (result.ok) {
      this.showNotification('🔍 Research started!', 'info');
    }
  }

  updateResearchProgress(msg) {
    document.querySelectorAll('.progress-step').forEach(step => {
      if (step.dataset.step === msg.phase) {
        step.classList.add('active');
      }
      if (step.dataset.step === msg.phase) {
        step.classList.add('completed');
      }
    });
  }

  showResearchResult(result) {
    const progress = document.getElementById('researchProgress');
    if (progress) progress.classList.add('hidden');

    const resultDiv = document.getElementById('researchResult');
    const reportDiv = document.getElementById('researchReport');

    if (resultDiv && reportDiv) {
      resultDiv.classList.remove('hidden');
      reportDiv.innerHTML = `
        <div class="report-meta">
          <span>Confidence: ${(result.confidence * 100).toFixed(0)}%</span>
          <span>Duration: ${(result.duration / 1000).toFixed(1)}s</span>
          <span>Searches: ${result.searchesPerformed}</span>
        </div>
        <div class="report-body">${this.escapeHtml(result.report)}</div>
        ${result.sources ? `<div class="report-sources"><h4>Sources:</h4>${result.sources.map(s => `<div class="source">[${s.index}] ${s.query} (${s.source})</div>`).join('')}</div>` : ''}
      `;
    }
  }

  // ─── Scheduler ──────────────────────────────────────────────────────────

  async scheduleTask() {
    const task = document.getElementById('schedulerTask')?.value;
    const cron = document.getElementById('schedulerCron')?.value;
    if (!task) return;

    const body = { task };
    if (cron && cron.match(/^\d/)) {
      body.interval = parseInt(cron);
    } else if (cron) {
      body.cron = cron;
    }

    const result = await this.api('POST', '/api/scheduler', body);
    if (result.ok) {
      this.showNotification('⏰ Task scheduled!', 'success');
      this.loadScheduler();
    }
  }

  async loadScheduler() {
    const result = await this.api('GET', '/api/scheduler');
    const jobsDiv = document.getElementById('schedulerJobs');

    if (result.ok && result.jobs) {
      document.getElementById('statScheduled').textContent = result.jobs.length;

      if (jobsDiv) {
        jobsDiv.innerHTML = result.jobs.map(j => `
          <div class="scheduler-item ${j.enabled ? 'enabled' : 'disabled'}">
            <div class="scheduler-info">
              <div class="scheduler-name">${this.escapeHtml(j.name)}</div>
              <div class="scheduler-meta">
                ${j.cron ? `Cron: ${j.cron}` : `Interval: ${j.interval}ms`} |
                Runs: ${j.runCount} |
                Last: ${j.lastRun || 'never'} |
                Status: ${j.status}
              </div>
            </div>
            <div class="scheduler-actions">
              <button class="btn btn-sm" onclick="app.toggleSchedulerJob('${j.id}', ${!j.enabled})">
                ${j.enabled ? '⏸️' : '▶️'}
              </button>
              <button class="btn btn-sm btn-danger" onclick="app.deleteSchedulerJob('${j.id}')">🗑️</button>
            </div>
          </div>
        `).join('');
      }
    }
  }

  async toggleSchedulerJob(id, enabled) {
    await this.api('POST', `/api/scheduler/${id}/toggle`, { enabled });
    this.loadScheduler();
  }

  async deleteSchedulerJob(id) {
    await this.api('DELETE', `/api/scheduler/${id}`);
    this.loadScheduler();
  }

  // ─── Safety ─────────────────────────────────────────────────────────────

  async loadSafetyLog() {
    const result = await this.api('GET', '/api/safety/log?limit=50');
    const logDiv = document.getElementById('safetyLog');

    if (result.ok && result.log && logDiv) {
      logDiv.innerHTML = result.log.map(l => `
        <div class="log-entry ${l.result?.level || 'none'}">
          <span class="log-time">${new Date(l.timestamp).toLocaleTimeString()}</span>
          <span class="log-action">${l.action?.type}</span>
          <span class="log-level level-${l.result?.level || 'none'}">${l.result?.level || 'ok'}</span>
          <span class="log-reason">${l.result?.reason || ''}</span>
        </div>
      `).join('');
    }
  }

  toggleWatchMode(enabled) {
    // This would need to be sent to the server
    this.showNotification(`Watch Mode ${enabled ? 'enabled' : 'disabled'}`, 'info');
  }

  showConfirmation(msg) {
    const approved = confirm(`🔒 Action requires confirmation:\n\n${msg.reason || 'An action needs your approval.'}\n\nApprove?`);
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'confirm', confirmationId: msg.id, approved }));
    }
  }

  showWatchModeAlert(msg) {
    this.showNotification(`⚠️ Watch Mode: Navigating to ${msg.category} site (${msg.url})`, 'warning');
  }

  // ─── Auth ───────────────────────────────────────────────────────────────

  async login() {
    const apiKey = document.getElementById('settingsApiKey')?.value;
    if (apiKey) {
      await this.loginWithKey(apiKey);
    }
  }

  async loginWithKey(apiKey) {
    const result = await this.api('POST', '/api/auth/login', { apiKey });
    if (result.ok) {
      this.token = result.token;
      localStorage.setItem('operator_token', result.token);
      this.showNotification('✅ Logged in!', 'success');
    } else {
      this.showNotification('❌ Login failed: ' + (result.error || ''), 'error');
    }
  }

  // ─── Utilities ──────────────────────────────────────────────────────────

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 500);
    }, 3000);
  }

  healthIcon(status) {
    const icons = {
      healthy: '✅', degraded: '⚠️', rate_limited: '🚫',
      auth_error: '🔑', unknown: '❓', online: '🟢', offline: '🔴'
    };
    return icons[status] || '❓';
  }

  statusIcon(status) {
    const icons = { running: '🔄', completed: '✅', failed: '❌', cancelled: '🚫' };
    return icons[status] || '❓';
  }

  formatUptime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize
const app = new OperatorApp();
window.app = app;

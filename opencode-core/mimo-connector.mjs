// ============================================================
// MiMoCode PC Connector
// Se ejecuta desde MiMoCode para conectar con la PC
// Permite ver pantalla, ejecutar comandos, controlar todo
// ============================================================

import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';
import os from 'os';

const BRIDGE_URL = process.env.BRIDGE_URL || 'ws://localhost:21295/mimo';
const SCREENSHOT_DIR = path.join(os.tmpdir(), 'mimo-screenshots');

// Ensure screenshot dir exists
fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

class MimoConnector {
  constructor() {
    this.ws = null;
    this.connected = false;
    this.pendingCommands = new Map();
    this.onScreenshot = null;
    this.onTaskStep = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      console.log(`[mimo] Conectando a ${BRIDGE_URL}...`);
      this.ws = new WebSocket(BRIDGE_URL);

      this.ws.on('open', () => {
        console.log('[mimo] ✓ Conectado al bridge');
        this.connected = true;
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());

          if (msg.type === 'connected') {
            console.log(`[mimo] Agent: ${msg.agentConnected ? msg.agentName : 'desconectado'}`);
          }

          if (msg.type === 'agent_connected') {
            console.log(`[mimo] PC Agent conectado: ${msg.agent?.name}`);
          }

          if (msg.type === 'result' && msg.id) {
            const pending = this.pendingCommands.get(msg.id);
            if (pending) {
              pending.resolve(msg.result);
              this.pendingCommands.delete(msg.id);
            }
          }

          if (msg.type === 'screenshot' && msg.id) {
            const pending = this.pendingCommands.get(msg.id);
            if (pending) {
              pending.resolve(msg.data);
              this.pendingCommands.delete(msg.id);
            }
          }

          if (msg.type === 'task_step') {
            console.log(`[mimo] Task step ${msg.step}: screenshot received`);
            if (this.onTaskStep) this.onTaskStep(msg);
          }

          if (msg.type === 'task_complete') {
            console.log(`[mimo] Task complete: ${msg.totalSteps} steps`);
          }
        } catch (err) {
          console.error('[mimo] Error parsing:', err.message);
        }
      });

      this.ws.on('close', () => {
        console.log('[mimo] Desconectado');
        this.connected = false;
      });

      this.ws.on('error', (err) => {
        console.error('[mimo] Error:', err.message);
        reject(err);
      });
    });
  }

  // ─── Core Commands ──────────────────────────────────────────────

  async cmd(type, params = {}) {
    if (!this.connected) throw new Error('No conectado');
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCommands.delete(id);
        reject(new Error('Timeout'));
      }, 30000);
      this.pendingCommands.set(id, { resolve: (r) => { clearTimeout(timer); resolve(r); } });
      this.ws.send(JSON.stringify({ type: 'command', id, cmd: { type, ...params } }));
    });
  }

  async screenshot() {
    const result = await this.cmd('screenshot');
    if (result?.base64) {
      const filePath = path.join(SCREENSHOT_DIR, `screen_${Date.now()}.png`);
      fs.writeFileSync(filePath, Buffer.from(result.base64, 'base64'));
      return { ...result, filePath };
    }
    return result;
  }

  async powershell(script) { return this.cmd('powershell', { script }); }
  async cmd_exec(command) { return this.cmd('cmd', { command }); }
  async openUrl(url) { return this.cmd('open_url', { url }); }
  async openFile(filePath) { return this.cmd('open_file', { path: filePath }); }
  async readFile(filePath) { return this.cmd('read_file', { path: filePath }); }
  async writeFile(filePath, content) { return this.cmd('write_file', { path: filePath, content }); }
  async listDir(dirPath) { return this.cmd('list_dir', { path: dirPath }); }
  async mouseClick(button = 'left') { return this.cmd('mouse_click', { button }); }
  async mouseMove(x, y) { return this.cmd('mouse_move', { x, y }); }
  async type(text) { return this.cmd('keyboard_type', { text }); }
  async keyPress(key) { return this.cmd('keyboard_press', { key }); }
  async notify(message, title = 'MiMoCode') { return this.cmd('notify', { message, title }); }
  async sysinfo() { return this.cmd('sysinfo'); }

  // ─── High-Level Actions ────────────────────────────────────────

  async openChrome(url = 'https://www.google.com') {
    return this.powershell(`Start-Process chrome.exe "${url}"`);
  }

  async openNotepad(filePath = '') {
    return filePath 
      ? this.powershell(`notepad.exe "${filePath}"`)
      : this.powershell('notepad.exe');
  }

  async openTerminal() {
    return this.powershell('Start-Process wt.exe');
  }

  async closeApp(appName) {
    return this.powershell(`Stop-Process -Name "${appName}" -Force -ErrorAction SilentlyContinue`);
  }

  async pressEnter() { return this.keyPress('{ENTER}'); }
  async pressEscape() { return this.keyPress('{ESC}'); }
  async pressTab() { return this.keyPress('{TAB}'); }
  async pressBackspace() { return this.keyPress('{BACKSPACE}'); }
  async pressDelete() { return this.keyPress('{DELETE}'); }
  async pressHome() { return this.keyPress('{HOME}'); }
  async pressEnd() { return this.keyPress('{END}'); }
  async pressUp() { return this.keyPress('{UP}'); }
  async pressDown() { return this.keyPress('{DOWN}'); }
  async pressLeft() { return this.keyPress('{LEFT}'); }
  async pressRight() { return this.keyPress('{RIGHT}'); }
  async altTab() { return this.keyPress('%{TAB}'); }
  async ctrlC() { return this.keyPress('^c'); }
  async ctrlV() { return this.keyPress('^v'); }
  async ctrlA() { return this.keyPress('^a'); }
  async ctrlS() { return this.keyPress('^s'); }
  async ctrlZ() { return this.keyPress('^z'); }
  async ctrlX() { return this.keyPress('^x'); }

  disconnect() {
    if (this.ws) this.ws.close();
  }
}

// Export for use
export { MimoConnector };

// CLI mode
if (process.argv[1] === import.meta.url) {
  const connector = new MimoConnector();
  await connector.connect();

  // Test: take screenshot
  console.log('[mimo] Tomando screenshot de prueba...');
  const shot = await connector.screenshot();
  if (shot?.filePath) {
    console.log(`[mimo] Screenshot guardado en: ${shot.filePath}`);
  }

  // Test: sysinfo
  const info = await connector.sysinfo();
  console.log('[mimo] System info:', info);

  console.log('[mimo] Conexión exitosa. Listo para recibir comandos.');
  console.log('[mimo] Presiona Ctrl+C para salir.');

  process.on('SIGINT', () => {
    connector.disconnect();
    process.exit(0);
  });
}

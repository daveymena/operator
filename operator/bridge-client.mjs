import { WebSocket } from 'ws';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setTimeout as sleep } from 'timers/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SS_DIR = path.join(__dirname, '..', 'operator', 'screenshots');
fs.mkdirSync(SS_DIR, { recursive: true });

export class BridgeClient {
  constructor(config = {}) {
    this.bridgeUrl = config.bridgeUrl || 'ws://localhost:20100';
    this.agentServerUrl = config.agentServerUrl || 'ws://localhost:21291/agent';
    this.ws = null;
    this._connected = false;
    this.verbose = config.verbose !== false;
    this._msgQueue = [];
    this._responseHandlers = new Map();
  }

  async connect() {
    try {
      this.ws = new WebSocket(this.bridgeUrl);
      await new Promise((resolve, reject) => {
        this.ws.on('open', resolve);
        this.ws.on('error', reject);
        this.ws.on('message', (data) => this._handleMessage(data));
        setTimeout(() => reject(new Error('timeout')), 5000);
      });
      this._connected = true;
      if (this.verbose) console.log('  ✅ Bridge conectado (ws://localhost:20100)');
      return true;
    } catch {
      if (this.verbose) console.log('  ⚠️ Bridge no disponible, usando comandos directos');
      this._connected = false;
      return false;
    }
  }

  _handleMessage(data) {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.id && this._responseHandlers.has(msg.id)) {
        this._responseHandlers.get(msg.id)(msg);
        this._responseHandlers.delete(msg.id);
      }
    } catch {}
  }

  async _send(msg) {
    if (!this._connected || !this.ws) return { error: 'Bridge no conectado' };
    return new Promise((resolve) => {
      const id = Date.now().toString() + Math.random().toString(36).slice(2, 6);
      const timer = setTimeout(() => {
        this._responseHandlers.delete(id);
        resolve({ error: 'timeout', id });
      }, 30000);
      this._responseHandlers.set(id, (response) => {
        clearTimeout(timer);
        resolve(response);
      });
      try { this.ws.send(JSON.stringify({ ...msg, id })); }
      catch (e) { clearTimeout(timer); this._responseHandlers.delete(id); resolve({ error: e.message }); }
    });
  }

  _powershellDirect(script) {
    try {
      const out = execSync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, { timeout: 30000, encoding: 'utf8', maxBuffer: 1024 * 1024 });
      return { ok: true, output: out.trim() };
    } catch (e) {
      return { ok: false, error: e.message, output: e.stdout?.trim() || '' };
    }
  }

  async execute(action) {
    if (!action || !action.type) return { ok: false, error: 'acción inválida' };

    switch (action.type) {
      case 'screenshot': return await this._screenshot(action.params);
      case 'mouse_move': return await this._mouseMove(action.params);
      case 'mouse_click': return await this._mouseClick(action.params);
      case 'mouse_double_click': return await this._powerShell({ script: 'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("{DOUBLECLICK}")' });
      case 'mouse_scroll': return await this._powershellDirect(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("{PGDN".PadRight(7+[Math]::Abs(${action.params?.clicks||1}),'}')})`);
      case 'drag_and_drop': return await this._powerShell({ script: `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point ${action.params?.x1||0},${action.params?.y1||0}; [System.Windows.Forms.SendKeys]::SendWait("{DOWN}")` });
      case 'keyboard_type': return await this._keyboardType(action.params);
      case 'keyboard_press': return await this._keyboardPress(action.params);
      case 'keyboard_shortcut': return await this._powerShell({ script: `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("^c")` });
      case 'get_clipboard': return await this._powershellDirect('Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::GetText()');
      case 'set_clipboard': return await this._powershellDirect(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::SetText("${(action.params?.text||'').replace(/"/g,'""')}")`);
      case 'sysinfo': return await this._powershellDirect('Write-Host "OS:$((Get-WmiObject Win32_OperatingSystem).Caption) RAM:$([Math]::Round((Get-WmiObject Win32_ComputerSystem).TotalPhysicalMemory/1GB))GB CPU:$(Get-WmiObject Win32_Processor).Name HOST:$env:COMPUTERNAME"');
      case 'list_windows': return await this._powershellDirect('Get-Process | Where-Object {$_.MainWindowTitle} | Select-Object Id, Name, @{N="Title";E={$_.MainWindowTitle}} | ConvertTo-Json -Compress');
      case 'list_apps': return await this._powershellDirect('Get-ItemProperty "HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" | Select-Object DisplayName | ConvertTo-Json -Compress');
      case 'get_cursor': return await this._powershellDirect('Add-Type -AssemblyName System.Windows.Forms; Write-Host "$([System.Windows.Forms.Cursor]::Position.X),$([System.Windows.Forms.Cursor]::Position.Y)"');
      case 'focus_window': return await this._powershellDirect(`(Get-Process -Id ${action.params?.pid||0}).MainWindowHandle | ForEach-Object { Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("%({TAB})") }`);
      case 'powershell': return await this._powershellDirect(action.params?.script || '');
      case 'open_url': return await this._powershellDirect(`Start-Process "${(action.params?.url||'https://google.com').replace(/"/g,'\\"')}"`);
      case 'open_file': return await this._powershellDirect(`Start-Process "${(action.params?.path||'').replace(/"/g,'\\"')}"`);
      case 'read_file': return await this._readFile(action.params);
      case 'write_file': return await this._writeFile(action.params);
      case 'list_dir': return this._listDir(action.params);
      case 'notify': return await this._powershellDirect(`Add-Type -AssemblyName System.Windows.Forms; $n=New-Object System.Windows.Forms.NotifyIcon; $n.Icon=[System.Drawing.SystemIcons]::Information; $n.BalloonTipText="${(action.params?.message||'').replace(/"/g,'""')}"; $n.BalloonTipTitle="${(action.params?.title||'Operator').replace(/"/g,'""')}"; $n.Visible=$true; $n.ShowBalloonTip(3000)`);
      case 'wait': await sleep(action.params?.ms || 1000); return { ok: true, waited: action.params?.ms || 1000 };
      case 'done': return { ok: true, done: true, message: action.params?.message || 'tarea completada' };
      default: return { ok: false, error: `acción desconocida: ${action.type}` };
    }
  }

  async _screenshot(params) {
    const q = params?.quality || 50;
    const s = params?.scale || 0.75;
    const filename = `ss_${Date.now()}.png`;
    const filepath = path.join(SS_DIR, filename);
    try {
      execSync(`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $b=[Windows.Forms.Screen]::PrimaryScreen.Bounds; $bmp=New-Object Drawing.Bitmap $b.Width,$b.Height; $g=[Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen(0,0,0,0,$b.Size); $bmp.Save('${filepath}','PNG'); $g.Dispose(); $bmp.Dispose()"`, { timeout: 10000 });
      const base64 = fs.readFileSync(filepath).toString('base64');
      return { ok: true, file: filepath, base64, size: base64.length, width: 1920, height: 1080 };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  async _mouseMove(params) {
    const x = params?.x ?? 0, y = params?.y ?? 0;
    return this._powershellDirect(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point ${x},${y}`);
  }

  async _mouseClick(params) {
    const btn = params?.button || 'left';
    const x = params?.x, y = params?.y;
    let script = 'Add-Type -AssemblyName System.Windows.Forms; Add-Type -TypeDefinition @"\nusing System.Runtime.InteropServices; public class Mouse { [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, int dwExtraInfo); }\n"@; ';
    if (x !== undefined && y !== undefined) script += `[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point ${x},${y}; `;
    if (btn === 'right') script += '[Mouse]::mouse_event(0x0008,0,0,0,0); [Mouse]::mouse_event(0x0010,0,0,0,0)';
    else script += '[Mouse]::mouse_event(0x0002,0,0,0,0); [Mouse]::mouse_event(0x0004,0,0,0,0)';
    return this._powershellDirect(script);
  }

  async _keyboardType(params) {
    const text = params?.text || '';
    return this._powershellDirect(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("${text.replace(/"/g,'""').replace(/\n/g,'{ENTER}').replace(/\t/g,'{TAB}')}")`);
  }

  async _keyboardPress(params) {
    const key = (params?.key || 'ENTER').toUpperCase();
    const keyMap = { ENTER: '{ENTER}', TAB: '{TAB}', ESC: '{ESC}', BACKSPACE: '{BACKSPACE}', DELETE: '{DELETE}', HOME: '{HOME}', END: '{END}', UP: '{UP}', DOWN: '{DOWN}', LEFT: '{LEFT}', RIGHT: '{RIGHT}', SPACE: ' ', F1: '{F1}', F2: '{F2}', F3: '{F3}', F4: '{F4}', F5: '{F5}', F6: '{F6}', F7: '{F7}', F8: '{F8}', F9: '{F9}', F10: '{F10}', F11: '{F11}', F12: '{F12}' };
    return this._powershellDirect(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("${keyMap[key] || '{'+key+'}'}")`);
  }

  async _readFile(params) {
    try {
      const content = fs.readFileSync(params?.path || '', 'utf8');
      return { ok: true, content, size: content.length };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  async _writeFile(params) {
    try {
      fs.writeFileSync(params?.path || '', params?.content || '', 'utf8');
      return { ok: true, path: params?.path };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  _listDir(params) {
    try {
      const files = fs.readdirSync(params?.path || '.', { withFileTypes: true });
      return { ok: true, files: files.map(f => ({ name: f.name, isDir: f.isDirectory(), isFile: f.isFile() })) };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  close() {
    if (this.ws) { try { this.ws.close(); } catch {} }
    this._connected = false;
  }
}

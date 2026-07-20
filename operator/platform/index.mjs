/**
 * Operator Pro — Platform Abstraction Layer
 * 
 * Detects the current OS and provides a unified interface for all
 * platform-specific operations. Works on Windows, Linux, and macOS.
 * 
 * Usage:
 *   import { platform } from './platform/index.mjs';
 *   const info = await platform.getSystemInfo();
 *   const result = await platform.exec('ls -la');
 *   await platform.screenshot('/tmp/ss.png');
 */

import os from 'os';
import { execSync, exec, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// ─── Platform Detection ────────────────────────────────────────────────────────

const OS = os.platform(); // 'win32' | 'linux' | 'darwin'
const ARCH = os.arch();
const HOME = os.homedir();
const TMP = os.tmpdir();

// ─── Base Platform Adapter ─────────────────────────────────────────────────────

class PlatformAdapter {
  constructor(name) {
    this.name = name;
    this.os = OS;
    this.arch = ARCH;
    this.home = HOME;
    this.tmp = TMP;
    this.hostname = os.hostname();
    this.cpus = os.cpus().length;
    this.totalMem = os.totalmem();
    this.shell = this._detectShell();
  }

  _detectShell() {
    if (OS === 'win32') return process.env.COMSPEC || 'cmd.exe';
    return process.env.SHELL || '/bin/bash';
  }

  // Execute a command in the system shell
  exec(command, opts = {}) {
    const timeout = opts.timeout || 30000;
    const cwd = opts.cwd || process.cwd();
    const env = { ...process.env, ...(opts.env || {}) };
    
    return new Promise((resolve) => {
      exec(command, { timeout, cwd, env, maxBuffer: 10 * 1024 * 1024, shell: this.shell }, (error, stdout, stderr) => {
        resolve({
          ok: !error,
          stdout: stdout?.toString().trim() || '',
          stderr: stderr?.toString().trim() || '',
          code: error?.code || 0,
          killed: error?.killed || false,
          duration: 0
        });
      });
    });
  }

  // Execute synchronously (for simple operations)
  execSync(command, opts = {}) {
    try {
      const out = execSync(command, {
        timeout: opts.timeout || 30000,
        cwd: opts.cwd || process.cwd(),
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
        shell: this.shell,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      return { ok: true, output: out.trim() };
    } catch (e) {
      return { ok: false, error: e.message, output: e.stdout?.toString().trim() || '' };
    }
  }

  // Spawn a long-running process
  spawnProcess(command, args = [], opts = {}) {
    return spawn(command, args, {
      cwd: opts.cwd || process.cwd(),
      env: { ...process.env, ...(opts.env || {}) },
      shell: opts.shell ?? true,
      stdio: opts.stdio || ['pipe', 'pipe', 'pipe'],
      detached: opts.detached || false
    });
  }

  // Get system info
  async getSystemInfo() {
    const cpus = os.cpus();
    return {
      os: this.name,
      arch: ARCH,
      hostname: this.hostname,
      platform: OS,
      node: process.version,
      cpus: cpus.length,
      cpuModel: cpus[0]?.model || 'unknown',
      totalMemMB: Math.round(os.totalmem() / 1024 / 1024),
      freeMemMB: Math.round(os.freemem() / 1024 / 1024),
      uptime: os.uptime(),
      loadAvg: os.loadavg(),
      shell: this.shell,
      home: HOME,
      user: os.userInfo().username
    };
  }

  // Screenshot — override in platform-specific adapters
  async screenshot(filepath, opts = {}) {
    throw new Error(`screenshot not implemented for ${this.name}`);
  }

  // Mouse/keyboard — override in platform-specific adapters
  async mouseMove(x, y) { throw new Error(`mouseMove not implemented for ${this.name}`); }
  async mouseClick(x, y, button = 'left') { throw new Error(`mouseClick not implemented for ${this.name}`); }
  async mouseScroll(x, y, clicks) { throw new Error(`mouseScroll not implemented for ${this.name}`); }
  async keyboardType(text) { throw new Error(`keyboardType not implemented for ${this.name}`); }
  async keyboardPress(key) { throw new Error(`keyboardPress not implemented for ${this.name}`); }

  // Get cursor position
  async getCursor() { throw new Error(`getCursor not implemented for ${this.name}`); }

  // List windows / applications
  async listWindows() { return []; }
  async listProcesses() { return []; }

  // Get screen resolution
  async getScreenResolution() {
    return { width: 1920, height: 1080 };
  }

  // Notifications
  async notify(title, message) {
    console.log(`[${title}] ${message}`);
  }

  // Open URL in default browser
  async openUrl(url) {
    const cmds = { win32: 'start', linux: 'xdg-open', darwin: 'open' };
    return this.exec(`${cmds[OS]} "${url}"`);
  }

  // Open file with default application
  async openFile(filepath) {
    const cmds = { win32: 'start', linux: 'xdg-open', darwin: 'open' };
    return this.exec(`${cmds[OS]} "${filepath}"`);
  }

  // Check if a command/tool is available
  async which(cmd) {
    const check = OS === 'win32' ? `where ${cmd}` : `which ${cmd}`;
    const r = this.execSync(check);
    return r.ok ? r.output.split('\n')[0].trim() : null;
  }

  // Get display info (multi-monitor support)
  async getDisplays() {
    const res = await this.getScreenResolution();
    return [{ id: 0, ...res, primary: true }];
  }

  // Clipboard
  async getClipboard() {
    const cmds = {
      win32: 'powershell -NoProfile -Command "Get-Clipboard"',
      linux: 'xclip -selection clipboard -o 2>/dev/null || xsel --clipboard --output 2>/dev/null',
      darwin: 'pbpaste'
    };
    return this.exec(cmds[OS]);
  }

  async setClipboard(text) {
    const cmds = {
      win32: `powershell -NoProfile -Command "Set-Clipboard -Value '${text.replace(/'/g, "''")}'"`,
      linux: `echo '${text.replace(/'/g, "'\\''")}' | xclip -selection clipboard 2>/dev/null || echo '${text.replace(/'/g, "'\\''")}' | xsel --clipboard --input`,
      darwin: `printf '%s' '${text.replace(/'/g, "'\\''")}' | pbcopy`
    };
    return this.exec(cmds[OS]);
  }
}

// ─── Windows Adapter ───────────────────────────────────────────────────────────

class WindowsAdapter extends PlatformAdapter {
  constructor() { super('Windows'); }

  async screenshot(filepath, opts = {}) {
    const quality = opts.quality || 100;
    const ps = `Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $b=[Windows.Forms.Screen]::PrimaryScreen.Bounds; $bmp=New-Object Drawing.Bitmap $b.Width,$b.Height; $g=[Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen(0,0,0,0,$b.Size); $bmp.Save('${filepath}','PNG'); $g.Dispose(); $bmp.Dispose(); Write-Host "$($b.Width)x$($b.Height)"`;
    return this.exec(`powershell -NoProfile -Command "${ps}"`);
  }

  async mouseMove(x, y) {
    return this.exec(`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point ${x},${y}"`);
  }

  async mouseClick(x, y, button = 'left') {
    const clickCode = button === 'right' ? '0x0008,0,0,0,0); [Mouse]::mouse_event(0x0010' : '0x0002,0,0,0,0); [Mouse]::mouse_event(0x0004';
    const move = x !== undefined ? `[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point ${x},${y}; ` : '';
    const ps = `Add-Type -AssemblyName System.Windows.Forms; Add-Type -TypeDefinition @"
using System.Runtime.InteropServices;
public class Mouse { [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, int dwExtraInfo); }
"@; ${move}[Mouse]::mouse_event(${clickCode},0,0,0,0)`;
    return this.exec(`powershell -NoProfile -Command "${ps}"`);
  }

  async mouseScroll(x, y, clicks = 3) {
    return this.exec(`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; ${x ? `[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point ${x},${y}; ` : ''}$sig = @'\n[DllImport(\"user32.dll\")] public static extern void mouse_event(uint f, int x, int y, int d, int e);\n'@; $m = Add-Type -MemberDefinition $sig -Name M -Namespace W -PassThru; $m::mouse_event(0x800,0,0,${clicks * 120},0)"`);
  }

  async keyboardType(text) {
    const safe = text.replace(/"/g, '""').replace(/\n/g, '{ENTER}').replace(/\t/g, '{TAB}');
    return this.exec(`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\\"${safe}\\")"`);
  }

  async keyboardPress(key) {
    const keyMap = {
      ENTER: '{ENTER}', TAB: '{TAB}', ESC: '{ESC}', BACKSPACE: '{BACKSPACE}',
      DELETE: '{DELETE}', HOME: '{HOME}', END: '{END}', UP: '{UP}', DOWN: '{DOWN}',
      LEFT: '{LEFT}', RIGHT: '{RIGHT}', SPACE: ' ', F1: '{F1}', F2: '{F2}',
      F3: '{F3}', F4: '{F4}', F5: '{F5}', F6: '{F6}', F7: '{F7}', F8: '{F8}',
      F9: '{F9}', F10: '{F10}', F11: '{F11}', F12: '{F12}'
    };
    const k = keyMap[key.toUpperCase()] || `{${key.toUpperCase()}}`;
    return this.exec(`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\\"${k}\\")"`);
  }

  async getCursor() {
    const r = await this.exec('powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; Write-Host \\"$([System.Windows.Forms.Cursor]::Position.X),$([System.Windows.Forms.Cursor]::Position.Y)\\""');
    if (r.ok) {
      const [x, y] = r.stdout.split(',').map(Number);
      return { ok: true, x, y };
    }
    return { ok: false, x: 0, y: 0 };
  }

  async listWindows() {
    const r = await this.exec('powershell -NoProfile -Command "Get-Process | Where-Object {$_.MainWindowTitle} | Select-Object Id, Name, @{N=\\"Title\\";E={$_.MainWindowTitle}} | ConvertTo-Json -Compress"');
    if (r.ok) {
      try { return { ok: true, windows: JSON.parse(r.stdout) }; } catch {}
    }
    return { ok: false, windows: [] };
  }

  async listProcesses() {
    const r = await this.exec('powershell -NoProfile -Command "Get-Process | Select-Object Id, Name, CPU, WorkingSet | Sort-Object WorkingSet -Descending | Select-Object -First 30 | ConvertTo-Json -Compress"');
    if (r.ok) {
      try { return { ok: true, processes: JSON.parse(r.stdout) }; } catch {}
    }
    return { ok: false, processes: [] };
  }

  async getScreenResolution() {
    const r = this.execSync('powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; $s=[Windows.Forms.Screen]::PrimaryScreen.Bounds; Write-Host \\"$($s.Width)x$($s.Height)\\""');
    if (r.ok) {
      const [w, h] = r.output.split('x').map(Number);
      return { width: w || 1920, height: h || 1080 };
    }
    return { width: 1920, height: 1080 };
  }

  async notify(title, message) {
    const ps = `Add-Type -AssemblyName System.Windows.Forms; $n=New-Object System.Windows.Forms.NotifyIcon; $n.Icon=[System.Drawing.SystemIcons]::Information; $n.BalloonTipText="${message.replace(/"/g, '""')}"; $n.BalloonTipTitle="${title.replace(/"/g, '""')}"; $n.Visible=$true; $n.ShowBalloonTip(3000)`;
    return this.exec(`powershell -NoProfile -Command "${ps}"`);
  }
}

// ─── Linux Adapter ─────────────────────────────────────────────────────────────

class LinuxAdapter extends PlatformAdapter {
  constructor() { super('Linux'); }

  async screenshot(filepath, opts = {}) {
    // Try multiple screenshot tools in order of preference
    const tools = [
      { cmd: `import -window root "${filepath}"`, name: 'ImageMagick' },
      { cmd: `gnome-screenshot -f "${filepath}"`, name: 'gnome-screenshot' },
      { cmd: `scrot "${filepath}"`, name: 'scrot' },
      { cmd: `xdotool getactivewindow && xwd -root -out /tmp/_ss.xwd && convert /tmp/_ss.xwd "${filepath}"`, name: 'xwd+convert' },
    ];

    for (const tool of tools) {
      const check = await this.which(tool.name.split('+')[0].split('-')[0]);
      if (check) {
        const r = await this.exec(tool.cmd);
        if (r.ok) return r;
      }
    }

    // Fallback: try xdotool + import
    const r = await this.exec(`import -window root "${filepath}" 2>/dev/null || scrot "${filepath}" 2>/dev/null || gnome-screenshot -f "${filepath}"`);
    return r;
  }

  async mouseMove(x, y) {
    return this.exec(`xdotool mousemove ${x} ${y}`);
  }

  async mouseClick(x, y, button = 'left') {
    const btn = button === 'right' ? '3' : '1';
    const move = x !== undefined ? `xdotool mousemove ${x} ${y} && ` : '';
    return this.exec(`${move}xdotool click ${btn}`);
  }

  async mouseScroll(x, y, clicks = 3) {
    const move = x !== undefined ? `xdotool mousemove ${x} ${y} && ` : '';
    const dir = clicks > 0 ? '4' : '5';
    const cmds = Array(Math.abs(clicks)).fill(`xdotool click ${dir}`).join(' && ');
    return this.exec(`${move}${cmds}`);
  }

  async keyboardType(text) {
    const safe = text.replace(/'/g, "'\\''").replace(/\n/g, '\\n');
    return this.exec(`xdotool type --clearmodifiers -- '${safe}'`);
  }

  async keyboardPress(key) {
    const keyMap = {
      ENTER: 'Return', TAB: 'Tab', ESC: 'Escape', BACKSPACE: 'BackSpace',
      DELETE: 'Delete', HOME: 'Home', END: 'End', UP: 'Up', DOWN: 'Down',
      LEFT: 'Left', RIGHT: 'Right', SPACE: 'space'
    };
    const k = keyMap[key.toUpperCase()] || key.toLowerCase();
    return this.exec(`xdotool key ${k}`);
  }

  async getCursor() {
    const r = await this.exec('xdotool getmouselocation');
    if (r.ok) {
      const match = r.stdout.match(/x:(\d+)\s+y:(\d+)/);
      if (match) return { ok: true, x: parseInt(match[1]), y: parseInt(match[2]) };
    }
    return { ok: false, x: 0, y: 0 };
  }

  async listWindows() {
    const r = await this.exec('wmctrl -l 2>/dev/null || xdotool search --onlyvisible --name "" getwindowname 2>/dev/null');
    if (r.ok) {
      const windows = r.stdout.split('\n').filter(Boolean).map((line, i) => ({
        id: i, title: line.trim(), name: line.trim()
      }));
      return { ok: true, windows };
    }
    return { ok: false, windows: [] };
  }

  async listProcesses() {
    const r = await this.exec('ps aux --sort=-%mem | head -31 | tail -30');
    if (r.ok) {
      const processes = r.stdout.split('\n').map(line => {
        const parts = line.split(/\s+/);
        return { user: parts[0], pid: parseInt(parts[1]), cpu: parseFloat(parts[2]), mem: parseFloat(parts[3]), command: parts.slice(10).join(' ') };
      });
      return { ok: true, processes };
    }
    return { ok: false, processes: [] };
  }

  async getScreenResolution() {
    const r = this.execSync('xrandr --current 2>/dev/null | grep " connected primary" | grep -oP "\\d+x\\d+"');
    if (r.ok && r.output) {
      const [w, h] = r.output.split('x').map(Number);
      return { width: w || 1920, height: h || 1080 };
    }
    const r2 = this.execSync('xdpyinfo 2>/dev/null | grep dimensions');
    if (r2.ok) {
      const match = r2.output.match(/(\d+)x(\d+)/);
      if (match) return { width: parseInt(match[1]), height: parseInt(match[2]) };
    }
    return { width: 1920, height: 1080 };
  }

  async notify(title, message) {
    return this.exec(`notify-send "${title}" "${message}" 2>/dev/null || echo "[${title}] ${message}"`);
  }
}

// ─── macOS Adapter ─────────────────────────────────────────────────────────────

class DarwinAdapter extends PlatformAdapter {
  constructor() { super('macOS'); }

  async screenshot(filepath, opts = {}) {
    return this.exec(`screencapture -x "${filepath}"`);
  }

  async mouseMove(x, y) {
    return this.exec(`osascript -e 'tell application "System Events" to set position of the mouse to {${x}, ${y}}'`);
  }

  async mouseClick(x, y, button = 'left') {
    const move = x !== undefined ? `osascript -e 'tell application "System Events" to set position of the mouse to {${x}, ${y}}' && ` : '';
    const click = button === 'right'
      ? `osascript -e 'tell application "System Events" to click at {${x}, ${y}} using {control down}'`
      : `cliclick c:${x},${y}`;
    return this.exec(`${move}${click} 2>/dev/null || osascript -e 'tell application "System Events" to click'`);
  }

  async mouseScroll(x, y, clicks = 3) {
    return this.exec(`osascript -e 'tell application "System Events" to scroll area 1 of scroll area 1 of group 1 by ${clicks}' 2>/dev/null || echo "scroll not available"`);
  }

  async keyboardType(text) {
    const safe = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return this.exec(`osascript -e 'tell application "System Events" to keystroke "${safe}"'`);
  }

  async keyboardPress(key) {
    const keyMap = { ENTER: 'return', TAB: 'tab', ESC: 'escape', BACKSPACE: 'delete', DELETE: 'forward delete', SPACE: 'space' };
    const k = keyMap[key.toUpperCase()] || key.toLowerCase();
    return this.exec(`osascript -e 'tell application "System Events" to key code ${this._keyCode(key)}' 2>/dev/null || osascript -e 'tell application "System Events" to keystroke "${k}"'`);
  }

  _keyCode(key) {
    const codes = { ENTER: '36', TAB: '48', ESC: '53', BACKSPACE: '51', DELETE: '117', SPACE: '49', UP: '126', DOWN: '125', LEFT: '123', RIGHT: '124', HOME: '115', END: '119' };
    return codes[key.toUpperCase()] || '36';
  }

  async getCursor() {
    const r = await this.exec(`osascript -e 'tell application "System Events" to get position of the mouse' 2>/dev/null || python3 -c 'import Quartz; p=Quartz.CGEventGetLocation(Quartz.CGEventCreate(None)); print(f"{int(p.x)},{int(p.y)}")' 2>/dev/null`);
    if (r.ok) {
      const match = r.stdout.match(/(\d+).?(\d+)/);
      if (match) return { ok: true, x: parseInt(match[1]), y: parseInt(match[2]) };
    }
    return { ok: false, x: 0, y: 0 };
  }

  async listWindows() {
    const r = await this.exec(`osascript -e 'tell application "System Events" to get name of every application process whose visible is true'`);
    if (r.ok) {
      const windows = r.stdout.split(',').map((t, i) => ({ id: i, title: t.trim(), name: t.trim() }));
      return { ok: true, windows };
    }
    return { ok: false, windows: [] };
  }

  async listProcesses() {
    const r = await this.exec('ps aux | head -31 | tail -30');
    if (r.ok) {
      const processes = r.stdout.split('\n').map(line => {
        const parts = line.split(/\s+/);
        return { user: parts[0], pid: parseInt(parts[1]), cpu: parseFloat(parts[2]), mem: parseFloat(parts[3]), command: parts.slice(10).join(' ') };
      });
      return { ok: true, processes };
    }
    return { ok: false, processes: [] };
  }

  async getScreenResolution() {
    const r = this.execSync('system_profiler SPDisplaysDataType 2>/dev/null | grep Resolution');
    if (r.ok) {
      const match = r.output.match(/(\d+)\s*x\s*(\d+)/);
      if (match) return { width: parseInt(match[1]), height: parseInt(match[2]) };
    }
    return { width: 1920, height: 1080 };
  }

  async notify(title, message) {
    const safeMsg = message.replace(/'/g, "\\'");
    const safeTtl = title.replace(/'/g, "\\'");
    return this.exec(`osascript -e 'display notification "${safeMsg}" with title "${safeTtl}"'`);
  }
}

// ─── Platform Singleton ────────────────────────────────────────────────────────

function createPlatform() {
  switch (OS) {
    case 'win32': return new WindowsAdapter();
    case 'darwin': return new DarwinAdapter();
    case 'linux': return new LinuxAdapter();
    default: return new LinuxAdapter(); // Fallback to Linux-like
  }
}

const platform = createPlatform();

export { platform, PlatformAdapter, WindowsAdapter, LinuxAdapter, DarwinAdapter };
export default platform;

#!/usr/bin/env node
import WebSocket from 'ws';
import { spawn, exec } from 'child_process';
import { randomUUID, createHash } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

const AGENT_SERVER_URL = process.env.AGENT_SERVER_URL || 'ws://localhost:21291/agent';
const AGENT_NAME = process.env.AGENT_NAME || os.hostname();
let AGENT_ID = process.env.AGENT_ID || '';
const AGENT_TOKEN = process.env.AGENT_TOKEN || '';
const SCREENSHOT_QUALITY = parseInt(process.env.SCREENSHOT_QUALITY || '60');
const SCREENSHOT_SCALE = parseFloat(process.env.SCREENSHOT_SCALE || '0.75');
const TEMP_DIR = path.join(os.tmpdir(), 'opencode-pc-agent');

fs.mkdirSync(TEMP_DIR, { recursive: true });

if (!AGENT_ID) {
  const idFile = path.join(TEMP_DIR, 'agent-id.txt');
  if (fs.existsSync(idFile)) {
    AGENT_ID = fs.readFileSync(idFile, 'utf8').trim();
  } else {
    AGENT_ID = randomUUID();
    fs.writeFileSync(idFile, AGENT_ID);
  }
}

let ws = null;
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 30000;
let lastScreenshotHash = null;
let psProcess = null;
let psPending = '';
let psResolve = null;

function log(...args) {
  console.log(`[pc-agent] ${new Date().toISOString()}`, ...args);
}

function initPS() {
  if (psProcess && psProcess.exitCode === null) return;
  psProcess = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', '-'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  psPending = '';
  psResolve = null;
  psProcess.stdout.on('data', (d) => {
    psPending += d.toString();
    const idx = psPending.indexOf('\0END\0');
    if (idx >= 0 && psResolve) {
      const result = psPending.slice(0, idx);
      psPending = psPending.slice(idx + 5);
      psResolve(result);
      psResolve = null;
    }
  });
  psProcess.stderr.on('data', () => {});
  psProcess.on('exit', () => {
    psProcess = null;
    if (psResolve) { psResolve(''); psResolve = null; }
  });
}

function runPSSync(script) {
  return new Promise((resolve, reject) => {
    initPS();
    const full = script + '\nWrite-Host "\0END\0"\n';
    const timeout = setTimeout(() => {
      if (psResolve) { psResolve(''); psResolve = null; }
      reject(new Error('PS timeout'));
    }, 30000);
    psResolve = (result) => { clearTimeout(timeout); resolve(result.trim()); };
    if (psProcess?.stdin?.writable) {
      psProcess.stdin.write(full);
    } else {
      clearTimeout(timeout);
      psResolve = null;
      runPSLegacy(script).then(resolve).catch(reject);
    }
  });
}

function runPSLegacy(script) {
  return new Promise((resolve, reject) => {
    const ps = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script]);
    let stdout = '', stderr = '';
    ps.stdout.on('data', (d) => stdout += d.toString());
    ps.stderr.on('data', (d) => stderr += d.toString());
    ps.on('close', (code) => {
      if (code !== 0 && !stdout.trim()) reject(new Error(stderr || `exit ${code}`));
      else resolve(stdout.trim());
    });
    ps.on('error', reject);
  });
}

function runCmd(command) {
  return new Promise((resolve, reject) => {
    exec(command, { encoding: 'utf8', timeout: 15000 }, (err, stdout) => {
      if (err) resolve(stdout?.trim() || err.message);
      else resolve(stdout.trim());
    });
  });
}

async function takeScreenshot(options = {}) {
  const quality = options.quality || SCREENSHOT_QUALITY;
  const scale = options.scale || SCREENSHOT_SCALE;
  const fp = path.join(TEMP_DIR, `ss_${Date.now()}.jpg`);
  const script = `
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    $screen = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bmp = New-Object System.Drawing.Bitmap ([int]($screen.Width * ${scale})), ([int]($screen.Height * ${scale}))
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.CopyFromScreen($screen.Location, [System.Drawing.Point]::Empty, [System.Drawing.Size]::new([int]($screen.Width * ${scale}), [int]($screen.Height * ${scale})))
    $g.Dispose()
    $encoder = [System.Drawing.Imaging.Encoder]::Quality
    $params = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter($encoder, [long]${quality})
    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $bmp.Save('${fp.replace(/\\/g, '\\')}', $codec, $params)
    $bmp.Dispose()
  `;
  await runPSSync(script);
  if (!fs.existsSync(fp)) return { ok: false, error: 'Screenshot failed' };
  const buf = fs.readFileSync(fp);
  const hash = createHash('md5').update(buf).digest('hex');
  if (hash === lastScreenshotHash && !options.force) {
    try { fs.unlinkSync(fp); } catch {}
    return { ok: true, unchanged: true, hash };
  }
  lastScreenshotHash = hash;
  const base64 = buf.toString('base64');
  try { fs.unlinkSync(fp); } catch {}
  const dims = await getScreenDims();
  return {
    ok: true, base64, hash,
    width: Math.round(dims.width * scale),
    height: Math.round(dims.height * scale),
    originalWidth: dims.width,
    originalHeight: dims.height,
    format: 'jpeg', quality, scale
  };
}

async function getScreenDims() {
  try {
    const r = await runPSSync(`
      Add-Type -AssemblyName System.Windows.Forms
      $s = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
      Write-Host "$($s.Width),$($s.Height)"
    `);
    const [w, h] = r.split(',').map(Number);
    return { width: w || 1920, height: h || 1080 };
  } catch {
    return { width: 1920, height: 1080 };
  }
}

async function sysinfo() {
  const info = {
    platform: os.platform(), hostname: os.hostname(),
    username: os.userInfo().username,
    totalMemoryGB: Math.round(os.totalmem() / 1024 / 1024 / 1024),
    freeMemoryGB: Math.round(os.freemem() / 1024 / 1024 / 1024),
    cpus: os.cpus().length, arch: os.arch()
  };
  try {
    const r = await runPSSync(`Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,InstallDate,LastBootUpTime | ConvertTo-Json -Compress`);
    Object.assign(info, JSON.parse(r));
  } catch {}
  return { ok: true, info };
}

async function listWindows() {
  try {
    const r = await runPSSync(`
      Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        using System.Text;
        using System.Collections.Generic;
        public class WinAPI {
          [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
          [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int count);
          [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
          [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
          [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
          [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
          public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
          public static List<object> GetWindows() {
            var list = new List<object>();
            EnumWindows((hWnd, lParam) => {
              if (IsWindowVisible(hWnd)) {
                int len = GetWindowTextLength(hWnd);
                if (len > 0) {
                  StringBuilder sb = new StringBuilder(len + 1);
                  GetWindowText(hWnd, sb, sb.Capacity);
                  uint pid = 0;
                  GetWindowThreadProcessId(hWnd, out pid);
                  bool fg = hWnd == GetForegroundWindow();
                  list.Add(new { title = sb.ToString(), pid, foreground = fg });
                }
              }
              return true;
            }, IntPtr.Zero);
            return list;
          }
        }
"@
      $wins = [WinAPI]::GetWindows() | Where-Object { $_.title -notmatch '^(Program Manager|Search|$)' }
      $fg = $wins | Where-Object { $_.foreground } | Select-Object -First 1
      $all = $wins | ForEach-Object { "{\\\"title\\\":\\\"$($_.title -replace '\\\"','\\\\\\\"')\\\",\\\"pid\\\":$($_.pid),\\\"foreground\\\":$($_.foreground -eq $true)}" }
      Write-Host "{\\\"foreground\\\":$(if($fg){\\\"{\\\\\\\"title\\\\\\\":\\\\\\\"$($fg.title -replace '\\\"','\\\\\\\"')\\\\\\\",\\\\\\\"pid\\\\\\\":$($fg.pid)}\\\")else{\\\"null\\\"},\\\"windows\\\":[$($all -join ',')]}"
    `);
    return { ok: true, windows: JSON.parse(r.replace(/\\([\s\S])/g, '$1')) };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function getInstalledApps() {
  try {
    const r = await runPSSync(`
      Get-ItemProperty HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*, HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\* |
        Where-Object { $_.DisplayName } |
        Select-Object DisplayName, DisplayVersion, Publisher, InstallDate |
        ConvertTo-Json -Compress
    `);
    const apps = JSON.parse(r);
    return { ok: true, apps: Array.isArray(apps) ? apps.slice(0, 100) : [] };
  } catch {
    return { ok: true, apps: [] };
  }
}

async function getBrowserTabs() {
  try {
    const r = await runPSSync(`
      $result = @()
      $edgeProcesses = Get-Process msedge -ErrorAction SilentlyContinue
      foreach($p in $edgeProcesses) {
        try {
          $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId = $($p.Id)").CommandLine
          if ($cmd -match '--app-id=([^\\s]+)') { continue }
          if ($cmd -match 'chrome-extension://') { continue }
          $result += [PSCustomObject]@{ browser = 'Edge'; pid = $p.Id; cmd = $cmd.Substring(0, [Math]::Min($cmd.Length, 200)) }
        } catch {}
      }
      $chromeProcesses = Get-Process chrome -ErrorAction SilentlyContinue
      foreach($p in $chromeProcesses) {
        try {
          $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId = $($p.Id)").CommandLine
          if ($cmd -match '--app-id=') { continue }
          if ($cmd -match 'chrome-extension://') { continue }
          $result += [PSCustomObject]@{ browser = 'Chrome'; pid = $p.Id; cmd = $cmd.Substring(0, [Math]::Min($cmd.Length, 200)) }
        } catch {}
      }
      $firefoxProcesses = Get-Process firefox -ErrorAction SilentlyContinue
      foreach($p in $firefoxProcesses) {
        $result += [PSCustomObject]@{ browser = 'Firefox'; pid = $p.Id; cmd = $p.CommandLine.Substring(0, [Math]::Min(($p.CommandLine -split ' ')[0].Length, 200)) }
      }
      ConvertTo-Json -InputObject $result -Compress
    `);
    const tabs = JSON.parse(r || '[]');
    return { ok: true, browsers: Array.isArray(tabs) ? tabs : [] };
  } catch {
    return { ok: true, browsers: [] };
  }
}

async function mouseMove(x, y) {
  await runPSSync(`
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})
  `);
  return { ok: true };
}

async function mouseClick(button = 'left') {
  const down = button.toLowerCase() === 'right' ? '0x00000008' : '0x00000002';
  const up = button.toLowerCase() === 'right' ? '0x00000010' : '0x00000004';
  await runPSSync(`
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class Mouse {
        [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, IntPtr dwExtraInfo);
      }
"@
    [Mouse]::mouse_event(${down}, 0, 0, 0, [IntPtr]::Zero)
    Start-Sleep -Milliseconds 30
    [Mouse]::mouse_event(${up}, 0, 0, 0, [IntPtr]::Zero)
  `);
  return { ok: true };
}

async function mouseDoubleClick() {
  await runPSSync(`
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class Mouse {
        [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, IntPtr dwExtraInfo);
      }
"@
    [Mouse]::mouse_event(0x00000002, 0, 0, 0, [IntPtr]::Zero)
    Start-Sleep -Milliseconds 30
    [Mouse]::mouse_event(0x00000004, 0, 0, 0, [IntPtr]::Zero)
    Start-Sleep -Milliseconds 50
    [Mouse]::mouse_event(0x00000002, 0, 0, 0, [IntPtr]::Zero)
    Start-Sleep -Milliseconds 30
    [Mouse]::mouse_event(0x00000004, 0, 0, 0, [IntPtr]::Zero)
  `);
  return { ok: true };
}

async function mouseScroll(clicks = 3) {
  const abs = Math.abs(clicks);
  const dir = clicks > 0 ? '120' : '-120';
  let cmds = '';
  for (let i = 0; i < abs; i++) {
    cmds += `[Mouse]::mouse_event(0x0800, 0, 0, ${dir}, [IntPtr]::Zero)\n`;
  }
  await runPSSync(`
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class Mouse {
        [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, IntPtr dwExtraInfo);
      }
"@
    ${cmds}
  `);
  return { ok: true };
}

async function keyboardType(text) {
  const escaped = text.replace(/'/g, "''").replace(/\{/g, '{{').replace(/\}/g, '}}');
  await runPSSync(`
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.SendKeys]::SendWait('${escaped}');
  `);
  return { ok: true };
}

async function keyboardPress(key) {
  const map = {
    'ENTER': '{ENTER}', 'RETURN': '{ENTER}', 'ESC': '{ESC}', 'ESCAPE': '{ESC}',
    'TAB': '{TAB}', 'BACKSPACE': '{BACKSPACE}', 'DELETE': '{DELETE}', 'DEL': '{DELETE}',
    'HOME': '{HOME}', 'END': '{END}', 'UP': '{UP}', 'DOWN': '{DOWN}', 'LEFT': '{LEFT}', 'RIGHT': '{RIGHT}',
    'F1': '{F1}', 'F2': '{F2}', 'F3': '{F3}', 'F4': '{F4}', 'F5': '{F5}', 'F6': '{F6}',
    'F7': '{F7}', 'F8': '{F8}', 'F9': '{F9}', 'F10': '{F10}', 'F11': '{F11}', 'F12': '{F12}',
    'SPACE': ' ', 'SPACEBAR': ' ', 'PAGEUP': '{PGUP}', 'PAGEDOWN': '{PGDN}',
    'INSERT': '{INSERT}', 'CAPSLOCK': '{CAPSLOCK}', 'NUMLOCK': '{NUMLOCK}'
  };
  const send = map[key.toUpperCase()] || key;
  const escaped = send.replace(/'/g, "''");
  await runPSSync(`
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.SendKeys]::SendWait('${escaped}');
  `);
  return { ok: true };
}

async function keyboardShortcut(modifiers, key) {
  const modMap = { 'ctrl': '^', 'alt': '%', 'shift': '+', 'win': '#' };
  const modStr = (modifiers || []).map(m => modMap[m.toLowerCase()] || '').join('');
  const combo = `${modStr}${key}`;
  const escaped = combo.replace(/'/g, "''");
  await runPSSync(`
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.SendKeys]::SendWait('${escaped}');
  `);
  return { ok: true, combo };
}

async function dragAndDrop(x1, y1, x2, y2) {
  await runPSSync(`
    Add-Type @"
      using System;
      using System.Runtime.InteropServices;
      public class Mouse {
        [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, IntPtr dwExtraInfo);
        [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
      }
"@
    Add-Type -AssemblyName System.Windows.Forms
    [Mouse]::SetCursorPos(${x1}, ${y1})
    Start-Sleep -Milliseconds 50
    [Mouse]::mouse_event(0x00000002, 0, 0, 0, [IntPtr]::Zero)
    Start-Sleep -Milliseconds 100
    [Mouse]::SetCursorPos(${x2}, ${y2})
    Start-Sleep -Milliseconds 50
    [Mouse]::mouse_event(0x00000004, 0, 0, 0, [IntPtr]::Zero)
  `);
  return { ok: true };
}

async function openUrl(url) {
  await runCmd(`start "" "${url}"`);
  return { ok: true };
}

async function openFile(fp) {
  await runCmd(`start "" "${fp}"`);
  return { ok: true };
}

async function readFile(fp) {
  const content = fs.readFileSync(fp, 'utf8');
  return { ok: true, content };
}

async function writeFile(fp, content) {
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, content, 'utf8');
  return { ok: true };
}

async function listDir(dirPath) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });
  return {
    ok: true,
    entries: entries.map(e => ({ name: e.name, isDirectory: e.isDirectory(), isFile: e.isFile() }))
  };
}

async function getClipboard() {
  try {
    const r = await runPSSync(`
      Add-Type -AssemblyName System.Windows.Forms
      [System.Windows.Forms.Clipboard]::GetText()
    `);
    return { ok: true, text: r };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function setClipboard(text) {
  const escaped = text.replace(/'/g, "''");
  await runPSSync(`
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.Clipboard]::SetText('${escaped}')
  `);
  return { ok: true };
}

async function notify(message, title = 'OpenCode') {
  await runPSSync(`
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show('${message.replace(/'/g, "''")}', '${title.replace(/'/g, "''")}')
  `);
  return { ok: true };
}

async function getCursorPos() {
  try {
    const r = await runPSSync(`
      Add-Type -AssemblyName System.Windows.Forms
      $p = [System.Windows.Forms.Cursor]::Position
      Write-Host "$($p.X),$($p.Y)"
    `);
    const [x, y] = r.split(',').map(Number);
    return { ok: true, x, y };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function focusWindow(pid) {
  try {
    await runPSSync(`
      Add-Type @"
        using System;
        using System.Runtime.InteropServices;
        public class Win {
          [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
          [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);
          [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
          [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
          public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
          public static void FocusByPid(uint targetPid) {
            EnumWindows((hWnd, lParam) => {
              uint pid = 0;
              GetWindowThreadProcessId(hWnd, out pid);
              if (pid == targetPid) { ShowWindowAsync(hWnd, 9); SetForegroundWindow(hWnd); }
              return true;
            }, IntPtr.Zero);
          }
        }
"@
      [Win]::FocusByPid(${pid})
    `);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function downloadFile(url, dest) {
  try {
    const escapedDest = dest.replace(/\\/g, '\\\\').replace(/'/g, "''");
    await runPSLegacy(`
      (New-Object System.Net.WebClient).DownloadFile('${url.replace(/'/g, "''")}', '${escapedDest}')
    `);
    return { ok: true, path: dest };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function waitForScreenStable(ms = 500) {
  await new Promise(r => setTimeout(r, ms));
  return { ok: true };
}

async function executeCommand(cmd) {
  try {
    switch (cmd.type) {
      case 'screenshot': return await takeScreenshot(cmd);
      case 'powershell': return { ok: true, output: await runPSSync(cmd.script || '') };
      case 'cmd': return { ok: true, output: await runCmd(cmd.command || '') };
      case 'open_url': return await openUrl(cmd.url);
      case 'open_file': return await openFile(cmd.path);
      case 'read_file': return await readFile(cmd.path);
      case 'write_file': return await writeFile(cmd.path, cmd.content);
      case 'list_dir': return await listDir(cmd.path);
      case 'mouse_click': return await mouseClick(cmd.button);
      case 'mouse_double_click': return await mouseDoubleClick();
      case 'mouse_move': return await mouseMove(cmd.x, cmd.y);
      case 'mouse_scroll': return await mouseScroll(cmd.clicks);
      case 'drag_and_drop': return await dragAndDrop(cmd.x1, cmd.y1, cmd.x2, cmd.y2);
      case 'keyboard_type': return await keyboardType(cmd.text);
      case 'keyboard_press': return await keyboardPress(cmd.key);
      case 'keyboard_shortcut': return await keyboardShortcut(cmd.modifiers, cmd.key);
      case 'sysinfo': return await sysinfo();
      case 'list_windows': return await listWindows();
      case 'list_apps': return await getInstalledApps();
      case 'browser_tabs': return await getBrowserTabs();
      case 'get_clipboard': return await getClipboard();
      case 'set_clipboard': return await setClipboard(cmd.text);
      case 'get_cursor': return await getCursorPos();
      case 'focus_window': return await focusWindow(cmd.pid);
      case 'download_file': return await downloadFile(cmd.url, cmd.path);
      case 'wait': await new Promise(r => setTimeout(r, cmd.ms || 500)); return { ok: true };
      case 'notify': return await notify(cmd.message, cmd.title);
      case 'screenshot_stable': return await takeScreenshot(cmd);
      default: return { ok: false, error: `Comando desconocido: ${cmd.type}` };
    }
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function connect() {
  log(`Conectando a ${AGENT_SERVER_URL} como ${AGENT_NAME} (${AGENT_ID})`);
  const options = { headers: { 'x-agent-name': AGENT_NAME, 'x-agent-id': AGENT_ID } };
  if (AGENT_TOKEN) options.headers['Authorization'] = `Bearer ${AGENT_TOKEN}`;

  ws = new WebSocket(AGENT_SERVER_URL, options);

  ws.on('open', () => {
    reconnectDelay = 1000;
    log('Conectado al agent-server');
    ws.send(JSON.stringify({
      type: 'register',
      agentName: AGENT_NAME,
      agentId: AGENT_ID,
      sysinfo: {
        platform: os.platform(), hostname: os.hostname(),
        username: os.userInfo().username, arch: os.arch()
      }
    }));
  });

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'ping') { ws.send(JSON.stringify({ type: 'pong' })); return; }
      if (msg.type === 'registered') { log('Registrado'); return; }
      if (msg.type === 'command' && msg.requestId) {
        const result = await executeCommand(msg.cmd);
        ws.send(JSON.stringify({ type: 'result', requestId: msg.requestId, result }));
      }
    } catch (err) {
      log('Error:', err.message);
    }
  });

  ws.on('close', () => {
    log(`Desconectado. Reconectando en ${reconnectDelay}ms...`);
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 1.5, MAX_RECONNECT_DELAY);
  });

  ws.on('error', () => {});
}

connect();

process.on('SIGINT', () => {
  log('Deteniendo...');
  if (psProcess) psProcess.kill();
  if (ws) ws.close();
  process.exit(0);
});

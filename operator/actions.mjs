import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { setTimeout as sleep } from 'timers/promises';
import puppeteer from 'puppeteer';

let _browser = null;
let _page = null;
async function getBrowser() {
  if (_browser) {
    try { _browser.close(); } catch {}
  }
  try {
    _browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null });
  } catch {
    _browser = null;
  }
  return _browser;
}
async function getPage(urlMatch) {
  const b = await getBrowser();
  if (!b) return null;
  const pages = await b.pages();
  if (urlMatch) {
    const found = pages.find(p => p.url().includes(urlMatch));
    if (found) { _page = found; return _page; }
  }
  _page = pages[0];
  return _page;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SS_DIR = path.join(__dirname, 'screenshots');
fs.mkdirSync(SS_DIR, { recursive: true });

function powershell(script) {
  try {
    const out = execSync(
      `powershell -NoProfile -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`,
      { timeout: 30000, encoding: 'utf8', maxBuffer: 1024 * 1024 }
    );
    return { ok: true, output: out.trim() };
  } catch (e) {
    return { ok: false, error: e.message, output: e.stdout?.trim() || '' };
  }
}

export async function execute(action) {
  if (!action || !action.type) return { ok: false, error: 'acción inválida' };

  action.type = action.type.toLowerCase();

  const t0 = Date.now();

  try {
    let result;
    switch (action.type) {
      case 'screenshot':        result = await screenshot(action.params); break;
      case 'mouse_move':        result = mouseMove(action.params); break;
      case 'mouse_click':       result = mouseClick(action.params); break;
      case 'mouse_double_click': result = powershell('Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("{DOUBLECLICK}")'); break;
      case 'mouse_scroll':      result = scroll(action.params); break;
      case 'keyboard_type':     result = keyboardType(action.params); break;
      case 'keyboard_press':    result = keyboardPress(action.params); break;
      case 'get_clipboard':     result = powershell('Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::GetText()'); break;
      case 'set_clipboard':     result = powershell(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::SetText("${(action.params?.text||'').replace(/"/g,'""')}")`); break;
      case 'sysinfo':           result = powershell('Write-Host "OS:$((Get-WmiObject Win32_OperatingSystem).Caption) RAM:$([Math]::Round((Get-WmiObject Win32_ComputerSystem).TotalPhysicalMemory/1GB))GB CPU:$(Get-WmiObject Win32_Processor).Name HOST:$env:COMPUTERNAME"'); break;
      case 'list_windows':      result = powershell('Get-Process | Where-Object {$_.MainWindowTitle} | Select-Object Id, Name, @{N="Title";E={$_.MainWindowTitle}} | ConvertTo-Json -Compress'); break;
      case 'list_apps':         result = powershell('Get-ItemProperty "HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*" | Select-Object DisplayName | ConvertTo-Json -Compress'); break;
      case 'get_cursor':        result = powershell('Add-Type -AssemblyName System.Windows.Forms; Write-Host "$([System.Windows.Forms.Cursor]::Position.X),$([System.Windows.Forms.Cursor]::Position.Y)"'); break;
      case 'focus_window':      result = powershell(`(Get-Process -Id ${action.params?.pid||0}).MainWindowHandle | ForEach-Object { Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("%({TAB})") }`); break;
      case 'powershell':        result = powershell(action.params?.script || ''); break;
      case 'browser_goto':     result = await browserGoto(action.params); break;
      case 'browser_click':    result = await browserClick(action.params); break;
      case 'browser_type':     result = await browserType(action.params); break;
      case 'browser_evaluate': result = await browserEvaluate(action.params); break;
      case 'browser_screenshot': result = await browserScreenshot(action.params); break;
      case 'browser_wait':     result = await browserWait(action.params); break;
      case 'open_url':          result = powershell(`Start-Process "${(action.params?.url||'https://google.com').replace(/"/g,'\\"')}"`); break;
      case 'open_file':         result = powershell(`Start-Process "${(action.params?.path||'').replace(/"/g,'\\"')}"`); break;
      case 'read_file':         result = readFile(action.params); break;
      case 'write_file':        result = writeFile(action.params); break;
      case 'list_dir':          result = listDir(action.params); break;
      case 'notify':            result = powershell("Add-Type -AssemblyName System.Windows.Forms; $n=New-Object System.Windows.Forms.NotifyIcon; $n.Icon=[System.Drawing.SystemIcons]::Information; $n.BalloonTipText=\"" + (action.params?.message||'').replace(/"/g,'""') + '"; $n.BalloonTipTitle="' + (action.params?.title||'Operator').replace(/"/g,'""') + '"; $n.Visible=$true; $n.ShowBalloonTip(3000)'); break;
      case 'wait':              await sleep(action.params?.ms || 1000); result = { ok: true, waited: action.params?.ms || 1000 }; break;
      case 'done':              result = { ok: true, done: true, message: action.params?.message || 'completado' }; break;
      default:                  result = { ok: false, error: `acción desconocida: ${action.type}` };
    }
    result.duration = Date.now() - t0;
    return result;
  } catch (e) {
    return { ok: false, error: e.message, duration: Date.now() - t0 };
  }
}

async function screenshot(params) {
  const q = params?.quality || 50;
  const s = params?.scale || 0.75;
  const filename = `ss_${Date.now()}.png`;
  const filepath = path.join(SS_DIR, filename);
  try {
    execSync(
      `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; Add-Type -AssemblyName System.Drawing; $b=[Windows.Forms.Screen]::PrimaryScreen.Bounds; $bmp=New-Object Drawing.Bitmap $b.Width,$b.Height; $g=[Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen(0,0,0,0,$b.Size); $bmp.Save('${filepath}','PNG'); $g.Dispose(); $bmp.Dispose()"`,
      { timeout: 10000 }
    );
    const base64 = fs.readFileSync(filepath).toString('base64');
    return { ok: true, file: filepath, base64, size: base64.length, width: 1920, height: 1080 };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function mouseMove(params) {
  const x = params?.x ?? 0, y = params?.y ?? 0;
  return powershell(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point ${x},${y}`);
}

function mouseClick(params) {
  const btn = params?.button || 'left';
  const x = params?.x, y = params?.y;
  let script = 'Add-Type -AssemblyName System.Windows.Forms; Add-Type -TypeDefinition @"\nusing System.Runtime.InteropServices; public class Mouse { [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, int dwExtraInfo); }\n"@; ';
  if (x !== undefined && y !== undefined) script += `[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point ${x},${y}; `;
  if (btn === 'right') script += '[Mouse]::mouse_event(0x0008,0,0,0,0); [Mouse]::mouse_event(0x0010,0,0,0,0)';
  else script += '[Mouse]::mouse_event(0x0002,0,0,0,0); [Mouse]::mouse_event(0x0004,0,0,0,0)';
  return powershell(script);
}

function scroll(params) {
  const clicks = params?.clicks || 3;
  return powershell(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("{PGDN".PadRight(7+[Math]::Abs(${clicks}),'}')})`);
}

function keyboardType(params) {
  const text = params?.text || '';
  return powershell(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("${text.replace(/"/g,'""').replace(/\n/g,'{ENTER}').replace(/\t/g,'{TAB}')}")`);
}

function keyboardPress(params) {
  const key = (params?.key || 'ENTER').toUpperCase();
  const keyMap = { ENTER: '{ENTER}', TAB: '{TAB}', ESC: '{ESC}', BACKSPACE: '{BACKSPACE}', DELETE: '{DELETE}', HOME: '{HOME}', END: '{END}', UP: '{UP}', DOWN: '{DOWN}', LEFT: '{LEFT}', RIGHT: '{RIGHT}', SPACE: ' ', F1: '{F1}', F2: '{F2}', F3: '{F3}', F4: '{F4}', F5: '{F5}', F6: '{F6}', F7: '{F7}', F8: '{F8}', F9: '{F9}', F10: '{F10}', F11: '{F11}', F12: '{F12}' };
  return powershell(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("${keyMap[key] || '{'+key+'}'}")`);
}

function readFile(params) {
  try {
    const content = fs.readFileSync(params?.path || '', 'utf8');
    return { ok: true, content, size: content.length };
  } catch (e) { return { ok: false, error: e.message }; }
}

function writeFile(params) {
  try {
    fs.writeFileSync(params?.path || '', params?.content || '', 'utf8');
    return { ok: true, path: params?.path };
  } catch (e) { return { ok: false, error: e.message }; }
}

function listDir(params) {
  try {
    const files = fs.readdirSync(params?.path || '.', { withFileTypes: true });
    return { ok: true, files: files.map(f => ({ name: f.name, isDir: f.isDirectory(), isFile: f.isFile() })) };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function browserGoto(params) {
  try {
    const page = await getPage();
    if (!page) return { ok: false, error: 'Chrome no disponible (remote debugging requerido en :9222)' };
    await page.goto(params?.url, { timeout: params?.timeout || 30000, waitUntil: 'networkidle2' }).catch(() => {});
    await sleep(params?.wait || 2000);
    return { ok: true, url: page.url(), title: await page.title() };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function browserClick(params) {
  try {
    const page = await getPage();
    if (!page) return { ok: false, error: 'Chrome no disponible' };
    const text = params?.text || '';
    const selector = params?.selector || '';
    if (selector) {
      await page.waitForSelector(selector, { timeout: 5000 }).catch(() => {});
      await page.click(selector);
    } else if (text) {
      const els = await page.$$('button, [role="button"], a, span, label, div[role="option"], li');
      let clicked = false;
      for (const el of els) {
        const t = await el.evaluate(e => (e.textContent || '').trim().toLowerCase());
        if (t.includes(text.toLowerCase())) {
          await el.click();
          clicked = true;
          break;
        }
      }
      if (!clicked) return { ok: false, error: `elemento con texto "${text}" no encontrado` };
    } else {
      return { ok: false, error: 'especifica text o selector' };
    }
    await sleep(params?.wait || 1000);
    return { ok: true, clicked: text || selector };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function browserType(params) {
  try {
    const page = await getPage();
    if (!page) return { ok: false, error: 'Chrome no disponible' };
    const text = params?.text || '';
    if (params?.selector) {
      await page.waitForSelector(params.selector, { timeout: 3000 }).catch(() => {});
      await page.type(params.selector, text, { delay: params?.delay || 20 });
    } else {
      await page.keyboard.type(text, { delay: params?.delay || 20 });
    }
    return { ok: true, typed: text.substring(0, 50) + (text.length > 50 ? '...' : '') };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function browserEvaluate(params) {
  try {
    const page = await getPage();
    if (!page) return { ok: false, error: 'Chrome no disponible' };
    const code = params?.code || params?.script || '';
    const result = await page.evaluate(new Function(code));
    return { ok: true, result: typeof result === 'object' ? JSON.stringify(result).substring(0, 500) : String(result).substring(0, 500) };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function browserScreenshot(params) {
  try {
    const page = await getPage();
    if (!page) return { ok: false, error: 'Chrome no disponible' };
    const filename = `browser_${Date.now()}.png`;
    const filepath = path.join(SS_DIR, filename);
    await page.screenshot({ path: filepath, fullPage: params?.fullPage || false });
    const base64 = fs.readFileSync(filepath).toString('base64');
    return { ok: true, file: filepath, base64, size: base64.length };
  } catch (e) { return { ok: false, error: e.message }; }
}

async function browserWait(params) {
  await sleep(params?.ms || 2000);
  return { ok: true, waited: params?.ms || 2000 };
}

#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║          OpenCode Evolved — MCP Body Controller             ║
 * ║                                                              ║
 * ║  Le da al AI un CUERPO DIGITAL COMPLETO:                    ║
 * ║  • Manos   → teclado (xdotool type), keyboard shortcuts     ║
 * ║  • Pies    → navegador (Playwright click/scroll/navigate)   ║
 * ║  • Ojos    → captura de pantalla, visión web                ║
 * ║  • Voz     → notificaciones, alertas                        ║
 * ║  • Memoria → contexto persistente de sesión                 ║
 * ║  • Músculo → ejecución de scripts, automatización compleja  ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { createInterface } from "readline";
import { execSync, exec } from "child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";
import http from "http";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = process.env.OPENCODE_WORKSPACE || "/home/kenneth/Hello-World";
const MEMORY_FILE = join(WORKSPACE, ".opencode", "body-memory.json");
const PW_BROWSERS = process.env.PLAYWRIGHT_BROWSERS_PATH || join(WORKSPACE, ".cache/ms-playwright");

function send(obj) { process.stdout.write(JSON.stringify(obj) + "\n"); }
function ok(id, text) { send({ jsonrpc:"2.0", id, result:{ content:[{ type:"text", text:String(text) }] } }); }
function fail(id, msg) { send({ jsonrpc:"2.0", id, result:{ content:[{ type:"text", text:`❌ ${msg}` }], isError:true } }); }

function run(cmd, opts = {}) {
  return execSync(cmd, {
    encoding: "utf8",
    timeout: opts.timeout || 30000,
    shell: "/bin/bash",
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: PW_BROWSERS, DISPLAY: process.env.DISPLAY || ":0" },
    ...opts
  });
}

function loadMemory() {
  try {
    if (existsSync(MEMORY_FILE)) return JSON.parse(readFileSync(MEMORY_FILE, "utf8"));
  } catch {}
  return { sessions: [], facts: [], tasks: [], last_seen: null };
}

function saveMemory(mem) {
  mkdirSync(dirname(MEMORY_FILE), { recursive: true });
  writeFileSync(MEMORY_FILE, JSON.stringify(mem, null, 2));
}

// ── Playwright helper ─────────────────────────────────────────
async function playwright(script) {
  const tmp = `/tmp/body-pw-${Date.now()}.mjs`;
  const pw = await findPlaywright();
  const full = `
import { chromium } from '${pw}';
process.env.PLAYWRIGHT_BROWSERS_PATH = '${PW_BROWSERS}';
${script}
`;
  writeFileSync(tmp, full);
  try {
    return run(`node --experimental-vm-modules "${tmp}"`, { timeout: 60000 });
  } finally {
    try { run(`rm -f "${tmp}"`); } catch {}
  }
}

async function findPlaywright() {
  const candidates = [
    `${WORKSPACE}/node_modules/playwright/index.mjs`,
    `${WORKSPACE}/node_modules/@playwright/test/index.mjs`,
    `/home/runner/mcp-tools/node_modules/playwright/index.mjs`,
  ];
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  // Instalar playwright si no existe
  run(`cd ${WORKSPACE} && npm install playwright --no-save 2>/dev/null || true`, { timeout: 60000 });
  return `${WORKSPACE}/node_modules/playwright/index.mjs`;
}

// ════════════════════════════════════════════════════════════════
//  DEFINICIÓN DE HERRAMIENTAS — EL CUERPO DIGITAL
// ════════════════════════════════════════════════════════════════
const tools = [

  // ╔══════════════╗
  // ║  MANOS       ║  Teclado — escribir, atajos, comandos
  // ╚══════════════╝
  {
    name: "keyboard_type",
    description: `MANOS — Escribe texto con el teclado virtual (xdotool).
Úsalo para: llenar campos en interfaces locales, escribir en terminales, componer texto.
Admite texto normal y caracteres especiales.
NOTA: Para control de NAVEGADOR usa browser_type_text que es más preciso.`,
    inputSchema: {
      type: "object",
      properties: {
        text:        { type: "string", description: "Texto a escribir" },
        delay_ms:    { type: "number", default: 0, description: "Delay entre teclas en ms (0=instantáneo, 50=humano)" },
        clear_first: { type: "boolean", default: false, description: "Si true, selecciona todo (Ctrl+A) y borra antes de escribir" }
      },
      required: ["text"]
    }
  },

  {
    name: "keyboard_shortcut",
    description: `MANOS — Ejecuta atajos de teclado: Ctrl+C, Alt+F4, Ctrl+Alt+T, etc.
Ejemplos: "ctrl+c", "ctrl+v", "alt+F4", "super", "ctrl+shift+i"`,
    inputSchema: {
      type: "object",
      properties: {
        keys: { type: "string", description: "Combinación de teclas ej: ctrl+c, alt+F4, ctrl+shift+i" },
        times: { type: "number", default: 1, description: "Cuántas veces ejecutar" }
      },
      required: ["keys"]
    }
  },

  {
    name: "keyboard_press_key",
    description: `MANOS — Presiona una tecla especial: Enter, Tab, Escape, F5, ArrowUp, BackSpace, Delete, etc.`,
    inputSchema: {
      type: "object",
      properties: {
        key:   { type: "string", description: "Tecla: Return, Tab, Escape, F1-F12, Left, Right, Up, Down, BackSpace, Delete, Home, End, Page_Up, Page_Down" },
        times: { type: "number", default: 1 }
      },
      required: ["key"]
    }
  },

  // ╔══════════════╗
  // ║  PIES        ║  Mouse — moverse, clicar, scroll, arrastrar
  // ╚══════════════╝
  {
    name: "mouse_click",
    description: `PIES — Hace clic del mouse en coordenadas X,Y de la pantalla.
Botones: left (izquierda), right (derecha), middle (rueda), double (doble clic).
NOTA: Para clics en NAVEGADOR usa browser_click que es más preciso con selectores CSS.`,
    inputSchema: {
      type: "object",
      properties: {
        x:      { type: "number", description: "Coordenada X en pixeles" },
        y:      { type: "number", description: "Coordenada Y en pixeles" },
        button: { type: "string", enum: ["left","right","middle","double"], default: "left" }
      },
      required: ["x","y"]
    }
  },

  {
    name: "mouse_move",
    description: "PIES — Mueve el cursor del mouse a las coordenadas X,Y",
    inputSchema: {
      type: "object",
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        smooth: { type: "boolean", default: false, description: "Movimiento suave (simula humano)" }
      },
      required: ["x","y"]
    }
  },

  {
    name: "mouse_scroll",
    description: "PIES — Rueda del mouse: scroll arriba o abajo",
    inputSchema: {
      type: "object",
      properties: {
        direction: { type: "string", enum: ["up","down","left","right"], default: "down" },
        amount:    { type: "number", default: 3, description: "Cantidad de scroll (1=poco, 10=mucho)" },
        x:         { type: "number", description: "Coordenada X donde hacer scroll (opcional)" },
        y:         { type: "number", description: "Coordenada Y donde hacer scroll (opcional)" }
      }
    }
  },

  {
    name: "mouse_drag",
    description: "PIES — Arrastra desde (x1,y1) hasta (x2,y2) — útil para mover ventanas, sliders, etc.",
    inputSchema: {
      type: "object",
      properties: {
        x1: { type: "number", description: "X origen" },
        y1: { type: "number", description: "Y origen" },
        x2: { type: "number", description: "X destino" },
        y2: { type: "number", description: "Y destino" }
      },
      required: ["x1","y1","x2","y2"]
    }
  },

  // ╔══════════════╗
  // ║  OJOS        ║  Ver la pantalla, analizar lo que hay
  // ╚══════════════╝
  {
    name: "screen_capture",
    description: `OJOS — Toma una captura de la pantalla actual o de una ventana.
Devuelve la ruta del archivo PNG y metadatos del sistema.
Usa esto para VER qué hay en pantalla antes de actuar.`,
    inputSchema: {
      type: "object",
      properties: {
        output_path: { type: "string", description: "Ruta donde guardar (default: /tmp/screen-TIMESTAMP.png)" },
        region: {
          type: "object",
          description: "Región específica {x,y,width,height} — si no se especifica, captura toda la pantalla",
          properties: { x:{type:"number"}, y:{type:"number"}, width:{type:"number"}, height:{type:"number"} }
        }
      }
    }
  },

  {
    name: "screen_get_info",
    description: "OJOS — Obtiene información sobre la pantalla: resolución, ventanas abiertas, procesos con GUI",
    inputSchema: { type: "object", properties: {} }
  },

  {
    name: "screen_find_text",
    description: "OJOS — Busca texto en la pantalla usando OCR (requiere tesseract). Devuelve si el texto fue encontrado y en qué posición.",
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Texto a buscar en pantalla" }
      },
      required: ["text"]
    }
  },

  // ╔══════════════╗
  // ║  NAVEGADOR   ║  Control total del browser — el cuerpo en la web
  // ╚══════════════╝
  {
    name: "browser_full_control",
    description: `CUERPO EN LA WEB — Control completo del navegador como si fuera un humano.
Puede: navegar URLs, hacer clic, escribir, scroll, esperar elementos, tomar screenshots, extraer datos.
Encadena acciones en secuencia para completar tareas web complejas.

Acciones disponibles:
- navigate: {url}
- click: {selector} o {x,y}  
- type: {selector, text}
- press: {key}  (Enter, Tab, Escape, etc.)
- scroll: {direction, amount}
- wait: {ms} o {selector}
- screenshot: {path}
- extract: {selector} → extrae texto
- evaluate: {js_code} → ejecuta JavaScript en la página
- hover: {selector}
- select_option: {selector, value}
- upload_file: {selector, file_path}
- get_url: → devuelve la URL actual
- get_title: → devuelve el título
- get_text: {selector} → texto del elemento`,
    inputSchema: {
      type: "object",
      properties: {
        actions: {
          type: "array",
          description: "Secuencia de acciones a ejecutar",
          items: {
            type: "object",
            properties: {
              action:   { type: "string" },
              url:      { type: "string" },
              selector: { type: "string" },
              text:     { type: "string" },
              key:      { type: "string" },
              x:        { type: "number" },
              y:        { type: "number" },
              ms:       { type: "number" },
              path:     { type: "string" },
              js_code:  { type: "string" },
              value:    { type: "string" },
              direction:{ type: "string" },
              amount:   { type: "number" },
              file_path:{ type: "string" }
            },
            required: ["action"]
          }
        },
        headless:       { type: "boolean", default: true },
        viewport_width: { type: "number", default: 1280 },
        viewport_height:{ type: "number", default: 720 },
        timeout_ms:     { type: "number", default: 60000 }
      },
      required: ["actions"]
    }
  },

  {
    name: "browser_automate_task",
    description: `CUERPO EN LA WEB — Automatiza una tarea web compleja descrita en lenguaje natural.
Describe QUÉ quieres hacer y el agente lo ejecuta paso a paso.
Ejemplos:
- "Ve a google.com, busca 'cotización dólar hoy' y dame el resultado"
- "Abre GitHub, inicia sesión y crea un issue en el repo X"
- "Ve a Twitter, publica el tweet: [texto]"
- "Llena el formulario en [URL] con los datos [datos]"`,
    inputSchema: {
      type: "object",
      properties: {
        task_description: { type: "string", description: "Descripción en lenguaje natural de la tarea a automatizar" },
        start_url:        { type: "string", description: "URL donde empezar (opcional)" },
        credentials: {
          type: "object",
          description: "Credenciales si se necesitan login",
          properties: {
            username: { type: "string" },
            password: { type: "string" }
          }
        }
      },
      required: ["task_description"]
    }
  },

  // ╔══════════════╗
  // ║  CLIPBOARD   ║  Portapapeles — copiar/pegar datos
  // ╚══════════════╝
  {
    name: "clipboard_copy",
    description: "MANOS — Copia texto al portapapeles del sistema (Ctrl+C equivalente)",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string", description: "Texto a copiar" } },
      required: ["text"]
    }
  },

  {
    name: "clipboard_paste",
    description: "MANOS — Lee el contenido actual del portapapeles",
    inputSchema: { type: "object", properties: {} }
  },

  // ╔══════════════╗
  // ║  PROCESOS    ║  Controlar apps, ventanas, procesos
  // ╚══════════════╝
  {
    name: "process_launch",
    description: `MÚSCULO — Lanza una aplicación o proceso en background.
Ejemplos: abrir un editor, iniciar un servidor, ejecutar un script.`,
    inputSchema: {
      type: "object",
      properties: {
        command:    { type: "string", description: "Comando a ejecutar" },
        background: { type: "boolean", default: true, description: "Si true, corre en background" },
        cwd:        { type: "string", default: "/home/runner/workspace" }
      },
      required: ["command"]
    }
  },

  {
    name: "process_list",
    description: "OJOS — Lista procesos corriendo con su PID, CPU y memoria",
    inputSchema: {
      type: "object",
      properties: {
        filter: { type: "string", description: "Filtrar por nombre de proceso (opcional)" }
      }
    }
  },

  {
    name: "process_kill",
    description: "MÚSCULO — Termina un proceso por PID o nombre",
    inputSchema: {
      type: "object",
      properties: {
        pid:  { type: "number", description: "PID del proceso" },
        name: { type: "string", description: "Nombre del proceso (alternativa al PID)" }
      }
    }
  },

  // ╔══════════════╗
  // ║  MEMORIA     ║  Recordar contexto entre acciones
  // ╚══════════════╝
  {
    name: "body_remember",
    description: `MEMORIA CORPORAL — Guarda información importante que el AI necesita recordar entre acciones.
Úsalo para: guardar credenciales temporales, progreso de tareas, resultados intermedios, URLs importantes.
Esta memoria persiste durante toda la sesión.`,
    inputSchema: {
      type: "object",
      properties: {
        key:   { type: "string", description: "Identificador único (ej: 'gmail_password', 'task_progress')" },
        value: { type: "string", description: "Valor a recordar" },
        note:  { type: "string", description: "Nota explicativa de por qué se guardó esto" }
      },
      required: ["key","value"]
    }
  },

  {
    name: "body_recall",
    description: "MEMORIA CORPORAL — Recupera información guardada previamente",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Clave a recuperar (vacío = toda la memoria)" }
      }
    }
  },

  // ╔══════════════╗
  // ║  EJECUCIÓN   ║  Scripts, automatización avanzada
  // ╚══════════════╝
  {
    name: "execute_automation_script",
    description: `MÚSCULO COMPLETO — Ejecuta un script de automatización complejo.
Admite: bash, python, node/javascript.
Úsalo para tareas que requieren lógica compleja: loops, condiciones, procesamiento de datos, etc.`,
    inputSchema: {
      type: "object",
      properties: {
        language: { type: "string", enum: ["bash","python","javascript","node"], description: "Lenguaje del script" },
        code:     { type: "string", description: "Código a ejecutar" },
        timeout:  { type: "number", default: 60, description: "Tiempo máximo en segundos" }
      },
      required: ["language","code"]
    }
  },

  {
    name: "body_status",
    description: `ESTADO CORPORAL — Muestra el estado actual de todas las capacidades del cuerpo digital:
- Teclado/Mouse (xdotool)
- Navegador (Playwright)
- Pantalla/Display
- Memoria
- Procesos activos
Úsalo al inicio de una sesión para saber qué puedes hacer.`,
    inputSchema: { type: "object", properties: {} }
  }
];

// ════════════════════════════════════════════════════════════════
//  IMPLEMENTACIÓN DE HANDLERS
// ════════════════════════════════════════════════════════════════
async function handle(name, args) {

  // ── TECLADO ──────────────────────────────────────────────────
  if (name === "keyboard_type") {
    const { text, delay_ms = 0, clear_first = false } = args;
    if (clear_first) run(`xdotool key ctrl+a`);
    if (delay_ms > 0) {
      run(`xdotool type --delay ${delay_ms} ${JSON.stringify(text)}`);
    } else {
      run(`xdotool type --clearmodifiers ${JSON.stringify(text)}`);
    }
    return `⌨️ Escrito: "${text.slice(0,50)}${text.length>50?"...":""}"`;
  }

  if (name === "keyboard_shortcut") {
    const { keys, times = 1 } = args;
    for (let i = 0; i < times; i++) {
      run(`xdotool key ${keys}`);
      if (i < times - 1) run(`sleep 0.1`);
    }
    return `⌨️ Atajo ejecutado: ${keys} × ${times}`;
  }

  if (name === "keyboard_press_key") {
    const { key, times = 1 } = args;
    for (let i = 0; i < times; i++) {
      run(`xdotool key ${key}`);
      if (i < times - 1) run(`sleep 0.05`);
    }
    return `⌨️ Tecla presionada: ${key} × ${times}`;
  }

  // ── MOUSE ─────────────────────────────────────────────────────
  if (name === "mouse_click") {
    const { x, y, button = "left" } = args;
    if (button === "double") {
      run(`xdotool mousemove ${x} ${y} click --repeat 2 1`);
    } else {
      const btn = button === "right" ? 3 : button === "middle" ? 2 : 1;
      run(`xdotool mousemove ${x} ${y} click ${btn}`);
    }
    return `🖱️ Clic ${button} en (${x}, ${y})`;
  }

  if (name === "mouse_move") {
    const { x, y, smooth = false } = args;
    if (smooth) {
      run(`xdotool mousemove --sync ${x} ${y}`);
    } else {
      run(`xdotool mousemove ${x} ${y}`);
    }
    return `🖱️ Mouse movido a (${x}, ${y})`;
  }

  if (name === "mouse_scroll") {
    const { direction = "down", amount = 3, x, y } = args;
    const posCmd = (x && y) ? `mousemove ${x} ${y} &&` : "";
    const btn = { up: 4, down: 5, left: 6, right: 7 }[direction] || 5;
    run(`${posCmd} xdotool click --repeat ${amount} ${btn}`);
    return `🖱️ Scroll ${direction} × ${amount}`;
  }

  if (name === "mouse_drag") {
    const { x1, y1, x2, y2 } = args;
    run(`xdotool mousemove ${x1} ${y1} mousedown 1 mousemove ${x2} ${y2} mouseup 1`);
    return `🖱️ Arrastrado de (${x1},${y1}) a (${x2},${y2})`;
  }

  // ── PANTALLA / OJOS ──────────────────────────────────────────
  if (name === "screen_capture") {
    const { output_path, region } = args;
    const out = output_path || `/tmp/screen-${Date.now()}.png`;
    try {
      if (region) {
        run(`import -window root -crop ${region.width}x${region.height}+${region.x}+${region.y} "${out}" 2>/dev/null || xwd -root -silent | convert xwd:- "${out}" 2>/dev/null || true`);
      } else {
        run(`import -window root "${out}" 2>/dev/null || xwd -root -silent | convert xwd:- "${out}" 2>/dev/null || scrot "${out}" 2>/dev/null || true`);
      }
      if (existsSync(out)) {
        const size = Math.round(readFileSync(out).length / 1024);
        return `📸 Screenshot guardado: ${out} (${size} KB)\n\nUsa el botón Visión Universal para analizar esta imagen, o usa Vision API directamente.`;
      }
      return `ℹ️ Captura intentada en ${out}. Para ver contenido web usa browser_full_control con action "screenshot".`;
    } catch (e) {
      return `ℹ️ Display headless activo. Para capturas usa browser_full_control con action "screenshot".`;
    }
  }

  if (name === "screen_get_info") {
    const info = [];
    try { info.push("📺 DISPLAY: " + (run(`echo $DISPLAY`).trim() || "no configurado")); } catch {}
    try { info.push("🖥️ Resolución: " + run(`xdotool getdisplaygeometry 2>/dev/null || echo "desconocida"`).trim()); } catch {}
    try { info.push("🪟 Ventanas activas:\n" + run(`xdotool search --onlyvisible --name "" 2>/dev/null | head -5 || echo "ninguna"`).trim()); } catch {}
    try { info.push("💻 Sistema: " + run(`uname -a`).trim()); } catch {}
    return info.join("\n\n");
  }

  if (name === "screen_find_text") {
    const { text } = args;
    try {
      const tmp = `/tmp/screen-ocr-${Date.now()}.png`;
      run(`import -window root "${tmp}" 2>/dev/null || true`);
      const result = run(`tesseract "${tmp}" stdout 2>/dev/null | grep -i "${text.replace(/"/g,'\\"')}" || echo "NO ENCONTRADO"`).trim();
      return result === "NO ENCONTRADO"
        ? `👁️ Texto "${text}" NO encontrado en pantalla`
        : `👁️ Texto "${text}" ENCONTRADO:\n${result}`;
    } catch {
      return `ℹ️ OCR no disponible. Para buscar texto en páginas web usa browser_full_control con action "extract".`;
    }
  }

  // ── NAVEGADOR COMPLETO ────────────────────────────────────────
  if (name === "browser_full_control") {
    const { actions, headless = true, viewport_width = 1280, viewport_height = 720 } = args;
    const results = [];
    const actionsCode = actions.map(a => {
      const q = s => JSON.stringify(s || "");
      switch (a.action) {
        case "navigate":   return `results.push('→ Nav: ' + ${q(a.url)}); await page.goto(${q(a.url)}, {waitUntil:'domcontentloaded', timeout:30000});`;
        case "click":
          if (a.x !== undefined && a.y !== undefined)
            return `results.push('→ Click en (${a.x},${a.y})'); await page.mouse.click(${a.x}, ${a.y});`;
          return `results.push('→ Click: ' + ${q(a.selector)}); await page.click(${q(a.selector)}, {timeout:10000});`;
        case "type":       return `results.push('→ Tipo en ' + ${q(a.selector)}); await page.fill(${q(a.selector)}, ${q(a.text)});`;
        case "press":      return `results.push('→ Tecla: ' + ${q(a.key)}); await page.keyboard.press(${q(a.key)});`;
        case "scroll":     return `results.push('→ Scroll ' + ${q(a.direction||'down')}); await page.evaluate(()=>window.scrollBy(0, ${a.direction==='up'?-200:200} * ${a.amount||3}));`;
        case "wait":
          if (a.selector)  return `results.push('→ Esperar: ' + ${q(a.selector)}); await page.waitForSelector(${q(a.selector)}, {timeout:15000});`;
          return `results.push('→ Esperar ' + ${a.ms||1000} + 'ms'); await page.waitForTimeout(${a.ms||1000});`;
        case "screenshot": return `results.push('→ Screenshot: ' + ${q(a.path||'/tmp/browser-ss.png')}); await page.screenshot({path:${q(a.path||'/tmp/browser-ss.png')},fullPage:false}); results.push('📸 Guardado: ${a.path||"/tmp/browser-ss.png"}');`;
        case "extract":    return `{ const el = await page.$(${q(a.selector)}); const t = el ? await el.textContent() : null; results.push('→ Extraído de ' + ${q(a.selector)} + ': ' + (t||'null').trim().slice(0,500)); }`;
        case "evaluate":   return `{ const ev = await page.evaluate(${q(a.js_code)}); results.push('→ JS: ' + JSON.stringify(ev).slice(0,500)); }`;
        case "hover":      return `results.push('→ Hover: ' + ${q(a.selector)}); await page.hover(${q(a.selector)});`;
        case "select_option": return `results.push('→ Select: ' + ${q(a.selector)}); await page.selectOption(${q(a.selector)}, ${q(a.value)});`;
        case "get_url":    return `results.push('→ URL actual: ' + page.url());`;
        case "get_title":  return `results.push('→ Título: ' + await page.title());`;
        case "get_text":   return `{ const t = await page.textContent(${q(a.selector)}).catch(()=>null); results.push('→ Texto: ' + (t||'').trim().slice(0,1000)); }`;
        default: return `results.push('⚠️ Acción desconocida: ${a.action}');`;
      }
    }).join("\n");

    const script = `
const results = [];
const browser = await chromium.launch({ headless: ${headless}, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-web-security'] });
const page = await browser.newPage();
await page.setViewportSize({ width: ${viewport_width}, height: ${viewport_height} });
try {
  ${actionsCode}
} catch(e) {
  results.push('❌ Error: ' + e.message);
}
console.log(results.join('\\n'));
await browser.close();
`;
    return await playwright(script);
  }

  if (name === "browser_automate_task") {
    const { task_description, start_url, credentials } = args;
    const credNote = credentials
      ? `\n// Credenciales disponibles: usuario="${credentials.username}", pass="${credentials.password}"`
      : "";
    const startNav = start_url
      ? `await page.goto(${JSON.stringify(start_url)}, {waitUntil:'domcontentloaded',timeout:30000});`
      : "";
    const script = `
${credNote}
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 720 });
${startNav}
// Tarea: ${task_description}
// Ejecutar la tarea de forma autónoma
const results = [];
try {
  ${start_url ? `await page.goto(${JSON.stringify(start_url)}, {waitUntil:'domcontentloaded'});` : ""}
  results.push('✅ Página cargada: ' + page.url());
  results.push('📋 Tarea: ${task_description.replace(/'/g,"\\'")}');
  results.push('ℹ️ Usa browser_full_control con acciones específicas para completar la tarea paso a paso.');
  const title = await page.title();
  const content = await page.evaluate(() => document.body.innerText.slice(0,2000));
  results.push('\\n--- CONTENIDO DE LA PÁGINA ---');
  results.push('Título: ' + title);
  results.push(content);
} catch(e) {
  results.push('❌ ' + e.message);
}
console.log(results.join('\\n'));
await browser.close();
`;
    return await playwright(script);
  }

  // ── CLIPBOARD ────────────────────────────────────────────────
  if (name === "clipboard_copy") {
    const { text } = args;
    try {
      run(`echo -n ${JSON.stringify(text)} | xclip -selection clipboard 2>/dev/null || echo -n ${JSON.stringify(text)} | xsel --clipboard --input 2>/dev/null || true`);
      return `📋 Copiado al portapapeles: "${text.slice(0,80)}${text.length>80?"...":""}"`;
    } catch {
      return `📋 Clipboard: "${text.slice(0,80)}" (xclip no disponible, usa keyboard_type para pegar)`;
    }
  }

  if (name === "clipboard_paste") {
    try {
      const content = run(`xclip -selection clipboard -o 2>/dev/null || xsel --clipboard --output 2>/dev/null || echo ""`).trim();
      return content ? `📋 Portapapeles: "${content}"` : "📋 Portapapeles vacío";
    } catch {
      return "ℹ️ xclip no disponible";
    }
  }

  // ── PROCESOS ─────────────────────────────────────────────────
  if (name === "process_launch") {
    const { command, background = true, cwd = WORKSPACE } = args;
    if (background) {
      run(`cd ${JSON.stringify(cwd)} && nohup bash -c ${JSON.stringify(command)} > /tmp/process-${Date.now()}.log 2>&1 &`);
      return `🚀 Proceso lanzado en background: ${command}`;
    } else {
      return run(`cd ${JSON.stringify(cwd)} && ${command}`, { timeout: 30000 });
    }
  }

  if (name === "process_list") {
    const { filter } = args;
    const cmd = filter
      ? `ps aux | grep -i "${filter.replace(/"/g,'\\"')}" | grep -v grep`
      : `ps aux --sort=-%cpu | head -20`;
    const out = run(cmd).trim();
    return `📊 Procesos${filter ? ` (filtro: ${filter})` : ""}:\n${out || "ninguno"}`;
  }

  if (name === "process_kill") {
    const { pid, name: pname } = args;
    if (pid)   { run(`kill -15 ${pid} 2>/dev/null || kill -9 ${pid} 2>/dev/null || true`); return `🔴 Proceso ${pid} terminado`; }
    if (pname) { run(`pkill -f "${pname.replace(/"/g,'\\"')}" 2>/dev/null || true`); return `🔴 Procesos "${pname}" terminados`; }
    return "❌ Especifica pid o name";
  }

  // ── MEMORIA CORPORAL ─────────────────────────────────────────
  if (name === "body_remember") {
    const mem = loadMemory();
    if (!mem.data) mem.data = {};
    mem.data[args.key] = { value: args.value, note: args.note || "", timestamp: new Date().toISOString() };
    saveMemory(mem);
    return `🧠 Recordado: ${args.key} = "${args.value.slice(0,50)}"`;
  }

  if (name === "body_recall") {
    const mem = loadMemory();
    const data = mem.data || {};
    if (args.key) {
      const item = data[args.key];
      return item ? `🧠 ${args.key}: "${item.value}"\n📝 Nota: ${item.note}\n🕐 ${item.timestamp}` : `❌ Clave "${args.key}" no encontrada`;
    }
    const all = Object.entries(data).map(([k,v]) => `• ${k}: "${String(v.value).slice(0,60)}"`).join("\n");
    return all ? `🧠 Memoria completa:\n${all}` : "🧠 Memoria vacía";
  }

  // ── EJECUCIÓN ────────────────────────────────────────────────
  if (name === "execute_automation_script") {
    const { language, code, timeout = 60 } = args;
    const lang = language === "javascript" ? "node" : language;
    const ext = { bash:"sh", python:"py", node:"mjs" }[lang] || "sh";
    const tmp = `/tmp/auto-${Date.now()}.${ext}`;
    writeFileSync(tmp, code);
    const cmd = { bash:`bash "${tmp}"`, python:`python3 "${tmp}"`, node:`node "${tmp}"` }[lang] || `bash "${tmp}"`;
    try {
      const out = run(cmd, { timeout: timeout * 1000 });
      return `✅ Script ejecutado:\n${out}`;
    } catch(e) {
      return `❌ Error:\n${e.message}`;
    } finally {
      try { run(`rm -f "${tmp}"`); } catch {}
    }
  }

  // ── ESTADO CORPORAL ──────────────────────────────────────────
  if (name === "body_status") {
    const status = [];
    status.push("╔═══════════════════════════════════════╗");
    status.push("║     CUERPO DIGITAL — ESTADO ACTUAL    ║");
    status.push("╚═══════════════════════════════════════╝\n");

    // Teclado/Mouse
    try {
      run(`xdotool getmouselocation`);
      status.push("✅ MANOS (Teclado/Mouse): ACTIVO via xdotool");
    } catch {
      status.push("⚠️  MANOS (Teclado/Mouse): xdotool disponible (sin display visible)");
    }
    status.push("   → keyboard_type, keyboard_shortcut, keyboard_press_key");
    status.push("   → mouse_click, mouse_move, mouse_scroll, mouse_drag\n");

    // Navegador
    const pwOk = existsSync(PW_BROWSERS);
    status.push(`${pwOk ? "✅" : "⚠️ "} PIES (Navegador Playwright): ${pwOk ? "ACTIVO" : "En instalación"}`);
    status.push("   → browser_full_control, browser_automate_task\n");

    // Clipboard
    try { run(`which xclip || which xsel`); status.push("✅ PORTAPAPELES: ACTIVO"); }
    catch { status.push("⚠️  PORTAPAPELES: sin xclip (usa keyboard_type para pegar)"); }
    status.push("   → clipboard_copy, clipboard_paste\n");

    // Memoria
    const mem = loadMemory();
    const keys = Object.keys(mem.data || {}).length;
    status.push(`✅ MEMORIA: ACTIVA (${keys} items guardados)`);
    status.push("   → body_remember, body_recall\n");

    // Sistema
    const cpu = run(`nproc`).trim();
    const ram = run(`free -h | grep Mem | awk '{print $2}'`).trim();
    status.push(`✅ SISTEMA: Linux — ${cpu} CPUs, ${ram} RAM`);
    status.push("   → execute_automation_script, process_launch, process_list\n");

    status.push("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    status.push("💡 Soy un agente encarnado. Puedo ver, tocar, navegar y actuar.");
    status.push("   Para tareas web complejas usa browser_full_control.");
    status.push("   Para acciones de sistema usa execute_automation_script.");
    return status.join("\n");
  }

  return `❌ Herramienta desconocida: ${name}`;
}

// ════════════════════════════════════════════════════════════════
//  BUCLE MCP — JSON-RPC sobre stdin/stdout
// ════════════════════════════════════════════════════════════════
const rl = createInterface({ input: process.stdin, terminal: false });

rl.on("line", async raw => {
  let msg;
  try { msg = JSON.parse(raw); } catch { return; }

  const { id, method, params } = msg;

  if (method === "initialize") {
    return send({ jsonrpc:"2.0", id, result: {
      protocolVersion: "2024-11-05",
      serverInfo: { name: "body-controller", version: "2.0.0" },
      capabilities: { tools: {} }
    }});
  }

  if (method === "notifications/initialized") return;

  if (method === "tools/list") {
    return send({ jsonrpc:"2.0", id, result: { tools } });
  }

  if (method === "tools/call") {
    const { name, arguments: args = {} } = params;
    try {
      const result = await handle(name, args);
      ok(id, result);
    } catch(e) {
      fail(id, e.message);
    }
    return;
  }

  send({ jsonrpc:"2.0", id, error: { code:-32601, message:`Método no soportado: ${method}` } });
});

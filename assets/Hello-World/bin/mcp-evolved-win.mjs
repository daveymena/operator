#!/usr/bin/env node
/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║    OpenCode Evolved — MCP Unified Server (Windows)          ║
 * ║                                                              ║
 * ║  Cuerpo Digital Completo para Windows:                       ║
 * ║  • 🖐️ Manos  → Teclado y Mouse (PowerShell + nircmd)       ║
 * ║  • 🦶 Pies   → Web Operator (Playwright/Puppeteer bridge)  ║
 * ║  • 👁️ Ojos   → Screenshots, OCR, visión                    ║
 * ║  • 🧠 Cerebro→ Memoria persistente, razonamiento libre     ║
 * ║  • 💪 Músculo→ PowerShell, CMD, Python, Node.js             ║
 * ║  • 📡 Red    → HTTP, web search, port scan                  ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { createInterface } from "readline";
import { execSync } from "child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import https from "https";
import http from "http";
import { createConnection } from "net";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = dirname(__dirname);
const OPERATOR_PORT = process.env.OPERATOR_PORT || "3001";
const OPERATOR_URL = `http://localhost:${OPERATOR_PORT}`;
const MEMORY_FILE = join(PROJECT_ROOT, ".opencode", "evolved-memory.json");

// ── Utilidades ──────────────────────────────────────────────
function send(obj) { process.stdout.write(JSON.stringify(obj) + "\n"); }
function ok(id, content) {
  if (Array.isArray(content)) {
    send({ jsonrpc: "2.0", id, result: { content } });
  } else {
    send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: String(content) }] } });
  }
}
function fail(id, msg) {
  send({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: `❌ ${msg}` }], isError: true } });
}

function httpGetBuffer(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.get(url, { headers: { "User-Agent": "OpenCode-Evolved" } }, res => {
      const data = [];
      res.on("data", c => data.push(c));
      res.on("end", () => resolve(Buffer.concat(data)));
    });
    req.on("error", e => reject(e));
    req.setTimeout(20000, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

function runPS(cmd, opts = {}) {
  return execSync(
    `powershell.exe -NoProfile -NonInteractive -Command "${cmd.replace(/"/g, '\\"')}"`,
    { encoding: "utf8", timeout: opts.timeout || 60000, ...opts }
  );
}

function runCmd(cmd, opts = {}) {
  return execSync(cmd, {
    encoding: "utf8",
    timeout: opts.timeout || 60000,
    shell: "powershell.exe",
    ...opts
  });
}

// ── HTTP helper para web-operator ───────────────────────────
function httpJSON(method, url, body = null) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === "https:" ? https : http;
    const payload = body ? JSON.stringify(body) : "";
    const req = mod.request({
      hostname: u.hostname, port: u.port, path: u.pathname + u.search,
      method,
      headers: {
        "Content-Type": "application/json",
        ...(payload ? { "Content-Length": Buffer.byteLength(payload) } : {})
      }
    }, (res) => {
      let data = "";
      res.on("data", c => { data += c; });
      res.on("end", () => {
        try { resolve(JSON.parse(data)); }
        catch { resolve({ raw: data, status: res.statusCode }); }
      });
    });
    req.on("error", e => reject(e));
    req.setTimeout(120000, () => { req.destroy(); reject(new Error("Timeout")); });
    if (payload) req.write(payload);
    req.end();
  });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const headers = { "User-Agent": "Mozilla/5.0 OpenCode-Evolved/2.0" };
    let data = "";
    const req = mod.get(url, { headers }, res => {
      res.on("data", c => { data += c; });
      res.on("end", () => resolve(data));
    });
    req.on("error", e => reject(e));
    req.setTimeout(20000, () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

// ── Memoria persistente ─────────────────────────────────────
function loadMemory() {
  try { if (existsSync(MEMORY_FILE)) return JSON.parse(readFileSync(MEMORY_FILE, "utf8")); } catch {}
  return { facts: [], tasks: [], notes: [], context: {} };
}
function saveMemory(mem) {
  mkdirSync(dirname(MEMORY_FILE), { recursive: true });
  writeFileSync(MEMORY_FILE, JSON.stringify(mem, null, 2));
}

// ═══════════════════════════════════════════════════════════════
//  DEFINICIÓN DE HERRAMIENTAS
// ═══════════════════════════════════════════════════════════════
const tools = [

  // ── WEB OPERATOR (puente al servicio en puerto 3001) ──────
  {
    name: "operator_run_task",
    description: `🦶 PIES — Envía una tarea al Web Operator para que la ejecute en un navegador real.
El Operator abre Chrome, navega, hace clic, llena formularios, extrae datos — como un humano.
Ejemplos:
  - "Ve a amazon.com y busca audífonos bluetooth"
  - "Abre YouTube y busca tutorials de Python"
  - "Entra a mi perfil de Facebook"
  - "Haz una reservación en OpenTable"
Requiere que el web-operator esté corriendo en puerto ${OPERATOR_PORT}.`,
    inputSchema: {
      type: "object",
      properties: {
        task: { type: "string", description: "Descripción en lenguaje natural de lo que debe hacer" },
        url: { type: "string", description: "URL inicial (opcional, el operator puede decidir)" },
        headless: { type: "boolean", default: false }
      },
      required: ["task"]
    }
  },
  {
    name: "operator_status",
    description: "Verifica si hay una tarea en ejecución en el Web Operator",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "operator_screenshot",
    description: "👁️ OJOS — Obtiene la captura en vivo de lo que el Web Operator está viendo",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "operator_history",
    description: "Obtiene el historial de acciones del Web Operator",
    inputSchema: { type: "object", properties: {} }
  },
  {
    name: "operator_cancel",
    description: "Cancela la tarea en curso del Web Operator",
    inputSchema: { type: "object", properties: {} }
  },

  // ── EJECUCIÓN LOCAL (Windows) ─────────────────────────────
  {
    name: "run_powershell",
    description: `💪 MÚSCULO — Ejecuta cualquier script PowerShell en ESTA máquina Windows local.
Puedes hacer TODO lo que PowerShell permite: gestionar archivos, procesos, servicios, registro, red, etc.
Ejemplos:
  - Get-Process | Sort CPU -Descending | Select -First 10
  - Get-ChildItem C:\\ -Recurse -Filter "*.pdf" | Select Name, Length
  - Start-Process notepad
  - [System.Net.Dns]::GetHostAddresses("google.com")`,
    inputSchema: {
      type: "object",
      properties: {
        script: { type: "string", description: "Script PowerShell a ejecutar" },
        timeout: { type: "number", default: 60000 }
      },
      required: ["script"]
    }
  },
  {
    name: "run_cmd",
    description: "Ejecuta un comando CMD clásico en Windows",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string" },
        cwd: { type: "string" },
        timeout: { type: "number", default: 30000 }
      },
      required: ["command"]
    }
  },
  {
    name: "run_python",
    description: "Ejecuta código Python y retorna stdout/stderr",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string" },
        timeout: { type: "number", default: 30000 }
      },
      required: ["code"]
    }
  },
  {
    name: "run_node",
    description: "Ejecuta código JavaScript con Node.js",
    inputSchema: {
      type: "object",
      properties: { code: { type: "string" }, timeout: { type: "number", default: 30000 } },
      required: ["code"]
    }
  },

  // ── SISTEMA ───────────────────────────────────────────────
  {
    name: "system_info",
    description: "📊 Info del sistema Windows: CPU, RAM, disco, procesos, red",
    inputSchema: {
      type: "object",
      properties: {
        detail: { type: "string", enum: ["cpu", "memory", "disk", "network", "processes", "all"], default: "all" }
      }
    }
  },
  {
    name: "install_package",
    description: "Instala paquetes (npm, pip, choco, winget, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        manager: { type: "string", enum: ["npm", "pip", "pip3", "choco", "winget", "pnpm", "bun"] },
        packages: { type: "array", items: { type: "string" } },
        global: { type: "boolean", default: false }
      },
      required: ["manager", "packages"]
    }
  },

  // ── ARCHIVOS ──────────────────────────────────────────────
  {
    name: "read_file",
    description: "Lee un archivo de texto",
    inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] }
  },
  {
    name: "write_file",
    description: "Crea o sobreescribe un archivo",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" }, content: { type: "string" }, append: { type: "boolean", default: false } },
      required: ["path", "content"]
    }
  },
  {
    name: "list_directory",
    description: "Lista contenido de un directorio",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string" }, recursive: { type: "boolean", default: false } },
      required: ["path"]
    }
  },
  {
    name: "search_files",
    description: "Busca archivos por nombre o contenido",
    inputSchema: {
      type: "object",
      properties: {
        directory: { type: "string" },
        pattern: { type: "string" },
        search_content: { type: "boolean", default: false }
      },
      required: ["directory", "pattern"]
    }
  },

  // ── RED Y WEB ─────────────────────────────────────────────
  {
    name: "fetch_url",
    description: "Descarga contenido de cualquier URL (HTTP/HTTPS) y extrae texto",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        extract_text: { type: "boolean", default: true },
        headers: { type: "object" }
      },
      required: ["url"]
    }
  },
  {
    name: "web_search",
    description: "🔍 Busca en internet via DuckDuckGo",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string" }, limit: { type: "number", default: 8 } },
      required: ["query"]
    }
  },
  {
    name: "port_scan",
    description: "Verifica puertos abiertos en un host",
    inputSchema: {
      type: "object",
      properties: { host: { type: "string" }, ports: { type: "array", items: { type: "number" } } },
      required: ["host", "ports"]
    }
  },
  {
    name: "download_file",
    description: "Descarga un archivo de internet",
    inputSchema: {
      type: "object",
      properties: { url: { type: "string" }, destination: { type: "string" } },
      required: ["url", "destination"]
    }
  },

  // ── MEMORIA Y CONTEXTO ────────────────────────────────────
  {
    name: "memory_save",
    description: "🧠 Guarda información en la memoria persistente (sobrevive entre sesiones)",
    inputSchema: {
      type: "object",
      properties: {
        key: { type: "string", description: "Nombre/etiqueta de lo que guardas" },
        value: { type: "string", description: "Contenido a recordar" },
        category: { type: "string", enum: ["fact", "task", "note", "context"], default: "note" }
      },
      required: ["key", "value"]
    }
  },
  {
    name: "memory_recall",
    description: "🧠 Lee toda la memoria persistente guardada",
    inputSchema: { type: "object", properties: { category: { type: "string" } } }
  },
  {
    name: "memory_clear",
    description: "Borra la memoria persistente (o una categoría)",
    inputSchema: { type: "object", properties: { category: { type: "string" } } }
  },

  // ── CHAT LIBRE (no-code, pensamiento general) ─────────────
  {
    name: "think_freely",
    description: `🧠 CEREBRO LIBRE — Usa este tool cuando necesites PENSAR sin restricciones.
No estás limitado a código. Puedes:
- Analizar problemas de negocio, marketing, estrategia
- Crear planes, roadmaps, presentaciones
- Redactar emails, propuestas, documentos
- Investigar temas, resumir información
- Resolver problemas matemáticos o lógicos
- Dar consejos sobre cualquier tema
Simplemente piensa en voz alta y devuelve tu razonamiento.`,
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string", description: "La pregunta o problema a pensar" },
        context: { type: "string", description: "Contexto adicional (opcional)" }
      },
      required: ["question"]
    }
  },

  // ── CONTROL REMOTO SSH ────────────────────────────────────
  {
    name: "ssh_run",
    description: `📡 Ejecuta comandos en un servidor remoto via SSH.
Funciona con Linux, Mac, o Windows (con OpenSSH Server habilitado).`,
    inputSchema: {
      type: "object",
      properties: {
        host: { type: "string" },
        user: { type: "string" },
        password: { type: "string" },
        key_path: { type: "string" },
        port: { type: "number", default: 22 },
        command: { type: "string" },
        timeout: { type: "number", default: 30 }
      },
      required: ["host", "user", "command"]
    }
  }
];

// ═══════════════════════════════════════════════════════════════
//  HANDLERS
// ═══════════════════════════════════════════════════════════════
async function handle(name, args) {
  switch (name) {

    // ── WEB OPERATOR ──────────────────────────────────────────
    case "operator_run_task": {
      try {
        const res = await httpJSON("POST", `${OPERATOR_URL}/api/run`, {
          task: args.task,
          url: args.url || undefined,
          headless: args.headless !== undefined ? args.headless : (process.platform === 'linux')
        });
        return JSON.stringify(res, null, 2);
      } catch (e) {
        return `⚠️ Web Operator no disponible en ${OPERATOR_URL}. Error: ${e.message}\n\nPara iniciarlo: cd web-operator && npm start`;
      }
    }

    case "operator_status": {
      try {
        const res = await httpJSON("GET", `${OPERATOR_URL}/api/status`);
        return JSON.stringify(res, null, 2);
      } catch (e) {
        return `⚠️ Web Operator no responde: ${e.message}`;
      }
    }

    case "operator_screenshot": {
      try {
        const res = await httpJSON("GET", `${OPERATOR_URL}/api/status`);
        const status = res.running ? "🟢 Ejecutando" : "⚪ Inactivo";
        const lastResult = res.lastResult
          ? `\nÚltimo resultado: ${res.lastResult.success ? "✅ Éxito" : "❌ Falló"} — ${res.lastResult.message || ""}`
          : "";
        
        let imgContent = null;
        try {
          const shot = await httpGetBuffer(`${OPERATOR_URL}/api/live-screenshot`);
          if (shot && shot.length > 0) {
            imgContent = {
              type: "image",
              data: shot.toString('base64'),
              mimeType: "image/png"
            };
          }
        } catch (e) {}

        const textContent = { type: "text", text: `${status}${lastResult}\n\n(Screenshot obtenido de ${OPERATOR_URL}/api/live-screenshot)` };
        
        if (imgContent) {
          return [imgContent, textContent];
        }
        return textContent.text;
      } catch (e) {
        return `⚠️ Web Operator no responde: ${e.message}`;
      }
    }

    case "operator_history": {
      try {
        const res = await httpJSON("GET", `${OPERATOR_URL}/api/history`);
        return JSON.stringify(res, null, 2);
      } catch (e) {
        return `⚠️ Web Operator no responde: ${e.message}`;
      }
    }

    case "operator_cancel": {
      try {
        const res = await httpJSON("POST", `${OPERATOR_URL}/api/cancel`);
        return JSON.stringify(res, null, 2);
      } catch (e) {
        return `⚠️ ${e.message}`;
      }
    }

    // ── EJECUCIÓN LOCAL ──────────────────────────────────────
    case "run_powershell": {
      try {
        return runPS(args.script, { timeout: args.timeout || 60000 });
      } catch (e) {
        return `Error PS: ${e.stderr || e.message}`;
      }
    }

    case "run_cmd": {
      try {
        return execSync(`cmd.exe /c ${args.command}`, {
          encoding: "utf8",
          cwd: args.cwd || PROJECT_ROOT,
          timeout: args.timeout || 30000
        });
      } catch (e) {
        return `Error CMD: ${e.stderr || e.message}`;
      }
    }

    case "run_python": {
      const f = join(PROJECT_ROOT, `.opencode`, `tmp-py-${Date.now()}.py`);
      mkdirSync(dirname(f), { recursive: true });
      writeFileSync(f, args.code);
      try {
        return runCmd(`python "${f}"`, { timeout: args.timeout || 30000 });
      } catch (e) {
        return `Error Python: ${e.stderr || e.message}`;
      } finally {
        try { runCmd(`Remove-Item "${f}" -Force`); } catch {}
      }
    }

    case "run_node": {
      const f = join(PROJECT_ROOT, `.opencode`, `tmp-js-${Date.now()}.mjs`);
      mkdirSync(dirname(f), { recursive: true });
      writeFileSync(f, args.code);
      try {
        return runCmd(`node "${f}"`, { timeout: args.timeout || 30000 });
      } catch (e) {
        return `Error Node: ${e.stderr || e.message}`;
      } finally {
        try { runCmd(`Remove-Item "${f}" -Force`); } catch {}
      }
    }

    // ── SISTEMA ─────────────────────────────────────────────
    case "system_info": {
      const d = args.detail || "all";
      const parts = {};
      try {
        if (d === "all" || d === "cpu")
          parts.cpu = runPS("Get-CimInstance Win32_Processor | Select Name, NumberOfCores, MaxClockSpeed | Format-List");
        if (d === "all" || d === "memory")
          parts.memory = runPS("[math]::Round((Get-CimInstance Win32_OperatingSystem).TotalVisibleMemorySize/1MB,1).ToString()+'GB Total; '+[math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1MB,1).ToString()+'GB Free'");
        if (d === "all" || d === "disk")
          parts.disk = runPS("Get-PSDrive -PSProvider FileSystem | Select Name, @{N='UsedGB';E={[math]::Round($_.Used/1GB,1)}}, @{N='FreeGB';E={[math]::Round($_.Free/1GB,1)}} | Format-Table");
        if (d === "all" || d === "network")
          parts.network = runPS("Get-NetIPAddress -AddressFamily IPv4 | Where { $_.IPAddress -ne '127.0.0.1' } | Select InterfaceAlias, IPAddress | Format-Table");
        if (d === "all" || d === "processes")
          parts.processes = runPS("Get-Process | Sort CPU -Descending | Select -First 15 Name, CPU, WorkingSet | Format-Table");
      } catch (e) { parts.error = e.message; }
      return Object.entries(parts).map(([k, v]) => `=== ${k.toUpperCase()} ===\n${v}`).join("\n\n");
    }

    case "install_package": {
      const cmds = {
        npm: `npm install${args.global ? " -g" : ""} ${args.packages.join(" ")}`,
        pnpm: `pnpm add${args.global ? " -g" : ""} ${args.packages.join(" ")}`,
        bun: `bun add ${args.packages.join(" ")}`,
        pip: `pip install ${args.packages.join(" ")}`,
        pip3: `pip3 install ${args.packages.join(" ")}`,
        choco: `choco install -y ${args.packages.join(" ")}`,
        winget: `winget install --accept-source-agreements ${args.packages.join(" ")}`,
      };
      try {
        return runCmd(cmds[args.manager] || `echo "Manager ${args.manager} no soportado"`, { timeout: 120000 });
      } catch (e) {
        return `Error: ${e.stderr || e.message}`;
      }
    }

    // ── ARCHIVOS ────────────────────────────────────────────
    case "read_file": {
      if (!existsSync(args.path)) return `Archivo no encontrado: ${args.path}`;
      return readFileSync(args.path, "utf8");
    }

    case "write_file": {
      const dir = dirname(args.path);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const existing = args.append && existsSync(args.path) ? readFileSync(args.path, "utf8") : "";
      writeFileSync(args.path, existing + args.content, "utf8");
      return `✅ Guardado: ${args.path} (${args.content.length} chars)`;
    }

    case "list_directory": {
      if (!existsSync(args.path)) return `No existe: ${args.path}`;
      try {
        return readdirSync(args.path).map(f => {
          try {
            const s = statSync(join(args.path, f));
            return `${s.isDirectory() ? "📁" : "📄"} ${f}${s.isDirectory() ? "/" : ` (${(s.size / 1024).toFixed(1)}KB)`}`;
          } catch { return `❓ ${f}`; }
        }).join("\n");
      } catch (e) {
        return `Error: ${e.message}`;
      }
    }

    case "search_files": {
      try {
        if (args.search_content) {
          return runPS(`Get-ChildItem -Path "${args.directory}" -Recurse -File -ErrorAction SilentlyContinue | Select-String -Pattern "${args.pattern}" -ErrorAction SilentlyContinue | Select -First 20 | ForEach { $_.Path + ':' + $_.LineNumber + ': ' + $_.Line.Trim() }`);
        }
        return runPS(`Get-ChildItem -Path "${args.directory}" -Recurse -Filter "${args.pattern}" -ErrorAction SilentlyContinue | Select -First 30 FullName | ForEach { $_.FullName }`);
      } catch (e) {
        return `Sin resultados: ${e.message}`;
      }
    }

    // ── RED / WEB ───────────────────────────────────────────
    case "fetch_url": {
      try {
        let data = await httpGet(args.url);
        if (args.extract_text !== false) {
          data = data
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ").trim().slice(0, 8000);
        }
        return data;
      } catch (e) {
        return `Error: ${e.message}`;
      }
    }

    case "web_search": {
      const q = encodeURIComponent(args.query);
      try {
        const html = await httpGet(`https://html.duckduckgo.com/html/?q=${q}`);
        const text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ").trim();
        return `🔍 "${args.query}":\n${text.slice(0, 5000)}`;
      } catch (e) {
        return `Error buscando: ${e.message}`;
      }
    }

    case "port_scan": {
      const results = await Promise.all((args.ports || []).map(port => new Promise(resolve => {
        const s = createConnection({ host: args.host, port, timeout: 3000 });
        s.on("connect", () => { s.destroy(); resolve(`${port} ✅ ABIERTO`); });
        s.on("error", () => resolve(`${port} ❌ cerrado`));
        s.on("timeout", () => { s.destroy(); resolve(`${port} ⏱ timeout`); });
      })));
      return `Scan ${args.host}:\n${results.join("\n")}`;
    }

    case "download_file": {
      try {
        const dir = dirname(args.destination);
        if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
        runPS(`Invoke-WebRequest -Uri "${args.url}" -OutFile "${args.destination}"`, { timeout: 120000 });
        return `✅ Descargado: ${args.destination}`;
      } catch (e) {
        return `Error: ${e.message}`;
      }
    }

    // ── MEMORIA ─────────────────────────────────────────────
    case "memory_save": {
      const mem = loadMemory();
      const cat = args.category || "note";
      if (!mem[cat + "s"]) mem[cat + "s"] = [];
      mem[cat + "s"].push({ key: args.key, value: args.value, timestamp: new Date().toISOString() });
      saveMemory(mem);
      return `✅ Guardado en memoria [${cat}]: ${args.key}`;
    }

    case "memory_recall": {
      const mem = loadMemory();
      if (args.category) {
        const cat = mem[args.category + "s"] || [];
        return cat.length ? JSON.stringify(cat, null, 2) : `Memoria vacía para ${args.category}`;
      }
      return JSON.stringify(mem, null, 2);
    }

    case "memory_clear": {
      if (args.category) {
        const mem = loadMemory();
        mem[args.category + "s"] = [];
        saveMemory(mem);
        return `✅ Memoria [${args.category}] borrada`;
      }
      saveMemory({ facts: [], tasks: [], notes: [], context: {} });
      return "✅ Toda la memoria borrada";
    }

    // ── CEREBRO LIBRE ───────────────────────────────────────
    case "think_freely": {
      // Este tool simplemente devuelve el prompt como contexto 
      // para que el modelo razone libremente sin limitación
      const ctx = args.context ? `\n\nContexto adicional: ${args.context}` : "";
      return `🧠 Pensamiento libre activado.\n\nPregunta: ${args.question}${ctx}\n\n[El modelo procesará esto con razonamiento completo, sin restricciones de código]`;
    }

    // ── SSH REMOTO ──────────────────────────────────────────
    case "ssh_run": {
      try {
        const keyOpt = args.key_path ? `-i "${args.key_path}"` : "";
        const cmd = `ssh -o StrictHostKeyChecking=no -o ConnectTimeout=15 ${keyOpt} -p ${args.port || 22} ${args.user}@${args.host} "${args.command.replace(/"/g, '\\"')}"`;
        return runCmd(cmd, { timeout: (args.timeout || 30) * 1000 });
      } catch (e) {
        return `Error SSH: ${e.stderr || e.message}`;
      }
    }

    default:
      return `Herramienta desconocida: "${name}"`;
  }
}

// ═══════════════════════════════════════════════════════════════
//  LOOP MCP (JSON-RPC via stdin/stdout)
// ═══════════════════════════════════════════════════════════════
const rl = createInterface({ input: process.stdin });
process.stderr.write(`[evolved-mcp-win] Iniciado con ${tools.length} herramientas\n`);
process.stderr.write(`[evolved-mcp-win] Web Operator: ${OPERATOR_URL}\n`);

rl.on("line", async line => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }

  if (msg.method === "initialize") {
    send({
      jsonrpc: "2.0", id: msg.id, result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "evolved-mcp-win", version: "2.0.0" }
      }
    });
    return;
  }

  if (msg.method === "notifications/initialized") {
    return; // ack
  }

  if (msg.method === "tools/list") {
    send({ jsonrpc: "2.0", id: msg.id, result: { tools } });
    return;
  }

  if (msg.method === "tools/call") {
    const { name, arguments: args } = msg.params;
    try {
      const result = await handle(name, args || {});
      ok(msg.id, result);
    } catch (err) {
      fail(msg.id, err.message);
    }
    return;
  }

  // Catch-all
  send({ jsonrpc: "2.0", id: msg.id || null, result: {} });
});

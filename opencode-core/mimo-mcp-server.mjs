import http from 'http';
import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import envKnowledge from './environment-knowledge.mjs';

const MCP_PORT = parseInt(process.env.MIMO_MCP_PORT || '21296');
const WORKSPACE = process.env.OPENCODE_WORKSPACE || '/workspace';
const BRIDGE_PORT = process.env.BRIDGE_PORT || '21295';
const WEB_PORT = process.env.PORT || '3000';

const BRIDGE_URL = `ws://localhost:${BRIDGE_PORT}/mimo`;
const BRIDGE_HTTP = `http://localhost:${BRIDGE_PORT}`;

const tools = [
  { name: 'read_file', description: 'Lee el contenido de un archivo en el workspace', inputSchema: { type: 'object', properties: { file_path: { type: 'string', description: 'Ruta absoluta del archivo' }, offset: { type: 'number' }, limit: { type: 'number' } }, required: ['file_path'] } },
  { name: 'write_file', description: 'Escribe o sobrescribe un archivo', inputSchema: { type: 'object', properties: { file_path: { type: 'string' }, content: { type: 'string' } }, required: ['file_path', 'content'] } },
  { name: 'bash', description: 'Ejecuta un comando de terminal en el contenedor', inputSchema: { type: 'object', properties: { command: { type: 'string' }, workdir: { type: 'string' }, timeout: { type: 'number' } }, required: ['command'] } },
  { name: 'grep', description: 'Busca patrones regex en archivos', inputSchema: { type: 'object', properties: { pattern: { type: 'string' }, path: { type: 'string' }, include: { type: 'string' } }, required: ['pattern'] } },
  { name: 'glob', description: 'Busca archivos por patrón glob', inputSchema: { type: 'object', properties: { pattern: { type: 'string' }, path: { type: 'string' } }, required: ['pattern'] } },
  { name: 'webfetch', description: 'Obtiene contenido de una URL', inputSchema: { type: 'object', properties: { url: { type: 'string' }, format: { type: 'string', enum: ['text', 'markdown', 'html'] } }, required: ['url'] } },
  {
    name: 'screenshot',
    description: 'Toma un screenshot de la PC remota. quality: 1-100 (default 60), scale: 0.1-1.0 (default 0.75)',
    inputSchema: { type: 'object', properties: { quality: { type: 'number' }, scale: { type: 'number' } }, required: [] }
  },
  {
    name: 'screenshot_stable',
    description: 'Espera y toma screenshot estabilizado (útil después de acciones)',
    inputSchema: { type: 'object', properties: { waitMs: { type: 'number' }, quality: { type: 'number' } }, required: [] }
  },
  {
    name: 'pc_command',
    description: 'Envía un comando a la PC Windows remota para control total',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['powershell', 'cmd', 'open_url', 'open_file', 'read_file', 'write_file', 'list_dir', 'mouse_click', 'mouse_double_click', 'mouse_move', 'mouse_scroll', 'drag_and_drop', 'keyboard_type', 'keyboard_press', 'keyboard_shortcut', 'sysinfo', 'list_windows', 'list_apps', 'browser_tabs', 'get_clipboard', 'set_clipboard', 'get_cursor', 'focus_window', 'download_file', 'wait', 'notify', 'screenshot'], description: 'Tipo de comando a ejecutar en la PC' },
        script: { type: 'string' }, command: { type: 'string' }, url: { type: 'string' }, path: { type: 'string' }, content: { type: 'string' }, text: { type: 'string' }, key: { type: 'string' }, modifiers: { type: 'array', items: { type: 'string' } }, x: { type: 'number' }, y: { type: 'number' }, x1: { type: 'number' }, y1: { type: 'number' }, x2: { type: 'number' }, y2: { type: 'number' }, button: { type: 'string' }, clicks: { type: 'number' }, ms: { type: 'number' }, pid: { type: 'number' }, message: { type: 'string' }, title: { type: 'string' }, quality: { type: 'number' }, scale: { type: 'number' }, force: { type: 'boolean' }, timeout: { type: 'number' }
      },
      required: ['type']
    }
  },
  {
    name: 'env_status',
    description: 'Obtiene el estado completo del entorno de la PC: ventanas, apps, navegadores',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'env_knowledge',
    description: 'Obtiene la base de conocimiento del agente: atajos, selectores DOM, patrones de UI, tips de rendimiento',
    inputSchema: { type: 'object', properties: { category: { type: 'string', enum: ['all', 'keyboard', 'dom', 'performance', 'patterns', 'capabilities'] } }, required: ['category'] }
  },
  {
    name: 'batch_pc',
    description: 'Ejecuta múltiples comandos en la PC en secuencia rápida',
    inputSchema: { type: 'object', properties: { commands: { type: 'array', items: { type: 'object' } } }, required: ['commands'] }
  },
  {
    name: 'web_navigate',
    description: 'Abre una URL en el navegador y espera a que cargue',
    inputSchema: { type: 'object', properties: { url: { type: 'string' }, waitMs: { type: 'number' } }, required: ['url'] }
  },
  {
    name: 'web_action',
    description: 'Realiza una acción combinada: mueve mouse, hace clic y espera',
    inputSchema: { type: 'object', properties: { x: { type: 'number' }, y: { type: 'number' }, click: { type: 'boolean' }, type: { type: 'string' }, waitMs: { type: 'number' } }, required: ['x', 'y'] }
  },
  {
    name: 'type_text',
    description: 'Escribe texto y presiona Enter (combinación rápida para formularios)',
    inputSchema: { type: 'object', properties: { text: { type: 'string' }, pressEnter: { type: 'boolean' } }, required: ['text'] }
  },
  {
    name: 'media_list',
    description: 'Lista todas las imágenes y archivos en el servidor de medios',
    inputSchema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'media_upload_url',
    description: 'Descarga una imagen de internet al servidor de medios local',
    inputSchema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] }
  },
  {
    name: 'media_screenshot',
    description: 'Toma screenshot de la PC y lo guarda en el servidor de medios',
    inputSchema: { type: 'object', properties: { quality: { type: 'number' } }, required: [] }
  },
  {
    name: 'vision_analyze',
    description: 'Analiza el screenshot actual con el modelo de visión disponible. pregunta: qué quieres saber de la pantalla',
    inputSchema: { type: 'object', properties: { question: { type: 'string' }, quality: { type: 'number' } }, required: ['question'] }
  }
];

function safePath(p) {
  if (!p) return WORKSPACE;
  const abs = path.resolve(p);
  const allowed = [WORKSPACE, '/tmp', '/app'];
  if (allowed.some(a => abs.startsWith(a)) || abs.startsWith('/tmp')) return abs;
  return path.join(WORKSPACE, p);
}

async function bridgeFetch(pathname, body, timeoutMs = 30000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BRIDGE_HTTP}${pathname}`, {
      method: body ? 'POST' : 'GET',
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal
    });
    clearTimeout(timer);
    return await res.json();
  } catch (e) {
    clearTimeout(timer);
    return { error: `Bridge no disponible: ${e.message}` };
  }
}

async function executeTool(name, args) {
  switch (name) {
    case 'read_file': {
      const fp = safePath(args.file_path);
      if (!fs.existsSync(fp)) return { error: `Archivo no encontrado: ${fp}` };
      const content = fs.readFileSync(fp, 'utf8');
      const lines = content.split('\n');
      const offset = args.offset || 1;
      const limit = args.limit || lines.length;
      const slice = lines.slice(offset - 1, offset - 1 + limit);
      return { content: slice.map((l, i) => `${offset + i}: ${l}`).join('\n'), totalLines: lines.length };
    }
    case 'write_file': {
      const fp = safePath(args.file_path);
      fs.mkdirSync(path.dirname(fp), { recursive: true });
      fs.writeFileSync(fp, args.content, 'utf8');
      return { ok: true, file_path: fp, size: Buffer.byteLength(args.content) };
    }
    case 'bash': {
      const workdir = args.workdir || WORKSPACE;
      const timeout = args.timeout || 120000;
      return new Promise((resolve) => {
        const proc = spawn('bash', ['-c', args.command], { cwd: workdir, timeout, env: { ...process.env, HOME: '/root' } });
        let stdout = '', stderr = '';
        proc.stdout.on('data', d => stdout += d.toString());
        proc.stderr.on('data', d => stderr += d.toString());
        proc.on('close', code => resolve({ exitCode: code, stdout: stdout.slice(-50000), stderr: stderr.slice(-10000) }));
        proc.on('error', err => resolve({ error: err.message }));
      });
    }
    case 'grep': {
      const dir = args.path ? safePath(args.path) : WORKSPACE;
      const include = args.include ? `--include="${args.include}"` : '';
      try {
        const result = execSync(`grep -rn --include="*" ${include} "${args.pattern.replace(/"/g, '\\"')}" "${dir}" 2>/dev/null || true`, { encoding: 'utf8', timeout: 30000, maxBuffer: 10 * 1024 * 1024 });
        return { matches: result.trim().split('\n').filter(Boolean).slice(0, 200) };
      } catch (e) { return { matches: [], error: e.message }; }
    }
    case 'glob': {
      const dir = args.path ? safePath(args.path) : WORKSPACE;
      try {
        const result = execSync(`find "${dir}" -path "${args.pattern}" -type f 2>/dev/null | head -500`, { encoding: 'utf8', timeout: 15000 });
        return { files: result.trim().split('\n').filter(Boolean) };
      } catch (e) { return { files: [], error: e.message }; }
    }
    case 'webfetch': {
      const format = args.format || 'markdown';
      try {
        const html = execSync(`curl -sL --max-time 30 -A "MiMoCode-MCP/1.0" "${args.url.replace(/"/g, '\\"')}"`, { encoding: 'utf8', timeout: 35000, maxBuffer: 5 * 1024 * 1024 });
        if (format === 'html') return { content: html, format: 'html' };
        const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 50000);
        return { content: text, format };
      } catch (e) { return { error: e.message }; }
    }

    case 'screenshot':
    case 'screenshot_stable': {
      const isStable = name === 'screenshot_stable';
      const pathname = isStable ? `/screenshot/stable?wait=${args.waitMs || 500}` : `/screenshot?quality=${args.quality || 60}&scale=${args.scale || 0.75}`;
      return await bridgeFetch(pathname);
    }

    case 'pc_command': {
      return await bridgeFetch('/cmd', { type: args.type, ...args }, args.timeout || 30000);
    }

    case 'env_status': {
      return await bridgeFetch('/env');
    }

    case 'env_knowledge': {
      const cat = args.category || 'all';
      if (cat === 'all') return envKnowledge;
      const map = { keyboard: 'windowsKeyboard', dom: 'webDomKnowledge', performance: 'performance', patterns: 'commonTaskPatterns', capabilities: 'pcAgentCapabilities' };
      const key = map[cat] || 'pcAgentCapabilities';
      return envKnowledge[key] || { error: 'Categoría no encontrada' };
    }

    case 'batch_pc': {
      const results = [];
      for (const cmd of (args.commands || [])) {
        try {
          const r = await bridgeFetch('/cmd', cmd, cmd.timeout || 15000);
          results.push(r);
        } catch (e) {
          results.push({ ok: false, error: e.message });
        }
      }
      return { ok: true, results };
    }

    case 'web_navigate': {
      await bridgeFetch('/cmd', { type: 'open_url', url: args.url });
      const waitMs = args.waitMs || 2000;
      await new Promise(r => setTimeout(r, waitMs));
      const screenshot = await bridgeFetch(`/screenshot/stable?wait=500&quality=60`);
      return { ok: true, url: args.url, screenshot };
    }

    case 'web_action': {
      if (args.x && args.y) {
        await bridgeFetch('/cmd', { type: 'mouse_move', x: args.x, y: args.y }, 10000);
        await new Promise(r => setTimeout(r, 100));
      }
      if (args.click) {
        await bridgeFetch('/cmd', { type: 'mouse_click', button: args.button || 'left' }, 10000);
      }
      if (args.type) {
        await bridgeFetch('/cmd', { type: 'keyboard_type', text: args.type }, 10000);
      }
      const waitMs = args.waitMs || 500;
      await new Promise(r => setTimeout(r, waitMs));
      return { ok: true };
    }

    case 'type_text': {
      await bridgeFetch('/cmd', { type: 'keyboard_type', text: args.text }, 10000);
      if (args.pressEnter !== false) {
        await new Promise(r => setTimeout(r, 200));
        await bridgeFetch('/cmd', { type: 'keyboard_press', key: 'ENTER' }, 10000);
      }
      return { ok: true };
    }

    case 'media_list': {
      try {
        const res = await fetch(`http://localhost:${WEB_PORT}/api/media/list`);
        return await res.json();
      } catch (e) { return { error: `Media server: ${e.message}` }; }
    }
    case 'media_upload_url': {
      try {
        const res = await fetch(`http://localhost:${WEB_PORT}/api/media/upload-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: args.url })
        });
        return await res.json();
      } catch (e) { return { error: `Media upload: ${e.message}` }; }
    }
    case 'media_screenshot': {
      try {
        const res = await fetch(`http://localhost:${WEB_PORT}/api/media/screenshot`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ quality: args.quality || 75 })
        });
        return await res.json();
      } catch (e) { return { error: `Media screenshot: ${e.message}` }; }
    }
    case 'vision_analyze': {
      const ss = await bridgeFetch(`/screenshot?quality=${args.quality || 60}&scale=0.75`);
      if (ss.error) return { error: `Screenshot: ${ss.error}` };
      if (ss.unchanged) return { unchanged: true, message: 'La pantalla no ha cambiado desde el último screenshot' };
      return {
        image_base64: ss.base64,
        width: ss.width,
        height: ss.height,
        question: args.question,
        hint: 'Usa un modelo de visión (p.ej., OpenAI GPT-4o, Anthropic Claude, Gemini) para analizar esta imagen'
      };
    }

    default:
      return { error: `Herramienta desconocida: ${name}` };
  }
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', d => body += d);
    req.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
  });
}

async function handleMCP(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  if (req.method === 'GET' && req.url === '/sse') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    const sessionId = crypto.randomUUID();
    res.write(`data: ${JSON.stringify({ type: 'session', sessionId })}\n\n`);
    sessions.set(sessionId, res);
    req.on('close', () => sessions.delete(sessionId));
    return;
  }

  if (req.method === 'POST' && req.url === '/messages') {
    const body = await parseBody(req);
    if (!body) { res.writeHead(400); res.end(JSON.stringify({ error: 'Invalid JSON' })); return; }
    const { method, params, id } = body;

    if (method === 'initialize') {
      res.writeHead(200);
      res.end(JSON.stringify({ jsonrpc: '2.0', id, result: { protocolVersion: '2024-11-05', capabilities: { tools: {} }, serverInfo: { name: 'MiMoCode-MCP', version: '2.0.0' } } }));
      return;
    }

    if (method === 'tools/list') {
      res.writeHead(200);
      res.end(JSON.stringify({ jsonrpc: '2.0', id, result: { tools } }));
      return;
    }

    if (method === 'tools/call') {
      const result = await executeTool(params.name, params.arguments || {});
      const content = [{ type: 'text', text: JSON.stringify(result, null, 2) }];
      res.writeHead(200);
      res.end(JSON.stringify({ jsonrpc: '2.0', id, result: { content } }));
      return;
    }

    if (method === 'notifications/initialized') {
      res.writeHead(200);
      res.end(JSON.stringify({ jsonrpc: '2.0', id }));
      return;
    }

    res.writeHead(404);
    res.end(JSON.stringify({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } }));
    return;
  }

  if (req.method === 'GET' && req.url === '/tools') {
    res.writeHead(200);
    res.end(JSON.stringify({ tools }));
    return;
  }

  if (req.method === 'POST' && req.url === '/call') {
    const body = await parseBody(req);
    if (!body || !body.name) { res.writeHead(400); res.end(JSON.stringify({ error: 'Missing tool name' })); return; }
    const result = await executeTool(body.name, body.arguments || {});
    res.writeHead(200);
    res.end(JSON.stringify(result));
    return;
  }

  if (req.url === '/health' || req.url === '/__health') {
    res.writeHead(200);
    res.end(JSON.stringify({ status: 'ok', service: 'MiMoCode MCP Server v2', port: MCP_PORT, tools: tools.map(t => t.name) }));
    return;
  }

  if (req.url === '/') {
    res.writeHead(200);
    res.end(JSON.stringify({ name: 'MiMoCode MCP Server v2', version: '2.0.0', endpoints: { mcp: '/messages (POST) + /sse (GET)', tools: '/tools (GET)', call: '/call (POST)', health: '/health' }, tools: tools.map(t => t.name) }, null, 2));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Not found' }));
}

const sessions = new Map();
const server = http.createServer(handleMCP);

server.listen(MCP_PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║      MiMoCode MCP Server v2 — PC/WEB MASTER     ║
╠══════════════════════════════════════════════════╣
║  MCP: http://0.0.0.0:${MCP_PORT}/messages         ║
║  SSE:  http://0.0.0.0:${MCP_PORT}/sse              ║
║  REST: http://0.0.0.0:${MCP_PORT}/call             ║
║  Tools: ${tools.length} registradas         ║
║  Bridge: ${BRIDGE_HTTP.padEnd(40)}║
╚══════════════════════════════════════════════════╝
  `);
  console.log(`[mimo-mcp] Tools: ${tools.map(t => t.name).join(', ')}`);
});

const mimoBin = spawn('mimo', ['serve', '--port', String(MCP_PORT + 10)], { stdio: 'ignore', env: { ...process.env, HOME: '/root' } });
mimoBin.on('error', () => {});
mimoBin.on('spawn', () => console.log('[mimo-mcp] MiMoCode serve en puerto', MCP_PORT + 10));
mimoBin.unref();

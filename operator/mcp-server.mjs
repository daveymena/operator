#!/usr/bin/env node

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║    Operator Pro — MCP Server (Model Context Protocol)           ║
 * ║    Para que OpenCode controle Operator desde su terminal        ║
 * ╚══════════════════════════════════════════════════════════════════╝
 * 
 * Este servidor MCP expone todas las herramientas de Operator Pro
 * para que OpenCode pueda usarlas directamente desde su interfaz.
 * 
 * OpenCode → MCP Server → Operator Pro → Tu PC
 * 
 * INSTALACIÓN EN OPENCODE:
 *   1. Edita tu .opencode/config.json o opencode.json
 *   2. Agrega:
 *      {
 *        "mcpServers": {
 *          "operator": {
 *            "command": "node",
 *            "args": ["/ruta/a/operator/operator/mcp-server.mjs"]
 *          }
 *        }
 *      }
 *   3. Reinicia OpenCode
 *   4. Ahora puedes decir: "Crea una campaña de Facebook Ads"
 *      y OpenCode usará Operator automáticamente
 */

import { getOrchestrator } from './core/orchestrator.mjs';
import { FacebookAdsSkill } from './skills/facebook-ads.mjs';
import { FacebookAdsMetrics } from './skills/facebook-ads-metrics.mjs';
import { FacebookAudienceBuilder } from './skills/facebook-audience.mjs';
import { AutoOptimizer } from './skills/auto-optimizer.mjs';
import { AlertSystem } from './skills/alert-system.mjs';
import { CampaignTemplates } from './skills/campaign-templates.mjs';
import { getTerminal } from './engines/terminal.mjs';
import { getBrowser } from './engines/browser.mjs';
import { getScreen } from './engines/screen.mjs';
import { getFilesystem } from './engines/filesystem.mjs';
import platform from './platform/index.mjs';

// ═══════════════════════════════════════════════════════════════════
//  MCP PROTOCOL IMPLEMENTATION (stdio transport)
// ═══════════════════════════════════════════════════════════════════

let orchestrator = null;
let initialized = false;

async function ensureInitialized() {
  if (!initialized) {
    orchestrator = getOrchestrator({ verbose: false, basePath: process.cwd() });
    await orchestrator.init();
    initialized = true;
  }
}

// ─── Tool Definitions ──────────────────────────────────────────────────────

const TOOLS = [
  // ═══ CORE TOOLS ═══
  {
    name: 'operator_run_task',
    description: 'Ejecuta una tarea autónoma compleja. Operator Pro planifica, ejecuta y verifica múltiples pasos automáticamente. Puede navegar la web, ejecutar comandos, manipular archivos, y más.',
    inputSchema: {
      type: 'object',
      properties: {
        task: { type: 'string', description: 'Descripción de la tarea a realizar' },
        max_steps: { type: 'number', description: 'Máximo de pasos (default: 50)' }
      },
      required: ['task']
    }
  },
  {
    name: 'operator_execute_action',
    description: 'Ejecuta una acción directa (screenshot, click, type, comando, etc). Lista de acciones: screenshot, browser_goto, browser_click, browser_type, terminal_exec, read_file, write_file, list_dir, mouse_click, keyboard_type, sysinfo, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'Tipo de acción' },
        params: { type: 'object', description: 'Parámetros de la acción' }
      },
      required: ['type']
    }
  },

  // ═══ TERMINAL ═══
  {
    name: 'operator_terminal',
    description: 'Ejecuta un comando en la terminal del sistema. Puede ejecutar cualquier comando: git, npm, python, node, ssh, docker, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Comando a ejecutar' },
        cwd: { type: 'string', description: 'Directorio de trabajo (opcional)' },
        timeout: { type: 'number', description: 'Timeout en ms (default: 30000)' }
      },
      required: ['command']
    }
  },

  // ═══ BROWSER ═══
  {
    name: 'operator_browser_navigate',
    description: 'Navega a una URL en el navegador',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL a navegar' }
      },
      required: ['url']
    }
  },
  {
    name: 'operator_browser_click',
    description: 'Hace click en un elemento del navegador (por texto, selector, o coordenadas)',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Texto del elemento a clickear' },
        selector: { type: 'string', description: 'Selector CSS' },
        x: { type: 'number', description: 'Coordenada X' },
        y: { type: 'number', description: 'Coordenada Y' }
      }
    }
  },
  {
    name: 'operator_browser_type',
    description: 'Escribe texto en un campo del navegador',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Texto a escribir' },
        selector: { type: 'string', description: 'Selector CSS del campo' },
        placeholder: { type: 'string', description: 'Placeholder del campo' }
      },
      required: ['text']
    }
  },
  {
    name: 'operator_browser_screenshot',
    description: 'Toma una captura de pantalla del navegador',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'operator_browser_content',
    description: 'Obtiene el contenido de texto de la página actual del navegador',
    inputSchema: { type: 'object', properties: {} }
  },

  // ═══ SCREEN / VISION ═══
  {
    name: 'operator_screenshot',
    description: 'Toma una captura de pantalla completa del escritorio',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'operator_describe_screen',
    description: 'Toma un screenshot y lo describe usando IA (ve lo que hay en pantalla)',
    inputSchema: { type: 'object', properties: {} }
  },

  // ═══ FILE SYSTEM ═══
  {
    name: 'operator_read_file',
    description: 'Lee el contenido de un archivo',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Ruta del archivo' }
      },
      required: ['path']
    }
  },
  {
    name: 'operator_write_file',
    description: 'Escribe contenido en un archivo',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Ruta del archivo' },
        content: { type: 'string', description: 'Contenido a escribir' }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'operator_list_dir',
    description: 'Lista el contenido de un directorio',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Ruta del directorio (default: .)' }
      }
    }
  },
  {
    name: 'operator_search_files',
    description: 'Busca archivos por nombre en un directorio',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directorio base' },
        pattern: { type: 'string', description: 'Patrón de búsqueda (regex)' }
      },
      required: ['pattern']
    }
  },

  // ═══ FACEBOOK ADS ═══
  {
    name: 'operator_fb_create_campaign',
    description: 'Crea una campaña en Facebook Ads Manager. Puede crearla vía API (rápido) o navegando la UI (como un humano).',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Nombre de la campaña' },
        objective: { type: 'string', description: 'Objetivo: OUTCOME_TRAFFIC, OUTCOME_SALES, OUTCOME_LEADS, OUTCOME_ENGAGEMENT, OUTCOME_AWARENESS' },
        budget: { type: 'number', description: 'Presupuesto diario en COP' },
        via_api: { type: 'boolean', description: 'Usar API (true) o navegar UI (false). Default: true' },
        save_as_draft: { type: 'boolean', description: 'Guardar como borrador (default: true)' }
      },
      required: ['name']
    }
  },
  {
    name: 'operator_fb_analyze_metrics',
    description: 'Analiza las métricas de campañas de Facebook Ads. Devuelve CTR, CPC, impresiones, clicks, gasto, y recomendaciones.',
    inputSchema: {
      type: 'object',
      properties: {
        date_preset: { type: 'string', description: 'Período: last_7d, last_14d, last_30d, today, yesterday' }
      }
    }
  },
  {
    name: 'operator_fb_segment_audience',
    description: 'Configura segmentación de audiencia para Facebook Ads (ubicación, edad, intereses).',
    inputSchema: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'Ubicación (país o ciudad)' },
        age_min: { type: 'number', description: 'Edad mínima' },
        age_max: { type: 'number', description: 'Edad máxima' },
        interests: { type: 'array', items: { type: 'string' }, description: 'Lista de intereses' }
      }
    }
  },
  {
    name: 'operator_fb_bulk_create',
    description: 'Crea múltiples campañas de Facebook Ads de una vez usando un template.',
    inputSchema: {
      type: 'object',
      properties: {
        template: { type: 'string', description: 'Nombre del template: ecommerce_basic, lead_gen_basic, education_course, etc.' },
        variations: { type: 'number', description: 'Número de variaciones a crear' }
      },
      required: ['template']
    }
  },

  // ═══ AUTO-OPTIMIZATION ═══
  {
    name: 'operator_start_auto_optimizer',
    description: 'Inicia el auto-optimizador que optimiza campañas automáticamente 24/7 (pausa malas, escala buenas).',
    inputSchema: {
      type: 'object',
      properties: {
        interval_minutes: { type: 'number', description: 'Intervalo de verificación en minutos (default: 30)' }
      }
    }
  },
  {
    name: 'operator_stop_auto_optimizer',
    description: 'Detiene el auto-optimizador.',
    inputSchema: { type: 'object', properties: {} }
  },

  // ═══ ALERTS ═══
  {
    name: 'operator_start_alerts',
    description: 'Inicia el sistema de alertas en tiempo real que monitorea campañas y notifica problemas.',
    inputSchema: {
      type: 'object',
      properties: {
        interval_minutes: { type: 'number', description: 'Intervalo de verificación en minutos (default: 15)' }
      }
    }
  },
  {
    name: 'operator_get_active_alerts',
    description: 'Obtiene las alertas activas (problemas detectados en campañas).',
    inputSchema: { type: 'object', properties: {} }
  },

  // ═══ SYSTEM ═══
  {
    name: 'operator_system_info',
    description: 'Obtiene información del sistema (OS, CPU, RAM, uptime, etc.)',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'operator_list_windows',
    description: 'Lista las ventanas abiertas en el escritorio',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'operator_list_processes',
    description: 'Lista los procesos corriendo en el sistema',
    inputSchema: { type: 'object', properties: {} }
  },

  // ═══ MOUSE / KEYBOARD ═══
  {
    name: 'operator_mouse_click',
    description: 'Hace click en coordenadas específicas del escritorio',
    inputSchema: {
      type: 'object',
      properties: {
        x: { type: 'number', description: 'Coordenada X' },
        y: { type: 'number', description: 'Coordenada Y' },
        button: { type: 'string', description: 'Botón: left o right' }
      },
      required: ['x', 'y']
    }
  },
  {
    name: 'operator_keyboard_type',
    description: 'Escribe texto usando el teclado del sistema',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Texto a escribir' }
      },
      required: ['text']
    }
  },

  // ═══ TASK MANAGEMENT ═══
  {
    name: 'operator_get_active_tasks',
    description: 'Lista las tareas autónomas actualmente en ejecución',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'operator_cancel_task',
    description: 'Cancela una tarea en ejecución',
    inputSchema: {
      type: 'object',
      properties: {
        task_id: { type: 'string', description: 'ID de la tarea a cancelar' }
      },
      required: ['task_id']
    }
  },

  // ═══ HTTP / API ═══
  {
    name: 'operator_http_get',
    description: 'Hace una petición HTTP GET a una URL',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL a consultar' }
      },
      required: ['url']
    }
  },
  {
    name: 'operator_http_post',
    description: 'Hace una petición HTTP POST a una URL con datos',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL' },
        data: { type: 'object', description: 'Datos a enviar' }
      },
      required: ['url', 'data']
    }
  },

  // ═══ PLUGINS ═══
  {
    name: 'operator_list_plugins',
    description: 'Lista los plugins cargados en Operator Pro',
    inputSchema: { type: 'object', properties: {} }
  }
];

// ─── Tool Execution ────────────────────────────────────────────────────────

async function executeTool(name, args) {
  await ensureInitialized();

  try {
    switch (name) {
      // Core
      case 'operator_run_task': {
        const result = await orchestrator.runTask(args.task, { maxSteps: args.max_steps || 50 });
        return formatResult(result);
      }
      case 'operator_execute_action': {
        const result = await orchestrator.executeAction({ type: args.type, params: args.params || {} });
        return formatResult(result);
      }

      // Terminal
      case 'operator_terminal': {
        const terminal = getTerminal();
        const result = await terminal.exec(args.command, { cwd: args.cwd, timeout: args.timeout });
        return formatResult(result);
      }

      // Browser
      case 'operator_browser_navigate': {
        const browser = getBrowser();
        if (!browser.connected) await browser.connect();
        const result = await browser.goto({ url: args.url });
        return formatResult(result);
      }
      case 'operator_browser_click': {
        const browser = getBrowser();
        if (!browser.connected) await browser.connect();
        const result = await browser.click(args);
        return formatResult(result);
      }
      case 'operator_browser_type': {
        const browser = getBrowser();
        if (!browser.connected) await browser.connect();
        const result = await browser.type({ text: args.text, selector: args.selector, placeholder: args.placeholder });
        return formatResult(result);
      }
      case 'operator_browser_screenshot': {
        const browser = getBrowser();
        if (!browser.connected) await browser.connect();
        const result = await browser.screenshot();
        if (result.ok) {
          return { content: [{ type: 'text', text: `Screenshot saved: ${result.file} (${Math.round(result.size/1024)}KB)` }] };
        }
        return formatResult(result);
      }
      case 'operator_browser_content': {
        const browser = getBrowser();
        if (!browser.connected) await browser.connect();
        const result = await browser.getContent({ text: true });
        return formatResult(result);
      }

      // Screen
      case 'operator_screenshot': {
        const screen = getScreen();
        const result = await screen.capture();
        if (result.ok) {
          return { content: [{ type: 'text', text: `Screenshot saved: ${result.file}` }] };
        }
        return formatResult(result);
      }
      case 'operator_describe_screen': {
        const screen = getScreen();
        const result = await screen.capture({ quality: 50, scale: 0.75 });
        if (result.ok && orchestrator.brain) {
          const desc = await orchestrator.brain.describeImage(result.base64);
          return { content: [{ type: 'text', text: desc || 'Could not describe image' }] };
        }
        return formatResult(result);
      }

      // Filesystem
      case 'operator_read_file': {
        const fs = getFilesystem();
        const result = await fs.readFile(args.path);
        return formatResult(result);
      }
      case 'operator_write_file': {
        const fs = getFilesystem();
        const result = await fs.writeFile(args.path, args.content);
        return formatResult(result);
      }
      case 'operator_list_dir': {
        const fs = getFilesystem();
        const result = await fs.listDir(args.path || '.');
        return formatResult(result);
      }
      case 'operator_search_files': {
        const fs = getFilesystem();
        const result = await fs.search(args.path || '.', args.pattern);
        return formatResult(result);
      }

      // Facebook Ads
      case 'operator_fb_create_campaign': {
        const fb = new FacebookAdsSkill({ verbose: false });
        if (args.via_api !== false) {
          const result = await fb.createCampaignViaAPI({
            name: args.name,
            objective: args.objective || 'OUTCOME_TRAFFIC',
            dailyBudget: args.budget || 5000,
            status: args.save_as_draft !== false ? 'PAUSED' : 'ACTIVE'
          });
          return formatResult(result);
        } else {
          const init = await fb.init();
          if (!init.ok) return formatResult(init);
          const result = await fb.createCampaign({
            name: args.name,
            objective: args.objective || 'OUTCOME_TRAFFIC',
            budget: args.budget || 5000,
            saveAsDraft: args.save_as_draft !== false
          });
          return formatResult(result);
        }
      }
      case 'operator_fb_analyze_metrics': {
        const metrics = new FacebookAdsMetrics({ verbose: false });
        const result = await metrics.analyze({ datePreset: args.date_preset || 'last_30d' });
        if (result.ok) {
          return { content: [{ type: 'text', text: metrics.formatReport(result) }] };
        }
        return formatResult(result);
      }
      case 'operator_fb_segment_audience': {
        const audience = new FacebookAudienceBuilder({ verbose: false });
        const config = {
          countries: args.location ? [args.location] : ['CO'],
          ageMin: args.age_min || 18,
          ageMax: args.age_max || 65,
          interests: (args.interests || []).map(name => ({ id: '0', name }))
        };
        const { targeting } = audience.buildTargeting(config);
        const text = audience.formatAudienceSummary(config);
        return { content: [{ type: 'text', text }] };
      }
      case 'operator_fb_bulk_create': {
        const templates = new CampaignTemplates({ verbose: false });
        const variations = Array.from({ length: args.variations || 5 }, (_, i) => ({
          name: `${args.template} - Variation ${i + 1}`,
          suffix: `v${i + 1}`
        }));
        const result = await templates.bulkCreateFromTemplate(args.template, variations);
        return formatResult(result);
      }

      // Auto-optimizer
      case 'operator_start_auto_optimizer': {
        const optimizer = new AutoOptimizer({ verbose: false });
        optimizer.loadDefaultRules();
        const result = optimizer.start(args.interval_minutes || 30);
        return formatResult(result);
      }
      case 'operator_stop_auto_optimizer': {
        const optimizer = new AutoOptimizer({ verbose: false });
        return formatResult(optimizer.stop());
      }

      // Alerts
      case 'operator_start_alerts': {
        const alerts = new AlertSystem({ verbose: false });
        alerts.loadDefaultRules();
        return formatResult(alerts.start(args.interval_minutes || 15));
      }
      case 'operator_get_active_alerts': {
        const alerts = new AlertSystem({ verbose: false });
        const active = alerts.getActiveAlerts();
        const text = active.length === 0
          ? '✅ No hay alertas activas'
          : active.map(a => `${a.severity === 'critical' ? '🚨' : '⚠️'} ${a.ruleName}: ${a.message}`).join('\n');
        return { content: [{ type: 'text', text }] };
      }

      // System
      case 'operator_system_info': {
        const info = await platform.getSystemInfo();
        return formatResult({ ok: true, ...info });
      }
      case 'operator_list_windows': {
        const result = await platform.listWindows();
        return formatResult(result);
      }
      case 'operator_list_processes': {
        const result = await platform.listProcesses();
        return formatResult(result);
      }

      // Mouse / Keyboard
      case 'operator_mouse_click': {
        const result = await platform.mouseClick(args.x, args.y, args.button || 'left');
        return formatResult(result);
      }
      case 'operator_keyboard_type': {
        const result = await platform.keyboardType(args.text);
        return formatResult(result);
      }

      // Task management
      case 'operator_get_active_tasks': {
        const tasks = orchestrator.getActiveTasks();
        return formatResult({ ok: true, tasks });
      }
      case 'operator_cancel_task': {
        const result = await orchestrator.cancelTask(args.task_id);
        return formatResult(result);
      }

      // HTTP
      case 'operator_http_get': {
        const fs = getFilesystem();
        const result = await fs.httpGet(args.url);
        return formatResult(result);
      }
      case 'operator_http_post': {
        const fs = getFilesystem();
        const result = await fs.httpPost(args.url, args.data);
        return formatResult(result);
      }

      // Plugins
      case 'operator_list_plugins': {
        const plugins = orchestrator.plugins ? [...orchestrator.plugins.keys()] : [];
        return { content: [{ type: 'text', text: `Plugins: ${plugins.join(', ') || 'none loaded'}` }] };
      }

      default:
        return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }
  } catch (e) {
    return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
  }
}

function formatResult(data) {
  if (typeof data === 'string') {
    return { content: [{ type: 'text', text: data }] };
  }
  if (data && typeof data === 'object') {
    // Remove large base64 data from responses
    const clean = { ...data };
    delete clean.base64;
    const text = JSON.stringify(clean, null, 2);
    return { content: [{ type: 'text', text: text.length > 10000 ? text.substring(0, 10000) + '\n...[truncated]' : text }] };
  }
  return { content: [{ type: 'text', text: String(data) }] };
}

// ═══════════════════════════════════════════════════════════════════
//  MCP SERVER (JSON-RPC over stdio)
// ═══════════════════════════════════════════════════════════════════

let buffer = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  
  // Process complete JSON-RPC messages (Content-Length header based framing)
  while (true) {
    const headerEnd = buffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) break;

    const header = buffer.substring(0, headerEnd);
    const match = header.match(/Content-Length:\s*(\d+)/i);
    if (!match) {
      buffer = buffer.substring(headerEnd + 4);
      continue;
    }

    const contentLength = parseInt(match[1]);
    const messageStart = headerEnd + 4;
    
    if (buffer.length < messageStart + contentLength) break;

    const messageText = buffer.substring(messageStart, messageStart + contentLength);
    buffer = buffer.substring(messageStart + contentLength);

    try {
      const message = JSON.parse(messageText);
      handleMessage(message);
    } catch (e) {
      sendError(null, -32700, 'Parse error');
    }
  }
});

function sendMessage(obj) {
  const json = JSON.stringify(obj);
  const header = `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n`;
  process.stdout.write(header + json);
}

function sendResult(id, result) {
  sendMessage({ jsonrpc: '2.0', id, result });
}

function sendError(id, code, message, data) {
  sendMessage({ jsonrpc: '2.0', id, error: { code, message, data } });
}

async function handleMessage(message) {
  const { id, method, params } = message;

  switch (method) {
    case 'initialize':
      sendResult(id, {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        serverInfo: {
          name: 'operator-pro',
          version: '3.0.0'
        }
      });
      break;

    case 'notifications/initialized':
      // No response needed
      break;

    case 'tools/list':
      sendResult(id, { tools: TOOLS });
      break;

    case 'tools/call': {
      const { name, arguments: args } = params;
      try {
        const result = await executeTool(name, args || {});
        sendResult(id, result);
      } catch (e) {
        sendResult(id, { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true });
      }
      break;
    }

    default:
      sendError(id, -32601, `Method not found: ${method}`);
  }
}

// Handle startup
process.stderr.write('Operator Pro MCP Server started (stdio transport)\n');

/**
 * Operator Pro — Plugin System
 * 
 * Extensible plugin architecture:
 * - Plugins register custom actions
 * - Each plugin has lifecycle hooks (init, destroy)
 * - Plugins can declare dependencies
 * - Built-in plugin discovery from plugins/ directory
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PLUGINS_DIR = path.join(__dirname, '..', 'plugins');

export class PluginManager {
  constructor(orchestrator) {
    this.orchestrator = orchestrator;
    this.plugins = new Map();
    this.verbose = orchestrator?.verbose || false;
  }

  /**
   * Discover and load all plugins from the plugins directory
   */
  async discoverAndLoad() {
    if (!fs.existsSync(PLUGINS_DIR)) {
      fs.mkdirSync(PLUGINS_DIR, { recursive: true });
      return { ok: true, loaded: 0 };
    }

    const files = fs.readdirSync(PLUGINS_DIR).filter(f => f.endsWith('.mjs') || f.endsWith('.js'));
    let loaded = 0;

    for (const file of files) {
      try {
        const pluginPath = path.join(PLUGINS_DIR, file);
        const pluginModule = await import(pluginPath);
        const plugin = pluginModule.default || pluginModule;

        if (plugin.name && plugin.actions) {
          await this.load(plugin);
          loaded++;
        }
      } catch (e) {
        this._log(`Failed to load plugin ${file}: ${e.message}`);
      }
    }

    return { ok: true, loaded };
  }

  /**
   * Load a plugin
   */
  async load(plugin) {
    if (!plugin.name) throw new Error('Plugin must have a name');
    if (!plugin.actions || !Array.isArray(plugin.actions)) throw new Error('Plugin must declare actions array');
    if (!plugin.execute || typeof plugin.execute !== 'function') throw new Error('Plugin must have execute()');

    // Check dependencies
    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        if (!this.plugins.has(dep)) {
          throw new Error(`Plugin ${plugin.name} requires ${dep} which is not loaded`);
        }
      }
    }

    // Initialize
    if (plugin.init) await plugin.init(this.orchestrator);

    // Register with orchestrator
    this.plugins.set(plugin.name, plugin);
    this.orchestrator?.registerPlugin(plugin);

    this._log(`Plugin loaded: ${plugin.name} v${plugin.version || '1.0'} (${plugin.actions.length} actions)`);
    return { ok: true, name: plugin.name, actions: plugin.actions };
  }

  /**
   * Unload a plugin
   */
  async unload(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) return { ok: false, error: 'Plugin not found' };

    if (plugin.destroy) await plugin.destroy();
    this.plugins.delete(name);

    return { ok: true, name };
  }

  /**
   * List all loaded plugins
   */
  list() {
    return Array.from(this.plugins.entries()).map(([name, p]) => ({
      name,
      version: p.version || '1.0',
      description: p.description || '',
      actions: p.actions || [],
      dependencies: p.dependencies || []
    }));
  }

  /**
   * Get info about a specific plugin
   */
  get(name) {
    const plugin = this.plugins.get(name);
    if (!plugin) return null;
    return {
      name,
      version: plugin.version,
      description: plugin.description,
      actions: plugin.actions,
      dependencies: plugin.dependencies || [],
      config: plugin.config || {}
    };
  }

  /**
   * Create a plugin template
   */
  createTemplate(name) {
    const template = `/**
 * Operator Pro Plugin: ${name}
 * 
 * Template plugin — customize the execute() method and actions array.
 */

export default {
  name: '${name}',
  version: '1.0.0',
  description: 'Custom ${name} plugin for Operator Pro',
  dependencies: [],

  // List of action types this plugin handles
  actions: ['${name}_action'],

  // Called when plugin is loaded
  async init(orchestrator) {
    console.log('[${name}] Plugin initialized');
  },

  // Called when plugin is unloaded
  async destroy() {
    console.log('[${name}] Plugin destroyed');
  },

  // Main execution handler — matches action types to handlers
  async execute(action) {
    const { type, params } = action;

    switch (type) {
      case '${name}_action':
        return this.handleAction(params);
      default:
        return { ok: false, error: \`Unknown action: \${type}\` };
    }
  },

  // Your custom action handler
  async handleAction(params) {
    // Implement your logic here
    return { ok: true, message: '${name} action executed', params };
  }
};
`;

    const filepath = path.join(PLUGINS_DIR, `${name}.mjs`);
    fs.mkdirSync(PLUGINS_DIR, { recursive: true });
    fs.writeFileSync(filepath, template);
    return { ok: true, path: filepath };
  }

  _log(msg) { if (this.verbose) console.log(`  [Plugins] ${msg}`); }
}

// ─── Built-in Plugin: Web Scraper ──────────────────────────────────────────────

export const WebScraperPlugin = {
  name: 'web-scraper',
  version: '1.0.0',
  description: 'Advanced web scraping with structured data extraction',
  actions: ['scrape_page', 'extract_table', 'extract_links', 'extract_images'],

  async init(orchestrator) {
    this.browser = orchestrator?.browser;
  },

  async execute(action) {
    if (!this.browser?.connected) return { ok: false, error: 'Browser not connected' };

    switch (action.type) {
      case 'scrape_page': return this.scrapePage(action.params);
      case 'extract_table': return this.extractTable(action.params);
      case 'extract_links': return this.extractLinks(action.params);
      case 'extract_images': return this.extractImages(action.params);
      default: return { ok: false, error: `Unknown action: ${action.type}` };
    }
  },

  async scrapePage(params) {
    try {
      const data = await this.browser.page.evaluate((opts) => {
        const result = { title: document.title, url: location.href };
        if (opts.selectors) {
          result.data = {};
          for (const [key, sel] of Object.entries(opts.selectors)) {
            const els = document.querySelectorAll(sel);
            result.data[key] = [...els].map(el => el.textContent?.trim()).filter(Boolean);
          }
        }
        if (opts.meta) {
          result.meta = {};
          document.querySelectorAll('meta').forEach(m => {
            if (m.name) result.meta[m.name] = m.content;
          });
        }
        return result;
      }, params || {});
      return { ok: true, ...data };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },

  async extractTable(params) {
    try {
      const data = await this.browser.page.evaluate((selector) => {
        const table = document.querySelector(selector || 'table');
        if (!table) return null;
        const headers = [...table.querySelectorAll('th')].map(th => th.textContent?.trim());
        const rows = [...table.querySelectorAll('tr')].slice(headers.length ? 1 : 0).map(tr =>
          [...tr.querySelectorAll('td')].map(td => td.textContent?.trim())
        );
        return { headers, rows, rowCount: rows.length };
      }, params?.selector);
      return data ? { ok: true, ...data } : { ok: false, error: 'No table found' };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },

  async extractLinks(params) {
    try {
      const data = await this.browser.page.evaluate((filter) => {
        const links = [...document.querySelectorAll('a')];
        return links
          .filter(a => !filter || a.href?.includes(filter))
          .map(a => ({ text: a.textContent?.trim(), href: a.href, title: a.title }))
          .filter(l => l.href);
      }, params?.filter);
      return { ok: true, links: data, count: data.length };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  },

  async extractImages(params) {
    try {
      const data = await this.browser.page.evaluate((filter) => {
        const imgs = [...document.querySelectorAll('img')];
        return imgs
          .filter(img => !filter || img.src?.includes(filter))
          .map(img => ({ src: img.src, alt: img.alt, width: img.naturalWidth, height: img.naturalHeight }))
          .filter(i => i.src);
      }, params?.filter);
      return { ok: true, images: data, count: data.length };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }
};

// ─── Built-in Plugin: System Monitor ───────────────────────────────────────────

export const SystemMonitorPlugin = {
  name: 'system-monitor',
  version: '1.0.0',
  description: 'System monitoring and health checks',
  actions: ['system_health', 'disk_usage', 'memory_usage', 'cpu_usage', 'network_info'],

  async execute(action) {
    const os = await import('os');
    switch (action.type) {
      case 'system_health': return this.health(os);
      case 'disk_usage': return this.diskUsage();
      case 'memory_usage': return this.memoryUsage(os);
      case 'cpu_usage': return this.cpuUsage(os);
      case 'network_info': return this.networkInfo(os);
      default: return { ok: false, error: `Unknown: ${action.type}` };
    }
  },

  async health(os) {
    return {
      ok: true,
      uptime: os.default.uptime(),
      loadAvg: os.default.loadavg(),
      freeMem: Math.round(os.default.freemem() / 1024 / 1024),
      totalMem: Math.round(os.default.totalmem() / 1024 / 1024),
      cpus: os.default.cpus().length,
      platform: os.default.platform(),
      arch: os.default.arch()
    };
  },

  async diskUsage() {
    const { execSync } = await import('child_process');
    try {
      const out = execSync('df -h 2>/dev/null || wmic logicaldisk get size,freespace,caption', { encoding: 'utf8' });
      return { ok: true, output: out.trim() };
    } catch (e) { return { ok: false, error: e.message }; }
  },

  async memoryUsage(os) {
    const total = os.default.totalmem();
    const free = os.default.freemem();
    const used = total - free;
    return {
      ok: true,
      totalMB: Math.round(total / 1024 / 1024),
      freeMB: Math.round(free / 1024 / 1024),
      usedMB: Math.round(used / 1024 / 1024),
      usedPercent: Math.round((used / total) * 100)
    };
  },

  async cpuUsage(os) {
    const cpus = os.default.cpus();
    const avgLoad = os.default.loadavg();
    return {
      ok: true,
      cores: cpus.length,
      model: cpus[0]?.model,
      loadAvg1: avgLoad[0], loadAvg5: avgLoad[1], loadAvg15: avgLoad[2]
    };
  },

  async networkInfo(os) {
    const interfaces = os.default.networkInterfaces();
    const result = {};
    for (const [name, addrs] of Object.entries(interfaces)) {
      result[name] = addrs.map(a => ({ address: a.address, family: a.family, internal: a.internal }));
    }
    return { ok: true, interfaces: result };
  }
};

export default PluginManager;

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║    Operator Pro — UNIVERSAL SKILL FACTORY                       ║
 * ║    Crea skills para CUALQUIER proyecto en 5 minutos             ║
 * ╚══════════════════════════════════════════════════════════════════╝
 * 
 * La arquitectura de Operator Pro es UNIVERSAL:
 * 
 *   🧠 Brain (IA)           → Razona sobre CUALQUIER tarea
 *   👁️  Computer Use        → Ve + entiende CUALQUIER pantalla
 *   🌐 Browser Engine       → Navega CUALQUIER sitio web
 *   ⚡ Terminal Engine      → Ejecuta CUALQUIER comando
 *   📸 Screen Engine        → Captura CUALQUIER pantalla
 *   📁 Filesystem Engine    → Maneja CUALQUIER archivo
 *   🎯 Orchestrator         → Coordina todo automáticamente
 * 
 * Los "skills" son solo wrappers que combinan estos motores
 * para dominios específicos. Aquí hay ejemplos para TODO:
 */

import { ComputerUseEngine } from '../engines/computer-use.mjs';
import { getBrowser } from '../engines/browser.mjs';
import { getTerminal } from '../engines/terminal.mjs';
import { getScreen } from '../engines/screen.mjs';
import { getFilesystem } from '../engines/filesystem.mjs';
import platform from '../platform/index.mjs';

/**
 * Base class para crear cualquier skill en minutos
 */
export class UniversalSkill {
  constructor(opts = {}) {
    this.name = opts.name || 'Unnamed Skill';
    this.verbose = opts.verbose || false;
    this.browser = getBrowser(opts);
    this.terminal = getTerminal(opts);
    this.screen = getScreen(opts);
    this.fs = getFilesystem(opts);
    this.computer = null;
  }

  async initComputerUse(brain) {
    this.computer = new ComputerUseEngine({ verbose: this.verbose, brain });
  }

  _log(msg) { if (this.verbose) console.log(`  [${this.name}] ${msg}`); }
  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
}

// ═══════════════════════════════════════════════════════════════════
//  SKILL 1: E-COMMERCE — Gestionar cualquier tienda online
// ═══════════════════════════════════════════════════════════════════

export class ECommerceSkill extends UniversalSkill {
  constructor(opts = {}) {
    super({ ...opts, name: 'E-Commerce' });
    this.storeUrl = opts.storeUrl || '';
    this.adminUrl = opts.adminUrl || '';
    this.credentials = opts.credentials || {};
  }

  /**
   * Login a cualquier plataforma de e-commerce
   */
  async login() {
    await this.browser.goto({ url: this.adminUrl, wait: 3000 });
    await this.computer.smartType('email', this.credentials.email || this.credentials.username);
    await this.computer.smartType('password', this.credentials.password);
    await this.computer.smartClick('Login', { waitAfter: 3000 });
    return this.computer.verify('Dashboard');
  }

  /**
   * Agregar producto a Shopify/WooCommerce/Magento/etc
   */
  async addProduct(product) {
    const { name, price, description, images = [], category, sku } = product;
    
    return this.computer.executeWorkflow([
      { action: 'click', target: 'Products', description: 'Go to products' },
      { action: 'click', target: 'Add product', description: 'New product' },
      { action: 'type', target: 'Title', text: name, description: 'Product name' },
      { action: 'type', target: 'Description', text: description, description: 'Description' },
      { action: 'type', target: 'Price', text: String(price), description: 'Price', clear: true },
      ...(sku ? [{ action: 'type', target: 'SKU', text: sku, description: 'SKU' }] : []),
      ...(category ? [{ action: 'type', target: 'Category', text: category, description: 'Category' }] : []),
      { action: 'click', target: 'Save', description: 'Save product', waitAfter: 3000 },
      { action: 'verify', expected: 'saved', description: 'Verify saved' }
    ]);
  }

  /**
   * Listar pedidos recientes
   */
  async getRecentOrders(limit = 20) {
    return this.computer.executeWorkflow([
      { action: 'click', target: 'Orders', description: 'Go to orders' },
      { action: 'observe', description: 'Read orders table' }
    ]);
  }

  /**
   * Actualizar inventario
   */
  async updateInventory(productId, quantity) {
    return this.computer.executeWorkflow([
      { action: 'goto', url: `${this.adminUrl}/products/${productId}` },
      { action: 'type', target: 'Inventory', text: String(quantity), clear: true },
      { action: 'click', target: 'Save', waitAfter: 2000 },
      { action: 'verify', expected: 'saved' }
    ]);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  SKILL 2: DESARROLLO — GitHub, deployment, CI/CD
// ═══════════════════════════════════════════════════════════════════

export class DevOpsSkill extends UniversalSkill {
  constructor(opts = {}) {
    super({ ...opts, name: 'DevOps' });
  }

  /**
   * Crear repositorio en GitHub
   */
  async createGitHubRepo(name, opts = {}) {
    return this.computer.executeWorkflow([
      { action: 'goto', url: 'https://github.com/new', wait: 3000 },
      { action: 'type', target: 'Repository name', text: name, clear: true },
      ...(opts.description ? [{ action: 'type', target: 'Description', text: opts.description }] : []),
      { action: 'click', target: opts.private ? 'Private' : 'Public' },
      { action: 'click', target: 'Create repository', waitAfter: 5000 },
      { action: 'verify', expected: name }
    ]);
  }

  /**
   * Deploy a Vercel/Netlify/Railway
   */
  async deploy(platform, projectPath) {
    const commands = {
      vercel: 'npx vercel --prod',
      netlify: 'npx netlify deploy --prod',
      railway: 'railway up',
      fly: 'fly deploy',
      heroku: 'git push heroku main',
      docker: 'docker build -t app . && docker push app'
    };

    const cmd = commands[platform];
    if (!cmd) return { ok: false, error: `Unknown platform: ${platform}` };

    return this.terminal.exec(cmd, { cwd: projectPath, timeout: 300000 });
  }

  /**
   * Crear PR en GitHub
   */
  async createPullRequest(opts = {}) {
    const { title, body, base = 'main', head } = opts;
    return this.terminal.exec(
      `gh pr create --title "${title}" --body "${body || ''}" --base ${base} ${head ? `--head ${head}` : ''}`
    );
  }

  /**
   * Revisar logs de producción
   */
  async checkLogs(platform, opts = {}) {
    const commands = {
      vercel: 'vercel logs --output raw',
      railway: 'railway logs',
      fly: 'fly logs',
      heroku: 'heroku logs --tail -n 50',
      docker: 'docker logs --tail 50'
    };
    return this.terminal.exec(commands[platform] || 'echo "Unknown platform"');
  }

  /**
   * Monitorear CI/CD pipeline
   */
  async monitorPipeline(repo) {
    return this.terminal.exec(`gh run list --repo ${repo} --limit 5`);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  SKILL 3: GOOGLE WORKSPACE — Sheets, Docs, Drive, Gmail
// ═══════════════════════════════════════════════════════════════════

export class GoogleWorkspaceSkill extends UniversalSkill {
  constructor(opts = {}) {
    super({ ...opts, name: 'Google Workspace' });
  }

  /**
   * Crear spreadsheet con datos
   */
  async createSpreadsheet(title, data) {
    return this.computer.executeWorkflow([
      { action: 'goto', url: 'https://sheets.google.com/create', wait: 5000 },
      { action: 'click', target: 'Untitled spreadsheet', waitAfter: 500 },
      { action: 'type', target: 'Untitled spreadsheet', text: title, clear: true },
      { action: 'press', key: 'Enter', waitAfter: 1000 },
      // Data would be typed cell by cell
      { action: 'verify', expected: title }
    ]);
  }

  /**
   * Enviar email desde Gmail
   */
  async sendEmail(to, subject, body, attachments = []) {
    return this.computer.executeWorkflow([
      { action: 'goto', url: 'https://mail.google.com/mail/#inbox?compose=new', wait: 3000 },
      { action: 'type', target: 'To', text: to, waitAfter: 500 },
      { action: 'press', key: 'Tab' },
      { action: 'type', target: 'Subject', text: subject, waitAfter: 500 },
      { action: 'press', key: 'Tab' },
      { action: 'type', target: '', text: body },
      { action: 'click', target: 'Send', waitAfter: 3000 },
      { action: 'verify', expected: 'sent' }
    ]);
  }

  /**
   * Subir archivo a Google Drive
   */
  async uploadToDrive(filePath, folder) {
    return this.computer.executeWorkflow([
      { action: 'goto', url: `https://drive.google.com/drive/folders/${folder || 'my-drive'}`, wait: 3000 },
      { action: 'click', target: 'New', waitAfter: 1000 },
      { action: 'click', target: 'File upload', waitAfter: 2000 },
      // File input handled via Puppeteer file upload
      { action: 'wait', ms: 5000 },
      { action: 'verify', expected: 'upload complete' }
    ]);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  SKILL 4: RESEARCH — Investigar cualquier tema en la web
// ═══════════════════════════════════════════════════════════════════

export class WebResearchSkill extends UniversalSkill {
  constructor(opts = {}) {
    super({ ...opts, name: 'Web Research' });
    this.results = [];
  }

  /**
   * Buscar y extraer información de múltiples fuentes
   */
  async research(topic, opts = {}) {
    const { sources = 5, depth = 'summary' } = opts;
    
    // Search Google
    await this.browser.goto({ url: `https://www.google.com/search?q=${encodeURIComponent(topic)}`, wait: 3000 });
    
    // Extract results
    const searchResults = await this.browser.page.evaluate(() => {
      const results = [];
      document.querySelectorAll('div.g, div[data-hveid]').forEach(el => {
        const title = el.querySelector('h3')?.textContent;
        const link = el.querySelector('a')?.href;
        const snippet = el.querySelector('[data-sncf], .VwiC3b')?.textContent;
        if (title && link) results.push({ title, link, snippet });
      });
      return results.slice(0, 10);
    });

    // Visit top results
    for (const result of searchResults.slice(0, sources)) {
      try {
        await this.browser.goto({ url: result.link, wait: 3000 });
        const content = await this.browser.getContent({ text: true });
        this.results.push({
          source: result.link,
          title: result.title,
          content: content.content?.substring(0, 5000),
          extractedAt: Date.now()
        });
      } catch {}
    }

    return {
      ok: true,
      topic,
      results: this.results,
      sourcesCount: this.results.length
    };
  }

  /**
   * Extraer datos estructurados de una página
   */
  async extractData(url, schema) {
    await this.browser.goto({ url, wait: 3000 });
    
    const data = await this.browser.page.evaluate((selectors) => {
      const result = {};
      for (const [key, selector] of Object.entries(selectors)) {
        const els = document.querySelectorAll(selector);
        result[key] = [...els].map(el => el.textContent?.trim()).filter(Boolean);
      }
      return result;
    }, schema);

    return { ok: true, url, data };
  }

  /**
   * Comparar precios de un producto en múltiples tiendas
   */
  async comparePrices(product, stores = ['amazon', 'mercadolibre', 'ebay']) {
    const results = [];
    
    const urls = {
      amazon: `https://www.amazon.com/s?k=${encodeURIComponent(product)}`,
      mercadolibre: `https://listado.mercadolibre.com.co/${encodeURIComponent(product)}`,
      ebay: `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(product)}`
    };

    for (const store of stores) {
      try {
        await this.browser.goto({ url: urls[store], wait: 3000 });
        const prices = await this.browser.page.evaluate(() => {
          const priceEls = document.querySelectorAll('[data-price], .price, .s-price, .ui-pdp-price');
          return [...priceEls].slice(0, 5).map(el => el.textContent?.trim());
        });
        results.push({ store, prices });
      } catch {}
    }

    return { ok: true, product, results };
  }
}

// ═══════════════════════════════════════════════════════════════════
//  SKILL 5: CRM — Salesforce, HubSpot, Pipedrive, etc.
// ═══════════════════════════════════════════════════════════════════

export class CRMSkill extends UniversalSkill {
  constructor(opts = {}) {
    super({ ...opts, name: 'CRM' });
    this.crmPlatform = opts.platform || 'hubspot'; // hubspot, salesforce, pipedrive
  }

  /**
   * Agregar lead/contacto
   */
  async addLead(lead) {
    const { name, email, phone, company, source } = lead;
    
    return this.computer.executeWorkflow([
      { action: 'click', target: 'Contacts', waitAfter: 2000 },
      { action: 'click', target: 'Create contact', waitAfter: 2000 },
      { action: 'type', target: 'First name', text: name.split(' ')[0], clear: true },
      { action: 'type', target: 'Last name', text: name.split(' ').slice(1).join(' '), clear: true },
      { action: 'type', target: 'Email', text: email, clear: true },
      ...(phone ? [{ action: 'type', target: 'Phone', text: phone, clear: true }] : []),
      ...(company ? [{ action: 'type', target: 'Company', text: company, clear: true }] : []),
      { action: 'click', target: 'Save', waitAfter: 3000 },
      { action: 'verify', expected: name }
    ]);
  }

  /**
   * Crear deal/oportunidad
   */
  async createDeal(deal) {
    const { name, value, stage, contact } = deal;
    
    return this.computer.executeWorkflow([
      { action: 'click', target: 'Deals', waitAfter: 2000 },
      { action: 'click', target: 'Create deal', waitAfter: 2000 },
      { action: 'type', target: 'Deal name', text: name, clear: true },
      { action: 'type', target: 'Amount', text: String(value), clear: true },
      ...(contact ? [{ action: 'type', target: 'Contact', text: contact }] : []),
      { action: 'click', target: 'Save', waitAfter: 3000 },
      { action: 'verify', expected: name }
    ]);
  }

  /**
   * Generar reporte de ventas
   */
  async generateReport(period = 'last_30d') {
    return this.computer.executeWorkflow([
      { action: 'click', target: 'Reports', waitAfter: 2000 },
      { action: 'click', target: 'Sales', waitAfter: 2000 },
      { action: 'observe', description: 'Read sales data' }
    ]);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  SKILL 6: DATA ENTRY — Llenar formularios masivamente
// ═══════════════════════════════════════════════════════════════════

export class DataEntrySkill extends UniversalSkill {
  constructor(opts = {}) {
    super({ ...opts, name: 'Data Entry' });
  }

  /**
   * Llenar formulario web con datos de CSV/JSON
   */
  async fillFormFromData(formUrl, data, fieldMapping) {
    const results = [];

    for (const row of data) {
      await this.browser.goto({ url: formUrl, wait: 3000 });

      const steps = [];
      for (const [formField, dataKey] of Object.entries(fieldMapping)) {
        if (row[dataKey]) {
          steps.push({
            action: 'type',
            target: formField,
            text: String(row[dataKey]),
            clear: true
          });
        }
      }
      steps.push({ action: 'click', target: 'Submit', waitAfter: 2000 });
      steps.push({ action: 'verify', expected: 'success' });

      const result = await this.computer.executeWorkflow(steps);
      results.push({ data: row, ok: result.ok });

      await this._sleep(1000); // Rate limiting
    }

    return {
      ok: true,
      total: data.length,
      success: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
      results
    };
  }
}

// ═══════════════════════════════════════════════════════════════════
//  SKILL 7: SYSADMIN — Servidores, Docker, Kubernetes, monitoring
// ═══════════════════════════════════════════════════════════════════

export class SysAdminSkill extends UniversalSkill {
  constructor(opts = {}) {
    super({ ...opts, name: 'SysAdmin' });
  }

  async serverHealth(host) {
    const checks = [
      { name: 'Uptime', cmd: 'uptime' },
      { name: 'Disk Usage', cmd: 'df -h /' },
      { name: 'Memory', cmd: 'free -h' },
      { name: 'CPU Load', cmd: 'cat /proc/loadavg' },
      { name: 'Top Processes', cmd: 'ps aux --sort=-%mem | head -6' },
      { name: 'Network', cmd: 'ss -tulnp | head -20' }
    ];

    const results = {};
    for (const check of checks) {
      const prefix = host ? `ssh ${host} ` : '';
      const r = await this.terminal.exec(`${prefix}${check.cmd}`);
      results[check.name] = r.ok ? r.stdout : r.error;
    }

    return { ok: true, host: host || 'localhost', results };
  }

  async dockerOps(action, container) {
    const commands = {
      list: 'docker ps -a',
      start: `docker start ${container}`,
      stop: `docker stop ${container}`,
      restart: `docker restart ${container}`,
      logs: `docker logs --tail 50 ${container}`,
      stats: 'docker stats --no-stream',
      prune: 'docker system prune -f'
    };
    return this.terminal.exec(commands[action] || `echo "Unknown: ${action}"`);
  }

  async kubernetesOps(action, opts = {}) {
    const commands = {
      pods: 'kubectl get pods -A',
      services: 'kubectl get svc -A',
      deployments: 'kubectl get deployments -A',
      nodes: 'kubectl get nodes',
      events: 'kubectl get events --sort-by=.lastTimestamp | tail -20',
      logs: `kubectl logs ${opts.pod} -n ${opts.namespace || 'default'} --tail 50`,
      restart: `kubectl rollout restart deployment/${opts.deployment} -n ${opts.namespace || 'default'}`
    };
    return this.terminal.exec(commands[action] || `echo "Unknown: ${action}"`);
  }

  async setupSSL(domain) {
    return this.terminal.exec(`certbot --nginx -d ${domain} --non-interactive --agree-tos`);
  }

  async backupDatabase(dbType, dbName, outputPath) {
    const commands = {
      postgres: `pg_dump ${dbName} > ${outputPath}`,
      mysql: `mysqldump ${dbName} > ${outputPath}`,
      mongodb: `mongodump --db ${dbName} --out ${outputPath}`,
      sqlite: `cp ${dbName} ${outputPath}`
    };
    return this.terminal.exec(commands[dbType] || `echo "Unknown DB: ${dbType}"`);
  }
}

// ═══════════════════════════════════════════════════════════════════
//  SKILL 8: SOCIAL MEDIA — Twitter/X, LinkedIn, Instagram
// ═══════════════════════════════════════════════════════════════════

export class SocialMediaSkill extends UniversalSkill {
  constructor(opts = {}) {
    super({ ...opts, name: 'Social Media' });
  }

  async postToTwitter(text, media = []) {
    return this.computer.executeWorkflow([
      { action: 'goto', url: 'https://x.com/compose/tweet', wait: 3000 },
      { action: 'type', target: '[data-testid="tweetTextarea_0"]', text, waitAfter: 1000 },
      { action: 'click', target: 'Post', waitAfter: 3000 },
      { action: 'verify', expected: 'posted' }
    ]);
  }

  async postToLinkedIn(text) {
    return this.computer.executeWorkflow([
      { action: 'goto', url: 'https://www.linkedin.com/feed/', wait: 3000 },
      { action: 'click', target: 'Start a post', waitAfter: 2000 },
      { action: 'type', target: 'What do you want to talk about', text },
      { action: 'click', target: 'Post', waitAfter: 3000 },
      { action: 'verify', expected: 'posted' }
    ]);
  }

  async scrapeProfile(platform, username) {
    const urls = {
      twitter: `https://x.com/${username}`,
      linkedin: `https://www.linkedin.com/in/${username}`,
      instagram: `https://www.instagram.com/${username}`
    };

    await this.browser.goto({ url: urls[platform], wait: 3000 });
    const content = await this.browser.getContent({ text: true });
    return { ok: true, platform, username, content: content.content };
  }
}

// ═══════════════════════════════════════════════════════════════════
//  SKILL 9: FINANCE — Trading, banking, accounting
// ═══════════════════════════════════════════════════════════════════

export class FinanceSkill extends UniversalSkill {
  constructor(opts = {}) {
    super({ ...opts, name: 'Finance' });
  }

  async getStockPrice(symbol) {
    await this.browser.goto({ url: `https://finance.yahoo.com/quote/${symbol}`, wait: 3000 });
    const data = await this.browser.page.evaluate(() => {
      const price = document.querySelector('[data-testid="qsp-price"]')?.textContent;
      const change = document.querySelector('[data-testid="qsp-price-change"]')?.textContent;
      const name = document.querySelector('h1')?.textContent;
      return { price, change, name };
    });
    return { ok: true, symbol, ...data };
  }

  async getCryptoPrice(coin = 'bitcoin') {
    const r = await this.fs.httpGet(`https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=usd,eur`);
    return r;
  }

  async getExchangeRate(from = 'USD', to = 'COP') {
    const r = await this.fs.httpGet(`https://open.er-api.com/v6/latest/${from}`);
    if (r.ok) {
      const data = JSON.parse(r.data);
      return { ok: true, from, to, rate: data.rates?.[to], updated: data.time_last_update_utc };
    }
    return r;
  }
}

// ═══════════════════════════════════════════════════════════════════
//  SKILL 10: QA TESTING — Testear cualquier aplicación web
// ═══════════════════════════════════════════════════════════════════

export class QATestingSkill extends UniversalSkill {
  constructor(opts = {}) {
    super({ ...opts, name: 'QA Testing' });
    this.testResults = [];
  }

  async runTestSuite(url, tests) {
    const results = [];

    for (const test of tests) {
      const start = Date.now();
      try {
        const result = await this.computer.executeWorkflow(test.steps);
        results.push({
          name: test.name,
          ok: result.ok,
          duration: Date.now() - start,
          steps: result.completed,
          error: result.ok ? null : 'Workflow failed'
        });
      } catch (e) {
        results.push({ name: test.name, ok: false, duration: Date.now() - start, error: e.message });
      }
    }

    return {
      ok: true,
      url,
      total: tests.length,
      passed: results.filter(r => r.ok).length,
      failed: results.filter(r => !r.ok).length,
      results
    };
  }

  async checkBrokenLinks(url) {
    await this.browser.goto({ url, wait: 3000 });
    const links = await this.browser.page.evaluate(() =>
      [...document.querySelectorAll('a')].map(a => a.href).filter(Boolean)
    );

    const broken = [];
    for (const link of links.slice(0, 50)) {
      try {
        const r = await this.fs.httpGet(link);
        if (!r.ok || r.status >= 400) {
          broken.push({ url: link, status: r.status });
        }
      } catch { broken.push({ url: link, status: 'error' }); }
    }

    return { ok: true, total: links.length, broken, brokenCount: broken.length };
  }

  async performanceAudit(url) {
    await this.browser.goto({ url, wait: 1000 });
    const metrics = await this.browser.page.evaluate(() => {
      const perf = performance.getEntriesByType('navigation')[0];
      return {
        domContentLoaded: Math.round(perf.domContentLoadedEventEnd),
        load: Math.round(perf.loadEventEnd),
        ttfb: Math.round(perf.responseStart),
        dns: Math.round(perf.domainLookupEnd - perf.domainLookupStart),
        tcp: Math.round(perf.connectEnd - perf.connectStart),
        transfer: Math.round(perf.transferSize / 1024) + 'KB'
      };
    });
    return { ok: true, url, metrics };
  }
}

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  HOW TO CREATE YOUR OWN SKILL IN 5 MINUTES                 ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║                                                              ║
 * ║  1. Extiende UniversalSkill                                  ║
 * ║  2. Define tus métodos usando:                               ║
 * ║     - this.computer.executeWorkflow() → Navegar UIs          ║
 * ║     - this.terminal.exec()            → Ejecutar comandos    ║
 * ║     - this.browser.goto/click/type()  → Controlar browser    ║
 * ║     - this.fs.readFile/httpGet()      → Archivos y APIs      ║
 * ║  3. ¡Listo! Operator Pro hace el resto                       ║
 * ║                                                              ║
 * ║  Ejemplo mínimo:                                             ║
 * ║                                                              ║
 * ║  class MySkill extends UniversalSkill {                      ║
 * ║    async doSomething() {                                     ║
 * ║      return this.computer.executeWorkflow([                  ║
 * ║        { action: 'goto', url: 'https://...' },               ║
 * ║        { action: 'click', target: 'Button' },                ║
 * ║        { action: 'type', target: 'Field', text: 'Data' },    ║
 * ║        { action: 'verify', expected: 'Success' }             ║
 * ║      ]);                                                     ║
 * ║    }                                                         ║
 * ║  }                                                           ║
 * ║                                                              ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

export default UniversalSkill;

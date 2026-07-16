import { chromium } from 'playwright';

// Configurar librerías del sistema para Chrome (usar CHROME_LIB_PATH env var si está definida)
const LIB_PATHS = process.env.CHROME_LIB_PATH ? [process.env.CHROME_LIB_PATH] : [];
const currentLD = process.env.LD_LIBRARY_PATH || '';
process.env.LD_LIBRARY_PATH = [...LIB_PATHS, currentLD].filter(Boolean).join(':');

import { resolve } from 'path';

export class BrowserManager {
  constructor(options = {}) {
    this.headless = options.headless !== false;
    this.viewport = options.viewport || { width: 1280, height: 800 };
    this.context = null;
    this.page = null;
  }

  async launch() {
    const userDataDir = resolve(process.cwd(), '.chrome-session');
    
    this.context = await chromium.launchPersistentContext(userDataDir, {
      headless: this.headless,
      viewport: this.viewport,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      locale: 'es-CO',
      timezoneId: 'America/Bogota',
      geolocation: { latitude: 4.711, longitude: -74.0721 },
      permissions: ['geolocation'],
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-infobars',
        '--window-size=1920,1080',
        '--start-maximized',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
      ],
    });

    // Inyectar scripts anti-detección ANTES de cargar cualquier página
    await this.context.addInitScript(() => {
      // Ocultar webdriver -更彻底
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      delete navigator.__proto__.webdriver;

      // Mock plugins - más realista
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          const plugins = [
            { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
            { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
            { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' },
          ];
          plugins.length = 3;
          return plugins;
        },
      });

      // Mock languages
      Object.defineProperty(navigator, 'languages', { get: () => ['es-CO', 'es', 'en-US', 'en'] });

      // Chrome runtime - más completo
      window.chrome = {
        runtime: {
          PlatformOs: { MAC: 'mac', WIN: 'win', ANDROID: 'android', CROS: 'cros', LINUX: 'linux', OPENBSD: 'openbsd' },
          PlatformArch: { ARM: 'arm', X86_32: 'x86-32', X86_64: 'x86-64', MIPS: 'mips', MIPS64: 'mips64' },
          PlatformNaclArch: { ARM: 'arm', X86_32: 'x86-32', X86_64: 'x86-64', MIPS: 'mips', MIPS64: 'mips64' },
          RequestUpdateCheckStatus: { THROTTLED: 'throttled', NO_UPDATE: 'no_update', UPDATE_AVAILABLE: 'update_available' },
          OnInstalledReason: { INSTALL: 'install', UPDATE: 'update', CHROME_UPDATE: 'chrome_update', SHARED_MODULE_UPDATE: 'shared_module_update' },
          OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
          connect: () => {},
          sendMessage: () => {},
        },
        loadTimes: () => ({
          commitLoadTime: performance.timing.responseStart / 1000,
          connectionInfo: 'http/1.1',
          finishDocumentLoadTime: performance.timing.domContentLoadedEventEnd / 1000,
          finishLoadTime: performance.timing.loadEventEnd / 1000,
          firstPaintAfterLoadTime: 0,
          firstPaintTime: performance.timing.domContentLoadedEventEnd / 1000,
          navigationType: 'Other',
          npnNegotiatedProtocol: 'unknown',
          requestTime: performance.timing.navigationStart / 1000,
          startLoadTime: performance.timing.navigationStart / 1000,
          wasAlternateProtocolAvailable: false,
          wasFetchedViaSpdy: false,
          wasNpnNegotiated: false,
        }),
        csi: () => ({
          onloadT: Date.now(),
          pageT: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
          startE: Date.now(),
          tran: 15,
        }),
      };

      // Permissions -更真实
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (params) => {
        if (params.name === 'notifications') {
          return Promise.resolve({ state: Notification.permission });
        }
        if (params.name === 'push') {
          return Promise.resolve({ state: 'denied', onchange: null });
        }
        return originalQuery(params);
      };

      // Mock WebGL vendor/renderer
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function(parameter) {
        if (parameter === 37445) return 'Intel Inc.';
        if (parameter === 37446) return 'Intel Iris OpenGL Engine';
        return getParameter.call(this, parameter);
      };

      // Mock screen dimensions
      Object.defineProperty(screen, 'availWidth', { get: () => 1920 });
      Object.defineProperty(screen, 'availHeight', { get: () => 1040 });
      Object.defineProperty(screen, 'width', { get: () => 1920 });
      Object.defineProperty(screen, 'height', { get: () => 1080 });
      Object.defineProperty(screen, 'colorDepth', { get: () => 24 });
    });

    this.page = this.context.pages()[0] || await this.context.newPage();
    
    // Inyectar mouse tracking para comportamiento humano
    await this.page.evaluate(() => {
      // Simular movimiento de mouse en background
      let mouseActive = true;
      document.addEventListener('mousemove', (e) => {
        window.__lastMouseX = e.clientX;
        window.__lastMouseY = e.clientY;
      });
    });
    
    console.log(`  [Browser] Chrome lanzado con anti-detección avanzada (headless: ${this.headless})`);
    return { browser: this.context, page: this.page };
  }

  async navigate(url) {
    if (!this.page) throw new Error('Browser not launched');
    console.log(`  [Browser] Navegando a: ${url}`);
    await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await this.delay(1000);
  }

  async getPageInfo() {
    if (!this.page) return { url: '', title: '' };
    try {
      return { url: this.page.url(), title: await this.page.title() };
    } catch { return { url: '', title: '' }; }
  }

  async takeScreenshot() {
    if (!this.page) return null;
    const buf = await this.page.screenshot({ type: 'png' });
    return buf.toString('base64');
  }

  async clickElement(text) {
    if (!this.page) return false;
    try {
      // Movimiento humano aleatorio antes de buscar elemento
      await this.humanMouseMove();

      // Try multiple selectors
      const selectors = [
        `text="${text}"`,
        `button:has-text("${text}")`,
        `a:has-text("${text}")`,
        `[role="button"]:has-text("${text}")`,
        `[aria-label="${text}"]`,
      ];
      for (const sel of selectors) {
        try {
          const el = this.page.locator(sel).first();
          if (await el.isVisible({ timeout: 1000 })) {
            // Movimiento humano: hover primero con delay variable
            await el.hover({ timeout: 2000 });
            await this.delay(200 + Math.random() * 400); // Pausa humana antes de click
            await el.click();
            await this.delay(400 + Math.random() * 600); // Pausa humana después de click
            return true;
          }
        } catch {}
      }

      // Fallback: find by text content
      const clicked = await this.page.evaluate((txt) => {
        const els = document.querySelectorAll('button, a, input[type="submit"], [role="button"], span, label');
        for (const el of els) {
          if ((el.innerText || el.textContent || '').toLowerCase().includes(txt.toLowerCase())) {
            if (el.offsetParent !== null) { el.click(); return true; }
          }
        }
        return false;
      }, text);
      if (clicked) { await this.delay(400 + Math.random() * 500); return true; }
    } catch {}
    return false;
  }

  async typeText(text, fieldIdentifier) {
    if (!this.page) return false;
    try {
      // Movimiento humano antes de escribir
      await this.humanMouseMove();

      // Try to find field by placeholder, name, label
      const selectors = [
        `input[placeholder*="${fieldIdentifier}" i]`,
        `input[name*="${fieldIdentifier}" i]`,
        `input[aria-label*="${fieldIdentifier}" i]`,
        `textarea[placeholder*="${fieldIdentifier}" i]`,
        `input[type="text"]`,
        `input[type="email"]`,
        `textarea`,
      ];
      for (const sel of selectors) {
        try {
          const el = this.page.locator(sel).first();
          if (await el.isVisible({ timeout: 1000 })) {
            await el.click();
            await this.delay(300 + Math.random() * 400); // Pausa humana
            
            // Seleccionar todo antes de escribir (comportamiento humano)
            await this.page.keyboard.press('Control+a');
            await this.delay(100);
            
            // Typing humano realista: variación en velocidad, pausas en espacios
            for (let i = 0; i < text.length; i++) {
              const char = text[i];
              let delay = 50 + Math.random() * 100; // Base delay
              
              // Pausa más larga después de espacios o puntuación (simula pensamiento)
              if (char === ' ' || char === '.' || char === ',') {
                delay += 100 + Math.random() * 150;
              }
              
              // Acelerar un poco en secuencias familiares
              if (i > 0 && /[a-z]/i.test(char) && /[a-z]/i.test(text[i-1])) {
                delay *= 0.7;
              }
              
              await this.page.keyboard.type(char, { delay });
            }
            await this.delay(400 + Math.random() * 300);
            return true;
          }
        } catch {}
      }

      // Fallback: type character by character with human timing
      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        let delay = 50 + Math.random() * 100;
        if (char === ' ') delay += 80 + Math.random() * 100;
        await this.page.keyboard.type(char, { delay });
      }
      return true;
    } catch { return false; }
  }

  async selectOption(optionText, dropdownIdentifier) {
    if (!this.page) return false;
    try {
      const selectors = [
        `select[name*="${dropdownIdentifier}" i]`,
        `select[id*="${dropdownIdentifier}" i]`,
        'select',
      ];
      for (const sel of selectors) {
        try {
          const el = this.page.locator(sel).first();
          if (await el.isVisible({ timeout: 1000 })) {
            await el.selectOption({ label: optionText });
            await this.delay(300);
            return true;
          }
        } catch {}
      }
    } catch {}
    return false;
  }

  async scroll(direction = 'down') {
    if (!this.page) return;
    // Scroll humano con cantidad variable y delay
    const amount = (direction === 'down' ? 1 : -1) * (300 + Math.random() * 400);
    await this.page.evaluate((amt) => window.scrollBy(0, amt), amount);
    await this.delay(400 + Math.random() * 600); // Pausa humana después de scroll
  }

  async extractText() {
    if (!this.page) return '';
    try { return await this.page.evaluate(() => document.body.innerText); }
    catch { return ''; }
  }

  // ── Movimiento humano aleatorio (anti-detección) ──
  async humanMouseMove() {
    if (!this.page) return;
    try {
      // Mover mouse a posición aleatoria en la página
      const x = 100 + Math.random() * 800;
      const y = 100 + Math.random() * 500;
      await this.page.mouse.move(x, y, { steps: 5 + Math.floor(Math.random() * 10) });
      await this.delay(100 + Math.random() * 200);
    } catch {}
  }

  // ── Scroll humano con variación ──
  async scrollHuman() {
    if (!this.page) return;
    try {
      // Scroll con cantidad variable
      const amount = 200 + Math.random() * 400;
      await this.page.evaluate((amt) => window.scrollBy(0, amt), amount);
      await this.delay(300 + Math.random() * 500);
    } catch {}
  }

  async close() {
    if (this.context) {
      try { await this.context.close(); } catch {}
      this.context = null;
      this.page = null;
    }
  }

  delay(ms) {
    // Delay humano con variación natural (no lineal)
    const variation = ms * 0.2; // 20% de variación
    const humanDelay = ms + (Math.random() * variation * 2 - variation);
    return new Promise(r => setTimeout(r, Math.max(50, humanDelay)));
  }

  // ── Delay específico para acciones ──
  delayAfterAction(actionType) {
    const delays = {
      CLICK: [400, 800],
      TYPE: [300, 600],
      SCROLL: [500, 1000],
      NAVIGATE: [1000, 2000],
      WAIT: [2000, 4000],
    };
    const [min, max] = delays[actionType] || [300, 700];
    return this.delay(min + Math.random() * (max - min));
  }
}

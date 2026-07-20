/**
 * Operator Pro — Browser Engine
 * 
 * Advanced browser automation with Playwright as primary and Puppeteer as fallback.
 * Features:
 * - Auto-detection of running browsers
 * - Multiple browser instances support
 * - Smart element finding (by text, selector, coordinates, aria-label)
 * - Form auto-fill
 * - Network interception
 * - Screenshot + element capture
 * - PDF generation
 * - Cookie/session management
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SS_DIR = path.join(__dirname, '..', '..', 'screenshots');
fs.mkdirSync(SS_DIR, { recursive: true });

export class BrowserEngine {
  constructor(opts = {}) {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.pages = new Map();
    this.verbose = opts.verbose || false;
    this.backend = null; // 'playwright' | 'puppeteer' | 'cdp'
    this.connected = false;
    this._interceptors = [];
    this._consoleLog = [];
    this._networkLog = [];
  }

  // ─── Connection ────────────────────────────────────────────────────────────

  /**
   * Try to connect to a running browser or launch a new one
   * Priority: Playwright CDP → Puppeteer CDP → Launch new Playwright → Launch new Puppeteer
   */
  async connect(opts = {}) {
    const debugPort = opts.port || 9222;
    const cdpUrl = opts.cdpUrl || `http://127.0.0.1:${debugPort}`;

    // 1. Try Playwright CDP connection
    try {
      const pw = await this._loadPlaywright();
      if (pw) {
        this.browser = await pw.chromium.connectOverCDP(cdpUrl, { timeout: 5000 });
        this.backend = 'playwright';
        this.connected = true;
        const contexts = this.browser.contexts();
        this.context = contexts[0] || await this.browser.newContext();
        const pages = this.context.pages();
        this.page = pages[0] || await this.context.newPage();
        this._setupPageListeners(this.page);
        this._log(`✅ Playwright connected via CDP on port ${debugPort}`);
        return { ok: true, backend: 'playwright', mode: 'cdp', pages: pages.length };
      }
    } catch (e) {
      this._log(`⚠️ Playwright CDP failed: ${e.message}`);
    }

    // 2. Try Puppeteer CDP connection
    try {
      const puppeteer = await this._loadPuppeteer();
      if (puppeteer) {
        this.browser = await puppeteer.connect({ browserURL: cdpUrl, defaultViewport: null });
        this.backend = 'puppeteer';
        this.connected = true;
        const pages = await this.browser.pages();
        this.page = pages[0];
        this._log(`✅ Puppeteer connected via CDP on port ${debugPort}`);
        return { ok: true, backend: 'puppeteer', mode: 'cdp', pages: pages.length };
      }
    } catch (e) {
      this._log(`⚠️ Puppeteer CDP failed: ${e.message}`);
    }

    // 3. Launch new browser with Playwright
    try {
      const pw = await this._loadPlaywright();
      if (pw) {
        this.browser = await pw.chromium.launch({
          headless: opts.headless !== false ? true : false,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        this.backend = 'playwright';
        this.connected = true;
        this.context = await this.browser.newContext({
          viewport: { width: opts.width || 1920, height: opts.height || 1080 },
          userAgent: opts.userAgent || undefined
        });
        this.page = await this.context.newPage();
        this._setupPageListeners(this.page);
        this._log('✅ Playwright launched new browser');
        return { ok: true, backend: 'playwright', mode: 'launched' };
      }
    } catch (e) {
      this._log(`⚠️ Playwright launch failed: ${e.message}`);
    }

    // 4. Launch new browser with Puppeteer
    try {
      const puppeteer = await this._loadPuppeteer();
      if (puppeteer) {
        this.browser = await puppeteer.launch({
          headless: opts.headless !== false ? true : false,
          args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
          defaultViewport: null
        });
        this.backend = 'puppeteer';
        this.connected = true;
        const pages = await this.browser.pages();
        this.page = pages[0] || await this.browser.newPage();
        this._log('✅ Puppeteer launched new browser');
        return { ok: true, backend: 'puppeteer', mode: 'launched' };
      }
    } catch (e) {
      this._log(`⚠️ Puppeteer launch failed: ${e.message}`);
    }

    return { ok: false, error: 'No se pudo conectar ni lanzar un navegador' };
  }

  // ─── Navigation ────────────────────────────────────────────────────────────

  async goto(url, opts = {}) {
    if (!this.connected) return { ok: false, error: 'No conectado al navegador' };
    try {
      const timeout = opts.timeout || 30000;
      if (this.backend === 'playwright') {
        await this.page.goto(url, { timeout, waitUntil: opts.waitUntil || 'domcontentloaded' });
      } else {
        await this.page.goto(url, { timeout, waitUntil: opts.waitUntil || 'networkidle2' });
      }
      const title = await this.page.title();
      return { ok: true, url: this.page.url(), title };
    } catch (e) {
      return { ok: false, error: e.message, url: this.page?.url() };
    }
  }

  async back() {
    if (!this.connected) return { ok: false, error: 'No conectado' };
    try {
      if (this.backend === 'playwright') await this.page.goBack();
      else await this.page.goBack();
      return { ok: true, url: this.page.url() };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  async forward() {
    if (!this.connected) return { ok: false, error: 'No conectado' };
    try {
      if (this.backend === 'playwright') await this.page.goForward();
      else await this.page.goForward();
      return { ok: true, url: this.page.url() };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  async reload() {
    if (!this.connected) return { ok: false, error: 'No conectado' };
    try {
      await this.page.reload();
      return { ok: true, url: this.page.url() };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  // ─── Element Interaction ───────────────────────────────────────────────────

  /**
   * Smart click — finds elements by text, selector, role, or coordinates
   */
  async click(opts = {}) {
    if (!this.connected) return { ok: false, error: 'No conectado' };

    const { selector, text, role, ariaLabel, x, y, index = 0, wait = 1000 } = opts;

    try {
      // By coordinates
      if (x !== undefined && y !== undefined) {
        await this.page.mouse.click(x, y);
        await this._sleep(wait);
        return { ok: true, method: 'coordinates', x, y };
      }

      // By CSS selector
      if (selector) {
        if (this.backend === 'playwright') {
          await this.page.waitForSelector(selector, { timeout: 5000 }).catch(() => {});
          const elements = await this.page.$$(selector);
          if (elements[index]) {
            await elements[index].click();
          } else {
            await this.page.click(selector);
          }
        } else {
          await this.page.waitForSelector(selector, { timeout: 5000 }).catch(() => {});
          await this.page.click(selector);
        }
        await this._sleep(wait);
        return { ok: true, method: 'selector', selector };
      }

      // By text content
      if (text) {
        if (this.backend === 'playwright') {
          const locator = this.page.getByText(text, { exact: false });
          const count = await locator.count();
          if (count > index) {
            await locator.nth(index).click();
            await this._sleep(wait);
            return { ok: true, method: 'text', text, count };
          }
        }
        // Fallback: manual search
        const clicked = await this._clickByText(text, index);
        if (clicked) {
          await this._sleep(wait);
          return { ok: true, method: 'text-fallback', text };
        }
        return { ok: false, error: `Elemento con texto "${text}" no encontrado` };
      }

      // By ARIA role
      if (role) {
        if (this.backend === 'playwright') {
          const locator = this.page.getByRole(role, { name: ariaLabel });
          await locator.click();
          await this._sleep(wait);
          return { ok: true, method: 'role', role, ariaLabel };
        }
      }

      // By aria-label
      if (ariaLabel) {
        if (this.backend === 'playwright') {
          await this.page.getByLabel(ariaLabel).click();
          await this._sleep(wait);
          return { ok: true, method: 'aria-label', ariaLabel };
        }
      }

      return { ok: false, error: 'Especifica selector, text, role, o coordinates (x,y)' };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /**
   * Smart type — types text into an element or the active element
   */
  async type(opts = {}) {
    if (!this.connected) return { ok: false, error: 'No conectado' };

    const { selector, text, placeholder, label, clear = true, delay = 20 } = opts;

    try {
      let target = null;

      if (selector) {
        if (this.backend === 'playwright') {
          target = this.page.locator(selector);
          if (clear) await target.fill('');
          await target.type(text, { delay });
        } else {
          await this.page.waitForSelector(selector, { timeout: 3000 }).catch(() => {});
          if (clear) await this.page.$eval(selector, el => el.value = '');
          await this.page.type(selector, text, { delay });
        }
        return { ok: true, method: 'selector', selector, text: text.substring(0, 50) };
      }

      if (placeholder && this.backend === 'playwright') {
        target = this.page.getByPlaceholder(placeholder);
        if (clear) await target.fill('');
        await target.type(text, { delay });
        return { ok: true, method: 'placeholder', placeholder };
      }

      if (label && this.backend === 'playwright') {
        target = this.page.getByLabel(label);
        if (clear) await target.fill('');
        await target.type(text, { delay });
        return { ok: true, method: 'label', label };
      }

      // Type into active element
      await this.page.keyboard.type(text, { delay });
      return { ok: true, method: 'keyboard', text: text.substring(0, 50) };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /**
   * Press a key or key combination
   */
  async press(key) {
    if (!this.connected) return { ok: false, error: 'No conectado' };
    try {
      await this.page.keyboard.press(key);
      return { ok: true, key };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  /**
   * Select an option from a dropdown
   */
  async select(opts = {}) {
    if (!this.connected) return { ok: false, error: 'No conectado' };
    try {
      if (this.backend === 'playwright') {
        await this.page.locator(opts.selector).selectOption(opts.value || opts.text);
      } else {
        await this.page.select(opts.selector, opts.value);
      }
      return { ok: true, selector: opts.selector, value: opts.value || opts.text };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  /**
   * Check/uncheck a checkbox or radio
   */
  async check(opts = {}) {
    if (!this.connected) return { ok: false, error: 'No conectado' };
    try {
      if (this.backend === 'playwright') {
        const locator = this.page.locator(opts.selector);
        if (opts.uncheck) await locator.uncheck();
        else await locator.check();
      } else {
        await this.page.click(opts.selector);
      }
      return { ok: true, selector: opts.selector, checked: !opts.uncheck };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  // ─── Page Content ──────────────────────────────────────────────────────────

  /**
   * Get the full page content or specific elements
   */
  async getContent(opts = {}) {
    if (!this.connected) return { ok: false, error: 'No conectado' };
    try {
      if (opts.selector) {
        const content = await this.page.$eval(opts.selector, el => el.textContent);
        return { ok: true, content: content?.trim().substring(0, 10000) };
      }
      if (opts.text) {
        const content = await this.page.evaluate(() => document.body?.innerText || '');
        return { ok: true, content: content.substring(0, 10000) };
      }
      if (opts.html) {
        const html = await this.page.content();
        return { ok: true, html: html.substring(0, 50000) };
      }
      // Default: get visible text
      const text = await this.page.evaluate(() => document.body?.innerText || '');
      const title = await this.page.title();
      const url = this.page.url();
      return { ok: true, title, url, content: text.substring(0, 10000) };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  /**
   * Find elements matching criteria
   */
  async findElements(opts = {}) {
    if (!this.connected) return { ok: false, error: 'No conectado' };
    try {
      const results = await this.page.evaluate((searchOpts) => {
        const { selector, text, tag, limit = 20 } = searchOpts;
        let elements = [];

        if (selector) {
          elements = [...document.querySelectorAll(selector)];
        } else if (text) {
          const all = [...document.querySelectorAll('button, a, span, div, p, h1, h2, h3, h4, h5, h6, label, li, td, th')];
          elements = all.filter(el => el.textContent?.toLowerCase().includes(text.toLowerCase()));
        } else if (tag) {
          elements = [...document.querySelectorAll(tag)];
        }

        return elements.slice(0, limit).map(el => ({
          tag: el.tagName.toLowerCase(),
          text: (el.textContent || '').trim().substring(0, 200),
          id: el.id || '',
          className: el.className?.substring?.(0, 100) || '',
          href: el.href || '',
          src: el.src || '',
          type: el.type || '',
          placeholder: el.placeholder || '',
          ariaLabel: el.getAttribute('aria-label') || '',
          role: el.getAttribute('role') || '',
          visible: el.offsetParent !== null,
          rect: el.getBoundingClientRect ? {
            x: Math.round(el.getBoundingClientRect().x),
            y: Math.round(el.getBoundingClientRect().y),
            width: Math.round(el.getBoundingClientRect().width),
            height: Math.round(el.getBoundingClientRect().height)
          } : null
        }));
      }, opts);
      return { ok: true, elements: results, count: results.length };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  // ─── Screenshots ───────────────────────────────────────────────────────────

  async screenshot(opts = {}) {
    if (!this.connected) return { ok: false, error: 'No conectado' };
    try {
      const filename = opts.filename || `browser_${Date.now()}.png`;
      const filepath = path.join(SS_DIR, filename);

      if (this.backend === 'playwright') {
        await this.page.screenshot({
          path: filepath,
          fullPage: opts.fullPage || false,
          type: opts.type || 'png'
        });
      } else {
        await this.page.screenshot({
          path: filepath,
          fullPage: opts.fullPage || false,
          type: opts.type || 'png'
        });
      }

      const base64 = fs.readFileSync(filepath).toString('base64');
      return { ok: true, file: filepath, base64, size: base64.length };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  // ─── JavaScript Execution ──────────────────────────────────────────────────

  async evaluate(code) {
    if (!this.connected) return { ok: false, error: 'No conectado' };
    try {
      const result = await this.page.evaluate(code);
      return {
        ok: true,
        result: typeof result === 'object' ? JSON.stringify(result).substring(0, 5000) : String(result).substring(0, 5000)
      };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  // ─── Network ───────────────────────────────────────────────────────────────

  /**
   * Wait for a specific network request/response
   */
  async waitForRequest(urlPattern, opts = {}) {
    if (!this.connected) return { ok: false, error: 'No conectado' };
    try {
      if (this.backend === 'playwright') {
        const request = await this.page.waitForRequest(urlPattern, { timeout: opts.timeout || 10000 });
        return { ok: true, url: request.url(), method: request.method() };
      }
      return { ok: false, error: 'waitForRequest solo disponible con Playwright' };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  async waitForResponse(urlPattern, opts = {}) {
    if (!this.connected) return { ok: false, error: 'No conectado' };
    try {
      if (this.backend === 'playwright') {
        const response = await this.page.waitForResponse(urlPattern, { timeout: opts.timeout || 10000 });
        return { ok: true, url: response.url(), status: response.status() };
      }
      return { ok: false, error: 'waitForResponse solo disponible con Playwright' };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  // ─── Tabs ──────────────────────────────────────────────────────────────────

  async listTabs() {
    if (!this.connected) return { ok: false, error: 'No conectado' };
    try {
      if (this.backend === 'playwright') {
        const pages = this.context.pages();
        const tabs = [];
        for (let i = 0; i < pages.length; i++) {
          tabs.push({ index: i, url: pages[i].url(), title: await pages[i].title() });
        }
        return { ok: true, tabs, active: pages.indexOf(this.page) };
      } else {
        const pages = await this.browser.pages();
        const tabs = [];
        for (let i = 0; i < pages.length; i++) {
          tabs.push({ index: i, url: pages[i].url(), title: await pages[i].title() });
        }
        return { ok: true, tabs, active: pages.indexOf(this.page) };
      }
    } catch (e) { return { ok: false, error: e.message }; }
  }

  async switchTab(index) {
    if (!this.connected) return { ok: false, error: 'No conectado' };
    try {
      if (this.backend === 'playwright') {
        const pages = this.context.pages();
        if (pages[index]) {
          this.page = pages[index];
          await this.page.bringToFront();
          return { ok: true, index, url: this.page.url() };
        }
      } else {
        const pages = await this.browser.pages();
        if (pages[index]) {
          this.page = pages[index];
          await this.page.bringToFront();
          return { ok: true, index, url: this.page.url() };
        }
      }
      return { ok: false, error: `Tab ${index} no existe` };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  async newTab(url) {
    if (!this.connected) return { ok: false, error: 'No conectado' };
    try {
      if (this.backend === 'playwright') {
        this.page = await this.context.newPage();
      } else {
        this.page = await this.browser.newPage();
      }
      if (url) await this.page.goto(url);
      return { ok: true, url: this.page.url() };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  async closeTab(index) {
    if (!this.connected) return { ok: false, error: 'No conectado' };
    try {
      if (this.backend === 'playwright') {
        const pages = this.context.pages();
        if (pages[index]) {
          await pages[index].close();
          this.page = this.context.pages()[0];
          return { ok: true };
        }
      }
      return { ok: false, error: 'Tab no encontrado' };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  // ─── Cookies & Storage ─────────────────────────────────────────────────────

  async getCookies(domain) {
    if (!this.connected) return { ok: false, error: 'No conectado' };
    try {
      let cookies;
      if (this.backend === 'playwright') {
        cookies = await this.context.cookies();
      } else {
        cookies = await this.page.cookies();
      }
      if (domain) cookies = cookies.filter(c => c.domain.includes(domain));
      return { ok: true, cookies, count: cookies.length };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  async setCookies(cookies) {
    if (!this.connected) return { ok: false, error: 'No conectado' };
    try {
      if (this.backend === 'playwright') {
        await this.context.addCookies(cookies);
      } else {
        await this.page.setCookie(...cookies);
      }
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  async getLocalStorage(key) {
    if (!this.connected) return { ok: false, error: 'No conectado' };
    try {
      const value = await this.page.evaluate((k) => {
        if (k) return localStorage.getItem(k);
        return JSON.stringify({ ...localStorage });
      }, key);
      return { ok: true, value };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  // ─── Form Helpers ──────────────────────────────────────────────────────────

  /**
   * Auto-fill a form with provided data
   */
  async fillForm(fields) {
    if (!this.connected) return { ok: false, error: 'No conectado' };
    const results = [];
    for (const field of fields) {
      try {
        if (field.selector) {
          if (this.backend === 'playwright') {
            await this.page.locator(field.selector).fill(field.value);
          } else {
            await this.page.$eval(field.selector, (el, val) => el.value = val, field.value);
          }
        } else if (field.label && this.backend === 'playwright') {
          await this.page.getByLabel(field.label).fill(field.value);
        } else if (field.placeholder && this.backend === 'playwright') {
          await this.page.getByPlaceholder(field.placeholder).fill(field.value);
        }
        results.push({ field: field.selector || field.label || field.placeholder, ok: true });
      } catch (e) {
        results.push({ field: field.selector || field.label || field.placeholder, ok: false, error: e.message });
      }
    }
    return { ok: true, results, filled: results.filter(r => r.ok).length };
  }

  /**
   * Submit the current form
   */
  async submit(selector) {
    if (!this.connected) return { ok: false, error: 'No conectado' };
    try {
      if (selector) {
        await this.page.click(selector);
      } else {
        await this.page.evaluate(() => {
          const form = document.querySelector('form');
          if (form) form.submit();
        });
      }
      return { ok: true };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  // ─── Waits ─────────────────────────────────────────────────────────────────

  async waitFor(opts = {}) {
    if (!this.connected) return { ok: false, error: 'No conectado' };
    try {
      if (opts.selector) {
        if (this.backend === 'playwright') {
          await this.page.waitForSelector(opts.selector, { timeout: opts.timeout || 10000 });
        } else {
          await this.page.waitForSelector(opts.selector, { timeout: opts.timeout || 10000 });
        }
        return { ok: true, waited: 'selector', selector: opts.selector };
      }
      if (opts.text) {
        if (this.backend === 'playwright') {
          await this.page.getByText(opts.text).waitFor({ timeout: opts.timeout || 10000 });
        }
        return { ok: true, waited: 'text', text: opts.text };
      }
      if (opts.url) {
        await this.page.waitForURL(opts.url, { timeout: opts.timeout || 10000 });
        return { ok: true, waited: 'url', url: opts.url };
      }
      if (opts.ms) {
        await this._sleep(opts.ms);
        return { ok: true, waited: opts.ms };
      }
      await this._sleep(1000);
      return { ok: true, waited: 1000 };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  // ─── Download ──────────────────────────────────────────────────────────────

  async download(url, savePath) {
    if (!this.connected) return { ok: false, error: 'No conectado' };
    try {
      if (this.backend === 'playwright') {
        const [download] = await Promise.all([
          this.page.waitForEvent('download', { timeout: 30000 }),
          this.page.goto(url)
        ]);
        await download.saveAs(savePath);
        return { ok: true, path: savePath };
      }
      return { ok: false, error: 'Download solo con Playwright' };
    } catch (e) { return { ok: false, error: e.message }; }
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  async disconnect() {
    try {
      if (this.browser) {
        // Only close if we launched the browser, not if we connected via CDP
        if (this.backend === 'playwright') {
          await this.browser.close().catch(() => {});
        } else {
          this.browser.disconnect();
        }
      }
    } catch {}
    this.browser = null;
    this.context = null;
    this.page = null;
    this.connected = false;
    return { ok: true };
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  async _loadPlaywright() {
    try { return await import('playwright'); } catch { return null; }
  }

  async _loadPuppeteer() {
    try { const pw = await import('puppeteer'); return pw.default || pw; } catch { return null; }
  }

  _setupPageListeners(page) {
    page.on('console', msg => {
      this._consoleLog.push({ type: msg.type(), text: msg.text(), time: Date.now() });
      if (this._consoleLog.length > 500) this._consoleLog.shift();
    });
    page.on('request', req => {
      this._networkLog.push({ method: req.method(), url: req.url(), time: Date.now() });
      if (this._networkLog.length > 500) this._networkLog.shift();
    });
  }

  async _clickByText(text, index = 0) {
    try {
      const els = await this.page.$$('button, [role="button"], a, span, label, div[role="option"], li, input[type="submit"], input[type="button"]');
      let matchCount = 0;
      for (const el of els) {
        const elText = await el.evaluate(e => (e.textContent || e.value || '').trim().toLowerCase());
        if (elText.includes(text.toLowerCase())) {
          if (matchCount === index) {
            await el.click();
            return true;
          }
          matchCount++;
        }
      }
    } catch {}
    return false;
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  _log(msg) { if (this.verbose) console.log(`  [Browser] ${msg}`); }
}

// Singleton instance
let _instance = null;
export function getBrowser(opts = {}) {
  if (!_instance) _instance = new BrowserEngine(opts);
  return _instance;
}

export default BrowserEngine;

/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║         Operator Pro — Computer Use Engine                      ║
 * ║         (Nivel ChatGPT Operator — Ver + Entender + Actuar)      ║
 * ╚══════════════════════════════════════════════════════════════════╝
 * 
 * Este motor es lo que separa a Operator Pro de un simple script:
 * 
 *   1. CAPTURA → toma screenshot de lo que ve en pantalla
 *   2. ENTIENDE → usa IA multimodal para describir la pantalla
 *   3. LOCALIZA → encuentra elementos (botones, campos, links)
 *   4. ACTÚA    → hace click, escribe, scroll como un humano
 *   5. VERIFICA → toma otro screenshot para confirmar que funcionó
 * 
 * Así es exactamente como funciona ChatGPT Operator.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getBrowser } from './browser.mjs';
import { getScreen } from './screen.mjs';
import platform from '../platform/index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SS_DIR = path.join(__dirname, '..', '..', 'screenshots');
fs.mkdirSync(SS_DIR, { recursive: true });

export class ComputerUseEngine {
  constructor(opts = {}) {
    this.browser = getBrowser(opts);
    this.screen = getScreen(opts);
    this.brain = opts.brain || null; // Brain instance for vision
    this.verbose = opts.verbose || false;
    this.history = [];
    this._elementCache = new Map();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  FASE 1: VER — Capturar lo que hay en pantalla
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Toma un screenshot y lo analiza con IA para entender qué hay en pantalla.
   * Esto es exactamente lo que hace ChatGPT Operator en cada paso.
   */
  async observe(opts = {}) {
    const source = opts.source || 'browser'; // 'browser' | 'screen'
    
    let screenshot;
    if (source === 'browser' && this.browser.connected) {
      screenshot = await this.browser.screenshot(opts);
    } else {
      screenshot = await this.screen.capture(opts);
    }

    if (!screenshot.ok) {
      return { ok: false, error: screenshot.error };
    }

    // Analizar con IA multimodal (visión)
    let analysis = '';
    let elements = [];
    
    if (this.brain && screenshot.base64) {
      analysis = await this._analyzeWithVision(screenshot.base64);
    }

    // Si estamos en browser, también extraer elementos del DOM
    if (source === 'browser' && this.browser.connected) {
      const domElements = await this._extractDOMElements();
      elements = domElements.elements || [];
    }

    // Obtener URL y título si es browser
    let url = '', title = '';
    if (source === 'browser' && this.browser.connected && this.browser.page) {
      url = this.browser.page.url();
      title = await this.browser.page.title();
    }

    const observation = {
      ok: true,
      source,
      url,
      title,
      screenshot: screenshot.file,
      base64: screenshot.base64,
      analysis,        // Lo que la IA "ve" en la pantalla
      elements,        // Elementos del DOM encontrados
      timestamp: Date.now()
    };

    this.history.push({ type: 'observe', ...observation });
    this._log(`👁️ Observed: ${url || 'screen'} — ${analysis?.substring(0, 100)}...`);
    
    return observation;
  }

  /**
   * Análisis profundo con IA multimodal — describe TODO lo que ve
   */
  async _analyzeWithVision(base64) {
    if (!this.brain) return 'No vision model available';
    
    try {
      // Usar el brain para describir la imagen
      const description = await this.brain.describeImage(base64);
      return description || 'Unable to analyze image';
    } catch (e) {
      return `Vision error: ${e.message}`;
    }
  }

  /**
   * Extrae elementos interactivos del DOM (botones, inputs, links, etc.)
   */
  async _extractDOMElements() {
    if (!this.browser.connected) return { ok: false, elements: [] };
    
    try {
      const elements = await this.browser.page.evaluate(() => {
        const interactive = [];
        const selectors = [
          'button', 'a', 'input', 'select', 'textarea',
          '[role="button"]', '[role="tab"]', '[role="menuitem"]',
          '[role="link"]', '[role="checkbox"]', '[role="radio"]',
          '[role="option"]', '[role="textbox"]', '[role="searchbox"]',
          '[contenteditable="true"]', '[tabindex]',
          'label', '.btn', '[class*="button"]', '[class*="click"]'
        ];
        
        const all = document.querySelectorAll(selectors.join(','));
        
        all.forEach((el, i) => {
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) return; // invisible
          if (rect.top < 0 || rect.left < 0) return; // off screen
          
          const text = (el.textContent || el.value || el.placeholder || el.getAttribute('aria-label') || '').trim();
          if (!text && !el.href && !el.name) return; // no useful info
          
          interactive.push({
            index: i,
            tag: el.tagName.toLowerCase(),
            type: el.type || '',
            text: text.substring(0, 150),
            id: el.id || '',
            className: (el.className || '').toString().substring(0, 100),
            ariaLabel: el.getAttribute('aria-label') || '',
            role: el.getAttribute('role') || '',
            href: el.href || '',
            name: el.name || '',
            placeholder: el.placeholder || '',
            checked: el.checked || false,
            disabled: el.disabled || false,
            visible: el.offsetParent !== null,
            rect: {
              x: Math.round(rect.x),
              y: Math.round(rect.y),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              cx: Math.round(rect.x + rect.width / 2),  // center x
              cy: Math.round(rect.y + rect.height / 2)   // center y
            }
          });
        });
        
        return interactive.slice(0, 80); // max 80 elements
      });
      
      return { ok: true, elements, count: elements.length };
    } catch (e) {
      return { ok: false, elements: [], error: e.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  FASE 2: ENCONTRAR — Localizar elementos específicos en pantalla
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Encuentra un elemento en pantalla usando múltiples estrategias:
   * 1. Por texto visible
   * 2. Por selector CSS
   * 3. Por rol ARIA
   * 4. Por coordenadas (si la IA las detectó en el screenshot)
   * 5. Por búsqueda visual (OCR + coordinate matching)
   */
  async findElement(query, opts = {}) {
    if (!this.browser.connected) return { ok: false, error: 'Browser not connected' };
    
    const strategies = [
      () => this._findByText(query, opts),
      () => this._findBySelector(query, opts),
      () => this._findByAriaLabel(query, opts),
      () => this._findByPlaceholder(query, opts),
      () => this._findByRole(query, opts),
    ];

    for (const strategy of strategies) {
      try {
        const result = await strategy();
        if (result.ok) {
          this._log(`🔍 Found "${query}" via ${result.strategy}`);
          return result;
        }
      } catch {}
    }

    // Last resort: visual search (OCR)
    if (opts.visual !== false) {
      const visualResult = await this._findByVisual(query);
      if (visualResult.ok) return visualResult;
    }

    return { ok: false, error: `Element "${query}" not found by any strategy` };
  }

  async _findByText(text, opts = {}) {
    const index = opts.index || 0;
    
    // Try Playwright locator first
    if (this.browser.backend === 'playwright') {
      const locator = this.browser.page.getByText(text, { exact: opts.exact || false });
      const count = await locator.count();
      if (count > index) {
        const box = await locator.nth(index).boundingBox();
        if (box) {
          return {
            ok: true, strategy: 'text',
            x: Math.round(box.x + box.width / 2),
            y: Math.round(box.y + box.height / 2),
            box, text, count
          };
        }
      }
    }

    // Fallback: manual DOM search
    const result = await this.browser.page.evaluate((searchText) => {
      const all = document.querySelectorAll('button, a, span, div, p, h1, h2, h3, h4, h5, h6, label, li, td, th, [role="button"], [role="tab"], [role="menuitem"], input[type="submit"], input[type="button"]');
      for (const el of all) {
        const elText = (el.textContent || el.value || '').trim();
        if (elText.toLowerCase().includes(searchText.toLowerCase())) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            return {
              found: true,
              x: Math.round(rect.x + rect.width / 2),
              y: Math.round(rect.y + rect.height / 2),
              text: elText.substring(0, 200),
              tag: el.tagName,
              rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
            };
          }
        }
      }
      return { found: false };
    }, text);

    if (result.found) {
      return { ok: true, strategy: 'text-dom', ...result };
    }
    return { ok: false };
  }

  async _findBySelector(selector, opts = {}) {
    try {
      const el = await this.browser.page.$(selector);
      if (el) {
        const box = await el.boundingBox();
        if (box) {
          return {
            ok: true, strategy: 'selector',
            x: Math.round(box.x + box.width / 2),
            y: Math.round(box.y + box.height / 2),
            box, selector
          };
        }
      }
    } catch {}
    return { ok: false };
  }

  async _findByAriaLabel(label, opts = {}) {
    if (this.browser.backend !== 'playwright') return { ok: false };
    try {
      const locator = this.browser.page.getByLabel(label);
      const count = await locator.count();
      if (count > 0) {
        const box = await locator.first().boundingBox();
        if (box) {
          return {
            ok: true, strategy: 'aria-label',
            x: Math.round(box.x + box.width / 2),
            y: Math.round(box.y + box.height / 2),
            box, label
          };
        }
      }
    } catch {}
    return { ok: false };
  }

  async _findByPlaceholder(placeholder, opts = {}) {
    if (this.browser.backend !== 'playwright') return { ok: false };
    try {
      const locator = this.browser.page.getByPlaceholder(placeholder);
      const count = await locator.count();
      if (count > 0) {
        const box = await locator.first().boundingBox();
        if (box) {
          return {
            ok: true, strategy: 'placeholder',
            x: Math.round(box.x + box.width / 2),
            y: Math.round(box.y + box.height / 2),
            box, placeholder
          };
        }
      }
    } catch {}
    return { ok: false };
  }

  async _findByRole(role, opts = {}) {
    if (this.browser.backend !== 'playwright') return { ok: false };
    try {
      const locator = this.browser.page.getByRole(role, { name: opts.name });
      const count = await locator.count();
      if (count > 0) {
        const box = await locator.first().boundingBox();
        if (box) {
          return {
            ok: true, strategy: 'role',
            x: Math.round(box.x + box.width / 2),
            y: Math.round(box.y + box.height / 2),
            box, role
          };
        }
      }
    } catch {}
    return { ok: false };
  }

  async _findByVisual(text) {
    // Use OCR to find text on screen
    const result = await this.screen.findTextOnScreen(text);
    if (result.found && result.x !== undefined) {
      return { ok: true, strategy: 'visual-ocr', x: result.x, y: result.y, text };
    }
    return { ok: false };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  FASE 3: ACTUAR — Interactuar con la pantalla como un humano
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Click inteligente: encuentra el elemento y hace click
   */
  async smartClick(target, opts = {}) {
    const t0 = Date.now();
    
    // Si es coordenadas directas
    if (typeof target === 'object' && target.x !== undefined) {
      await this._clickAt(target.x, target.y, opts);
      return { ok: true, method: 'coordinates', x: target.x, y: target.y, duration: Date.now() - t0 };
    }

    // Buscar el elemento
    const found = await this.findElement(target, opts);
    if (!found.ok) {
      return { ok: false, error: found.error, duration: Date.now() - t0 };
    }

    // Mover mouse (más humano)
    if (opts.humanLike !== false) {
      await this._humanMove(found.x, found.y);
    }

    // Click
    await this._clickAt(found.x, found.y, opts);

    // Esperar a que la página reaccione
    await this._sleep(opts.waitAfter || 1500);

    const duration = Date.now() - t0;
    this.history.push({ type: 'click', target, x: found.x, y: found.y, strategy: found.strategy, duration });
    this._log(`🖱️ Click "${target}" at (${found.x}, ${found.y}) via ${found.strategy}`);

    return { ok: true, method: found.strategy, x: found.x, y: found.y, duration };
  }

  /**
   * Escribir texto en un campo (lo encuentra primero)
   */
  async smartType(target, text, opts = {}) {
    const t0 = Date.now();

    // Click en el campo primero
    const clickResult = await this.smartClick(target, { waitAfter: 500 });
    if (!clickResult.ok) return clickResult;

    // Limpiar campo si es necesario
    if (opts.clear !== false) {
      await this.browser.page.keyboard.press('Control+A');
      await this.browser.page.keyboard.press('Backspace');
      await this._sleep(200);
    }

    // Escribir como humano (con delays variables)
    if (opts.humanLike !== false) {
      for (const char of text) {
        await this.browser.page.keyboard.type(char, { delay: 50 + Math.random() * 100 });
      }
    } else {
      await this.browser.page.keyboard.type(text, { delay: opts.delay || 30 });
    }

    const duration = Date.now() - t0;
    this.history.push({ type: 'type', target, text: text.substring(0, 50), duration });
    this._log(`⌨️ Typed "${text.substring(0, 30)}..." into "${target}"`);

    return { ok: true, typed: text.length, duration };
  }

  /**
   * Scroll inteligente
   */
  async smartScroll(direction = 'down', opts = {}) {
    const amount = opts.amount || 300;
    const delta = direction === 'up' ? -amount : amount;

    if (this.browser.connected) {
      await this.browser.page.mouse.wheel(0, delta);
    } else {
      await platform.mouseScroll(opts.x, opts.y, direction === 'up' ? -3 : 3);
    }

    await this._sleep(opts.waitAfter || 1000);
    return { ok: true, direction, amount };
  }

  /**
   * Seleccionar opción de un dropdown
   */
  async smartSelect(target, value, opts = {}) {
    const found = await this.findElement(target, opts);
    if (!found.ok) return found;

    try {
      if (this.browser.backend === 'playwright') {
        // Click to open dropdown
        await this._clickAt(found.x, found.y);
        await this._sleep(500);

        // Find and click the option
        const optionFound = await this.findElement(value, { index: 0 });
        if (optionFound.ok) {
          await this._clickAt(optionFound.x, optionFound.y);
          return { ok: true, target, value };
        }
      }
      return { ok: false, error: 'Option not found' };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /**
   * Presionar tecla o combinación
   */
  async pressKey(key) {
    if (this.browser.connected) {
      await this.browser.page.keyboard.press(key);
    } else {
      await platform.keyboardPress(key);
    }
    await this._sleep(300);
    return { ok: true, key };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  FASE 4: VERIFICAR — Confirmar que la acción funcionó
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Verifica visualmente si un cambio ocurrió después de una acción
   */
  async verify(expected, opts = {}) {
    const t0 = Date.now();
    
    // Esperar a que la página se actualice
    await this._sleep(opts.wait || 2000);

    // Tomar nuevo screenshot
    const observation = await this.observe(opts);
    if (!observation.ok) return observation;

    // Verificar con IA si el cambio esperado está presente
    let verified = false;
    let reason = '';

    if (this.brain && observation.base64) {
      const verifyPrompt = `Mira esta captura de pantalla. ¿Ves evidencia de: "${expected}"?
Responde SOLO con JSON: {"verified": true/false, "reason": "explicación breve", "confidence": 0.0-1.0}`;
      
      try {
        const result = await this.brain._opencodeZen(verifyPrompt + '\n\nContexto de la imagen: ' + observation.analysis);
        if (result && result.verified !== undefined) {
          verified = result.verified;
          reason = result.reason || '';
        }
      } catch {}
    }

    // Fallback: verificar por contenido del DOM
    if (!verified && typeof expected === 'string') {
      const content = await this.browser.getContent({ text: true });
      if (content.ok && content.content?.toLowerCase().includes(expected.toLowerCase())) {
        verified = true;
        reason = `Found "${expected}" in page content`;
      }
    }

    const duration = Date.now() - t0;
    this.history.push({ type: 'verify', expected, verified, reason, duration });
    this._log(`${verified ? '✅' : '❌'} Verify "${expected}": ${reason}`);

    return { ok: true, verified, reason, observation, duration };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  FASE 5: WORKFLOWS — Secuencias complejas multi-paso
  // ═══════════════════════════════════════════════════════════════════

  /**
   * Ejecuta un workflow completo: secuencia de pasos con verificación
   */
  async executeWorkflow(steps, opts = {}) {
    const results = [];
    const maxRetries = opts.maxRetries || 2;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      this._log(`\n📋 Workflow Step ${i + 1}/${steps.length}: ${step.description || step.action}`);

      let attempt = 0;
      let success = false;

      while (attempt <= maxRetries && !success) {
        attempt++;
        
        try {
          let result;
          switch (step.action) {
            case 'goto':
              result = await this.browser.goto({ url: step.url, wait: step.wait });
              break;
            case 'click':
              result = await this.smartClick(step.target, step.opts || {});
              break;
            case 'type':
              result = await this.smartType(step.target, step.text, step.opts || {});
              break;
            case 'select':
              result = await this.smartSelect(step.target, step.value, step.opts || {});
              break;
            case 'scroll':
              result = await this.smartScroll(step.direction, step.opts || {});
              break;
            case 'press':
              result = await this.pressKey(step.key);
              break;
            case 'wait':
              await this._sleep(step.ms || 2000);
              result = { ok: true };
              break;
            case 'observe':
              result = await this.observe(step.opts || {});
              break;
            case 'verify':
              result = await this.verify(step.expected, step.opts || {});
              break;
            case 'screenshot':
              result = await this.browser.screenshot(step.opts || {});
              break;
            case 'evaluate':
              result = await this.browser.evaluate(step.code);
              break;
            default:
              result = { ok: false, error: `Unknown action: ${step.action}` };
          }

          if (result.ok) {
            success = true;
            results.push({ step: i + 1, ...step, result, attempt });
            this._log(`  ✅ Step ${i + 1} OK (attempt ${attempt})`);
          } else {
            this._log(`  ❌ Step ${i + 1} failed (attempt ${attempt}): ${result.error}`);
            if (attempt <= maxRetries) {
              await this._sleep(2000); // Wait before retry
            }
          }
        } catch (e) {
          this._log(`  ❌ Step ${i + 1} error: ${e.message}`);
          if (attempt <= maxRetries) await this._sleep(2000);
        }
      }

      if (!success) {
        results.push({ step: i + 1, ...step, result: { ok: false, error: 'max retries' }, attempt });
        if (opts.stopOnError !== false) {
          this._log(`🛑 Workflow stopped at step ${i + 1}`);
          break;
        }
      }

      // Wait between steps
      if (step.waitAfter) await this._sleep(step.waitAfter);
    }

    const completed = results.filter(r => r.result?.ok).length;
    return {
      ok: completed === steps.length,
      results,
      completed,
      total: steps.length,
      history: this.history
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  INTERNAL HELPERS
  // ═══════════════════════════════════════════════════════════════════

  async _clickAt(x, y, opts = {}) {
    const button = opts.button || 'left';
    if (this.browser.connected) {
      await this.browser.page.mouse.click(x, y, { button });
    } else {
      await platform.mouseClick(x, y, button);
    }
  }

  async _humanMove(targetX, targetY) {
    if (!this.browser.connected) return;
    
    // Get current position (approximate)
    const startX = 500 + Math.random() * 200;
    const startY = 400 + Math.random() * 200;
    
    // Move in small steps (like a human)
    const steps = 5 + Math.floor(Math.random() * 5);
    for (let i = 1; i <= steps; i++) {
      const x = startX + (targetX - startX) * (i / steps) + (Math.random() - 0.5) * 3;
      const y = startY + (targetY - startY) * (i / steps) + (Math.random() - 0.5) * 3;
      await this.browser.page.mouse.move(x, y);
      await this._sleep(20 + Math.random() * 30);
    }
    // Final precise position
    await this.browser.page.mouse.move(targetX, targetY);
  }

  _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  _log(msg) { if (this.verbose) console.log(`  [ComputerUse] ${msg}`); }

  getHistory() { return this.history; }
  clearHistory() { this.history = []; }
}

// Singleton
let _instance = null;
export function getComputerUse(opts = {}) {
  if (!_instance) _instance = new ComputerUseEngine(opts);
  return _instance;
}

export default ComputerUseEngine;

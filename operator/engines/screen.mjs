/**
 * Operator Pro — Screen Engine
 * 
 * Cross-platform screen capture and analysis:
 * - Screenshot with quality/scale options
 * - Region capture
 * - Active window capture
 * - OCR integration (Tesseract)
 * - Image processing with Sharp
 * - Multi-monitor support
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import platform from '../platform/index.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SS_DIR = path.join(__dirname, '..', '..', 'screenshots');
fs.mkdirSync(SS_DIR, { recursive: true });

export class ScreenEngine {
  constructor(opts = {}) {
    this.verbose = opts.verbose || false;
    this._sharp = null;
    this._tesseract = null;
    this.sharpLoaded = false;
  }

  // ─── Screenshot ────────────────────────────────────────────────────────────

  /**
   * Capture the full screen
   */
  async capture(opts = {}) {
    const filename = opts.filename || `ss_${Date.now()}.png`;
    const filepath = opts.path || path.join(SS_DIR, filename);
    const quality = opts.quality || 100;
    const scale = opts.scale || 1;

    try {
      // Use platform-specific screenshot method
      const result = await platform.screenshot(filepath);
      if (!result.ok && result.error) {
        return { ok: false, error: result.error || result.stderr };
      }

      // Process image if Sharp is available
      if (quality < 100 || scale < 1) {
        const processed = await this._processImage(filepath, { quality, scale });
        if (processed.ok) {
          const base64 = fs.readFileSync(processed.path).toString('base64');
          const res = await platform.getScreenResolution();
          return {
            ok: true, file: processed.path, base64,
            size: base64.length, width: processed.width, height: processed.height,
            originalSize: processed.originalSize
          };
        }
      }

      const base64 = fs.readFileSync(filepath).toString('base64');
      const res = await platform.getScreenResolution();
      return {
        ok: true, file: filepath, base64,
        size: base64.length, width: res.width, height: res.height
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /**
   * Capture a specific region of the screen
   */
  async captureRegion(x, y, width, height, opts = {}) {
    // First capture full screen
    const full = await this.capture(opts);
    if (!full.ok) return full;

    // Then crop with Sharp
    const sharp = await this._loadSharp();
    if (!sharp) return { ok: false, error: 'Sharp no disponible para crop — usa captura completa' };

    try {
      const filename = `region_${Date.now()}.png`;
      const filepath = path.join(SS_DIR, filename);

      await sharp(full.file)
        .extract({ left: x, top: y, width, height })
        .toFile(filepath);

      const base64 = fs.readFileSync(filepath).toString('base64');
      return { ok: true, file: filepath, base64, size: base64.length, width, height, region: { x, y, width, height } };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /**
   * Capture active window
   */
  async captureWindow(opts = {}) {
    const filename = opts.filename || `window_${Date.now()}.png`;
    const filepath = path.join(SS_DIR, filename);

    if (platform.os === 'darwin') {
      const r = await platform.exec(`screencapture -l $(osascript -e 'tell application "System Events" to get id of front window') "${filepath}"`);
      if (r.ok) {
        const base64 = fs.readFileSync(filepath).toString('base64');
        return { ok: true, file: filepath, base64, size: base64.length };
      }
    }

    // Fallback to full screen capture
    return this.capture({ ...opts, filename });
  }

  // ─── OCR ───────────────────────────────────────────────────────────────────

  /**
   * Extract text from a screenshot using OCR
   */
  async ocr(imagePath, opts = {}) {
    const lang = opts.lang || 'eng+spa';

    // Try Tesseract
    const tesseract = await this._loadTesseract();
    if (tesseract) {
      try {
        const { data } = await tesseract.recognize(imagePath, lang);
        return {
          ok: true, text: data.text, confidence: data.confidence,
          words: data.words?.map(w => ({ text: w.text, confidence: w.confidence, bbox: w.bbox })) || []
        };
      } catch (e) {
        this._log(`Tesseract failed: ${e.message}`);
      }
    }

    // Try system tesseract command
    const sysResult = await platform.exec(`tesseract "${imagePath}" stdout -l ${lang} 2>/dev/null`);
    if (sysResult.ok && sysResult.stdout) {
      return { ok: true, text: sysResult.stdout, confidence: null };
    }

    return { ok: false, error: 'OCR no disponible (instala tesseract o tesseract.js)' };
  }

  /**
   * Find text on screen and return its coordinates
   */
  async findTextOnScreen(text, opts = {}) {
    const screenshot = await this.capture(opts);
    if (!screenshot.ok) return screenshot;

    const ocr = await this.ocr(screenshot.file, opts);
    if (!ocr.ok) return ocr;

    const matches = [];
    const lines = ocr.text.split('\n');
    for (const line of lines) {
      if (line.toLowerCase().includes(text.toLowerCase())) {
        matches.push(line.trim());
      }
    }

    // If we have word-level data, find coordinates
    if (ocr.words) {
      const wordMatches = ocr.words.filter(w =>
        w.text.toLowerCase().includes(text.toLowerCase())
      );
      if (wordMatches.length > 0) {
        const bbox = wordMatches[0].bbox;
        return {
          ok: true, found: true, matches, text,
          x: Math.round(bbox.x0 + (bbox.x1 - bbox.x0) / 2),
          y: Math.round(bbox.y0 + (bbox.y1 - bbox.y0) / 2),
          bbox, wordCount: wordMatches.length
        };
      }
    }

    return {
      ok: true, found: matches.length > 0, matches, text,
      fullText: ocr.text.substring(0, 2000)
    };
  }

  // ─── Image Processing ──────────────────────────────────────────────────────

  async _processImage(filepath, opts = {}) {
    const sharp = await this._loadSharp();
    if (!sharp) return { ok: false, error: 'Sharp no disponible' };

    try {
      const metadata = await sharp(filepath).metadata();
      const targetWidth = opts.scale ? Math.round(metadata.width * opts.scale) : metadata.width;
      const targetHeight = opts.scale ? Math.round(metadata.height * opts.scale) : metadata.height;
      const quality = opts.quality || 80;

      const outPath = filepath.replace('.png', `_proc.png`);
      await sharp(filepath)
        .resize(targetWidth, targetHeight)
        .png({ quality })
        .toFile(outPath);

      return { ok: true, path: outPath, width: targetWidth, height: targetHeight, originalSize: metadata };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ─── Screen Info ───────────────────────────────────────────────────────────

  async getInfo() {
    const res = await platform.getScreenResolution();
    const displays = await platform.getDisplays();
    return {
      ok: true,
      resolution: res,
      displays,
      platform: platform.os
    };
  }

  /**
   * Get pixel color at coordinates
   */
  async getPixelColor(x, y) {
    const sharp = await this._loadSharp();
    if (!sharp) return { ok: false, error: 'Sharp no disponible' };

    const ss = await this.capture({ quality: 100, scale: 1 });
    if (!ss.ok) return ss;

    try {
      const { data } = await sharp(ss.file)
        .extract({ left: x, top: y, width: 1, height: 1 })
        .raw()
        .toBuffer({ resolveWithObject: true });

      return {
        ok: true, x, y,
        r: data[0], g: data[1], b: data[2], a: data[3],
        hex: `#${data[0].toString(16).padStart(2, '0')}${data[1].toString(16).padStart(2, '0')}${data[2].toString(16).padStart(2, '0')}`
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ─── Cleanup ───────────────────────────────────────────────────────────────

  cleanScreenshots(maxAge = 3600000) {
    try {
      const files = fs.readdirSync(SS_DIR);
      const now = Date.now();
      let removed = 0;
      for (const f of files) {
        const fp = path.join(SS_DIR, f);
        const stat = fs.statSync(fp);
        if (now - stat.mtimeMs > maxAge) {
          fs.unlinkSync(fp);
          removed++;
        }
      }
      return { ok: true, removed };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  // ─── Internal ──────────────────────────────────────────────────────────────

  async _loadSharp() {
    if (this._sharp) return this._sharp;
    try {
      this._sharp = (await import('sharp')).default;
      this.sharpLoaded = true;
      return this._sharp;
    } catch {
      return null;
    }
  }

  async _loadTesseract() {
    if (this._tesseract) return this._tesseract;
    try {
      this._tesseract = await import('tesseract.js');
      return this._tesseract;
    } catch {
      return null;
    }
  }

  _log(msg) { if (this.verbose) console.log(`  [Screen] ${msg}`); }
}

// Singleton
let _instance = null;
export function getScreen(opts = {}) {
  if (!_instance) _instance = new ScreenEngine(opts);
  return _instance;
}

export default ScreenEngine;

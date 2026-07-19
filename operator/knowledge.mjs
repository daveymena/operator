import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = path.join(__dirname, 'knowledge');
fs.mkdirSync(KNOWLEDGE_DIR, { recursive: true });

export class Knowledge {
  constructor() {
    this.sources = [];
    this.content = '';
    this.knowledgeFile = '';
  }

  async load(source) {
    if (!source) return '';
    if (fs.existsSync(source)) return await this._loadFile(source);
    if (source.startsWith('http://') || source.startsWith('https://')) return await this._loadUrl(source);
    return source;
  }

  async _loadFile(filepath) {
    const stat = fs.statSync(filepath);
    if (stat.isDirectory()) return await this._loadDir(filepath);
    const ext = path.extname(filepath).toLowerCase();
    const content = fs.readFileSync(filepath, 'utf8');
    const entry = { source: filepath, type: 'file', ext, size: content.length };
    this.sources.push(entry);
    this.content += `\n\n=== ${path.basename(filepath)} ===\n\n${content}`;
    return content;
  }

  async _loadDir(dirpath) {
    let combined = '';
    const files = fs.readdirSync(dirpath).filter(f => {
      const e = path.extname(f).toLowerCase();
      return ['.md', '.txt', '.mjs', '.js', '.py', '.json', '.yaml', '.yml', '.ps1', '.bat'].includes(e);
    });
    for (const file of files) {
      try { combined += await this._loadFile(path.join(dirpath, file)); }
      catch {}
    }
    return combined;
  }

  async _loadUrl(url) {
    try {
      const res = await fetch(url);
      const text = await res.text();
      this.sources.push({ source: url, type: 'url', size: text.length });
      this.content += `\n\n=== ${url} ===\n\n${text}`;
      return text;
    } catch (e) {
      return `Error cargando URL: ${e.message}`;
    }
  }

  async loadProjectDocs() {
    const base = path.resolve(__dirname, '..', 'docs');
    if (fs.existsSync(base)) await this._loadDir(base);
    const fbDocs = path.resolve(__dirname, '..', 'facebook-automation', 'docs');
    if (fs.existsSync(fbDocs)) await this._loadDir(fbDocs);
    const projDoc = path.resolve(__dirname, '..', 'README.md');
    if (fs.existsSync(projDoc)) await this._loadFile(projDoc);
    return this.content;
  }

  async loadOpenCodeTools() {
    const bridgeTools = path.resolve(__dirname, '..', 'bridge', 'opencode_bridge_tools.py');
    if (fs.existsSync(bridgeTools)) await this._loadFile(bridgeTools);
    return this.content;
  }

  saveKnowledge(name) {
    this.knowledgeFile = path.join(KNOWLEDGE_DIR, `${name || 'session'}_${Date.now()}.md`);
    fs.writeFileSync(this.knowledgeFile, this.content);
    return this.knowledgeFile;
  }

  getSummary(maxLen = 15000) {
    const lines = this.content.split('\n').filter(l => l.trim());
    let summary = lines.slice(0, 300).join('\n');
    if (summary.length > maxLen) summary = summary.substring(0, maxLen) + '\n...[truncado]';
    return summary;
  }

  getToolList() {
    return `HERRAMIENTAS DISPONIBLES (vía Bridge + OpenCode):

📸 CAPTURA: screenshot(quality, scale) - Captura la pantalla
🖱️ MOUSE: mouse_move(x, y), mouse_click(button), mouse_double_click(), mouse_scroll(clicks), drag_and_drop(x1,y1,x2,y2)
⌨️ TECLADO: keyboard_type(text), keyboard_press(key), keyboard_shortcut(modifiers, key)
📋 CLIPBOARD: get_clipboard(), set_clipboard(text)
💻 SISTEMA: sysinfo(), list_windows(), list_apps(), get_cursor(), focus_window(pid)
⚡ POWERSHELL: powershell(script) - Ejecuta cualquier script de PowerShell
📁 ARCHIVOS: read_file(path), write_file(path, content), list_dir(path), download_file(url, path)
🌐 WEB: open_url(url), open_file(path)
🔔 NOTIFICACIONES: notify(message, title)
⏱️ CONTROL: wait(ms)
🖼️ VISIÓN: screenshot + análisis de imagen con IA
📚 CONOCIMIENTO: load_docs(path) - Carga documentación de cualquier app
🧠 MEMORIA: Recuerda tareas anteriores y contexto
📊 FACEBOOK: facebook_create_campaign(name, objective, budget, status) - Crea campaña en Facebook Ads
📊 FACEBOOK: facebook_list_campaigns(adAccount) - Lista campañas existentes
📊 FACEBOOK: facebook_get_insights(campaignId) - Obtiene métricas de campañas`;
  }

  getSystemContext() {
    return `CONTEXTO DEL SISTEMA:
- PC: Windows
- Proyecto: ${path.resolve(__dirname, '..')}
- Bridge: WebSocket en ws://localhost:20100
- OpenCode Agent: PC Agent conectable
- Modelos IA: Groq (si API key configurada), Hermes (puerto 21294)
- Facebook: Business Manager 4482432028697067, Página VentasPro, Ad Account 1545022093928422
- Catálogo: 102 productos tecnológicos (laptops, monitores, periféricos, audio, impresoras)`;
  }
}

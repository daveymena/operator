/* ============================================================
   OpenCode Evolved — Shell JS v4
   • Modo oscuro forzado
   • Header de branding (no tapa nada)
   • 📎 Adjuntar archivos: imágenes, PDF, código, texto
     — se inyectan en el chat para que cualquier modelo los lea
   ============================================================ */
(function () {
  "use strict";

  // ── 1. Forzar modo oscuro ─────────────────────────────────
  function forceDark() {
    try { localStorage.setItem("opencode-color-scheme", "dark"); } catch {}
    document.documentElement.dataset.colorScheme = "dark";
    document.documentElement.style.colorScheme = "dark";
  }
  new MutationObserver(() => {
    if (document.documentElement.dataset.colorScheme !== "dark") forceDark();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["data-color-scheme"] });
  forceDark();

  // ── 2. Header de branding ─────────────────────────────────
  function injectHeader() {
    if (document.getElementById("oc-evolved-header")) return;
    const bar = document.createElement("div");
    bar.id = "oc-evolved-header";
    bar.innerHTML = `
      <div class="oc-logo">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M12 2L2 7L12 12L22 7Z" stroke="#8b5cf6" stroke-width="1.8" stroke-linejoin="round"/>
          <path d="M2 17L12 22L22 17" stroke="#8b5cf6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M2 12L12 17L22 12" stroke="#6d28d9" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <span>OpenCode</span>
        <span class="oc-badge">EVOLVED</span>
      </div>
      <div class="oc-dots">
        <div class="oc-dot green"  title="Motor IA activo"></div>
        <div class="oc-dot purple" title="MCP Tools activos"></div>
        <div class="oc-dot blue"   title="Visión + Archivos activos"></div>
      </div>

      <button id="oc-attach-btn" title="Adjuntar archivo al chat (imagen, PDF, código, texto)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
        </svg>
        <span>Adjuntar</span>
      </button>

      <div class="oc-status" id="oc-status-text">listo</div>
    `;
    document.body.prepend(bar);

    // El botón necesita pointer-events propios
    document.getElementById("oc-attach-btn").addEventListener("click", toggleAttachPanel);
  }

  // ── 3. Panel de adjuntar archivos ─────────────────────────
  function injectAttachPanel() {
    if (document.getElementById("oc-attach-panel")) return;

    const panel = document.createElement("div");
    panel.id = "oc-attach-panel";
    panel.innerHTML = `
      <div class="oc-panel-header">
        <div class="oc-panel-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
          </svg>
          <span>Adjuntar archivo al chat</span>
        </div>
        <button id="oc-panel-close">✕</button>
      </div>

      <div class="oc-panel-info">
        El archivo se convierte a texto → <strong>cualquier modelo</strong> puede leerlo
      </div>

      <div class="oc-file-types">
        <span class="oc-type-chip">🖼 Imágenes</span>
        <span class="oc-type-chip">📄 PDF</span>
        <span class="oc-type-chip">💻 Código</span>
        <span class="oc-type-chip">📝 Texto</span>
      </div>

      <div class="oc-drop-zone" id="oc-drop-zone">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="28" height="28">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
          <polyline points="17 8 12 3 7 8"/>
          <line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
        <p>Arrastra aquí o <label for="oc-file-input" class="oc-link">selecciona archivo</label></p>
        <p class="oc-hint">También puedes pegar imágenes con <kbd>Ctrl+V</kbd></p>
        <input type="file" id="oc-file-input"
          accept="image/*,.pdf,.txt,.md,.js,.ts,.jsx,.tsx,.py,.go,.rs,.java,.cpp,.c,.cs,.php,.rb,.sh,.json,.yaml,.yml,.toml,.xml,.html,.css,.sql"
          style="display:none">
      </div>

      <div id="oc-file-preview" style="display:none">
        <div id="oc-file-info"></div>
        <div id="oc-img-wrap" style="display:none">
          <img id="oc-preview-img" alt="preview">
        </div>
        <input id="oc-user-question" type="text"
          placeholder="¿Qué quieres preguntar sobre este archivo? (opcional)">
        <div id="oc-img-modes" style="display:none">
          <label class="oc-mode-opt">
            <input type="radio" name="oc-img-mode" value="describe" checked>
            <span>📝 Describir imagen</span>
          </label>
          <label class="oc-mode-opt">
            <input type="radio" name="oc-img-mode" value="code">
            <span>💻 Analizar código/error</span>
          </label>
          <label class="oc-mode-opt">
            <input type="radio" name="oc-img-mode" value="data">
            <span>📊 Extraer datos</span>
          </label>
        </div>
        <button id="oc-send-btn">
          📤 Enviar al chat
        </button>
      </div>

      <div id="oc-processing" style="display:none">
        <div class="oc-spinner"></div>
        <span id="oc-proc-text">Procesando archivo...</span>
      </div>

      <div id="oc-panel-status"></div>
    `;
    document.body.appendChild(panel);
    setupPanelEvents(panel);
  }

  let fileData = null; // { type: 'image'|'text', content, name, size, mime }

  function toggleAttachPanel() {
    const p = document.getElementById("oc-attach-panel");
    if (!p) { injectAttachPanel(); return; }
    p.classList.toggle("open");
  }

  function showStatus(msg, color = "#8b5cf6") {
    const el = document.getElementById("oc-status-text");
    if (el) { el.textContent = msg; el.style.color = color; }
    setTimeout(() => { if (el) { el.textContent = "listo"; el.style.color = ""; } }, 5000);
  }

  function setPanelStatus(msg, color = "#8b5cf6") {
    const el = document.getElementById("oc-panel-status");
    if (el) { el.textContent = msg; el.style.color = color; }
  }

  function setupPanelEvents(panel) {
    document.getElementById("oc-panel-close").onclick = () => panel.classList.remove("open");

    const dropZone = document.getElementById("oc-drop-zone");
    const fileInput = document.getElementById("oc-file-input");

    // Drag & drop
    dropZone.addEventListener("dragover",  e => { e.preventDefault(); dropZone.classList.add("drag-over"); });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("drag-over"));
    dropZone.addEventListener("drop", e => {
      e.preventDefault();
      dropZone.classList.remove("drag-over");
      handleFile(e.dataTransfer.files[0]);
    });
    fileInput.addEventListener("change", () => handleFile(fileInput.files[0]));

    // Paste global (Ctrl+V imágenes)
    document.addEventListener("paste", e => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            if (!panel.classList.contains("open")) panel.classList.add("open");
            handleFile(file);
            return;
          }
        }
      }
    });

    document.getElementById("oc-send-btn").onclick = handleSend;
  }

  function handleFile(file) {
    if (!file) return;

    const name = file.name || "archivo";
    const size = file.size;
    const mime = file.type || "text/plain";
    const isImage = mime.startsWith("image/");
    const isPDF   = mime === "application/pdf";

    const info = document.getElementById("oc-file-info");
    const imgWrap  = document.getElementById("oc-img-wrap");
    const imgModes = document.getElementById("oc-img-modes");
    const dropZone = document.getElementById("oc-drop-zone");
    const preview  = document.getElementById("oc-file-preview");

    if (isImage) {
      const reader = new FileReader();
      reader.onload = e => {
        fileData = { type: "image", content: e.target.result, name, size, mime };
        document.getElementById("oc-preview-img").src = e.target.result;
        imgWrap.style.display  = "block";
        imgModes.style.display = "flex";
        info.textContent = `🖼 ${name}  (${(size/1024).toFixed(1)} KB)`;
        dropZone.style.display = "none";
        preview.style.display  = "flex";
        setPanelStatus("✅ Imagen lista — elige modo y envía al chat");
      };
      reader.readAsDataURL(file);

    } else if (isPDF) {
      // PDF: leer como texto usando pdfjs si está disponible, sino informar
      readPDFAsText(file).then(text => {
        fileData = { type: "text", content: text, name, size, mime };
        imgWrap.style.display  = "none";
        imgModes.style.display = "none";
        info.textContent = `📄 ${name}  (${(size/1024).toFixed(1)} KB · ${text.split(/\s+/).length} palabras)`;
        dropZone.style.display = "none";
        preview.style.display  = "flex";
        setPanelStatus("✅ PDF leído — listo para enviar al chat");
      }).catch(() => {
        setPanelStatus("⚠️ No se pudo leer el PDF. Sube una captura de pantalla en su lugar.", "#f59e0b");
      });

    } else {
      // Texto / código / JSON / YAML / etc.
      const reader = new FileReader();
      reader.onload = e => {
        const text = e.target.result;
        fileData = { type: "text", content: text, name, size, mime };
        imgWrap.style.display  = "none";
        imgModes.style.display = "none";
        const lines = text.split("\n").length;
        info.textContent = `💻 ${name}  (${(size/1024).toFixed(1)} KB · ${lines} líneas)`;
        dropZone.style.display = "none";
        preview.style.display  = "flex";
        setPanelStatus("✅ Archivo listo — envíalo al chat");
      };
      reader.readAsText(file, "utf-8");
    }
  }

  async function readPDFAsText(file) {
    // Intento simple: leer bytes y extraer texto visible (sin pdfjs)
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const bin = e.target.result;
        // Extraer strings de texto del PDF binary
        const matches = bin.match(/\(([^\)]{2,300})\)/g);
        if (matches && matches.length > 0) {
          const text = matches
            .map(m => m.slice(1, -1).replace(/\\n/g,"\n").replace(/\\r/g,""))
            .filter(t => /[a-zA-Z\u00C0-\u024F]{3,}/.test(t))
            .join(" ");
          if (text.length > 100) resolve(text);
          else reject(new Error("PDF sin texto extraíble"));
        } else {
          reject(new Error("PDF binario sin texto"));
        }
      };
      reader.onerror = reject;
      reader.readAsBinaryString(file);
    });
  }

  async function handleSend() {
    if (!fileData) return;

    const question = document.getElementById("oc-user-question").value.trim();
    const panel = document.getElementById("oc-attach-panel");
    const preview = document.getElementById("oc-file-preview");
    const processing = document.getElementById("oc-processing");

    preview.style.display = "none";
    processing.style.display = "flex";

    try {
      if (fileData.type === "image") {
        await sendImageToChat(fileData, question);
      } else {
        sendTextToChat(fileData, question);
      }
      panel.classList.remove("open");
      resetPanel();
    } catch (err) {
      processing.style.display = "none";
      preview.style.display = "flex";
      setPanelStatus(`❌ Error: ${err.message}`, "#ef4444");
    }
  }

  async function sendImageToChat(data, question) {
    const modeEl = document.querySelector('input[name="oc-img-mode"]:checked');
    const mode   = modeEl?.value || "describe";
    const procText = document.getElementById("oc-proc-text");

    const questions = {
      describe: question || "Describe esta imagen en detalle completo en español. Incluye todo lo que ves: objetos, personas, texto, colores, disposición, cualquier detalle relevante.",
      code: question || "Analiza este código o error en español. Identifica: lenguaje, qué hace, errores y cómo corregirlos, posibles mejoras.",
      data: question || "Extrae y estructura todos los datos de esta imagen en español. Si hay tablas, convierte a texto estructurado. Si hay gráficos, describe valores y tendencias. Si hay texto, transcríbelo."
    };

    procText.textContent = mode === "code" ? "🔍 Analizando código/error..." :
                           mode === "data" ? "📊 Extrayendo datos..." :
                                            "👁 Procesando imagen con IA...";

    const base64 = data.content.includes(",") ? data.content.split(",")[1] : data.content;
    const response = await fetch("/__vision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64, mime: data.mime, question: questions[mode] })
    });

    const json = await response.json();
    if (json.error) throw new Error(json.error);

    const text = `[IMAGEN: ${data.name}]\n${json.description}\n[FIN DE IMAGEN]`;
    injectTextToChat(text);
    showStatus(`👁 Imagen analizada (${json.model})`, "#10b981");
  }

  function sendTextToChat(data, question) {
    document.getElementById("oc-proc-text").textContent = "📤 Enviando al chat...";

    const ext = data.name.split(".").pop()?.toLowerCase() || "txt";
    const MAX_CHARS = 12000;
    let content = data.content;
    let truncated = "";
    if (content.length > MAX_CHARS) {
      content = content.slice(0, MAX_CHARS);
      truncated = `\n... [archivo truncado — mostrando primeros ${MAX_CHARS} caracteres]`;
    }

    let block;
    const codeExts = ["js","ts","jsx","tsx","py","go","rs","java","cpp","c","cs","php","rb","sh","json","yaml","yml","toml","xml","html","css","sql","md"];
    if (codeExts.includes(ext)) {
      block = `[ARCHIVO: ${data.name}]\n\`\`\`${ext}\n${content}${truncated}\n\`\`\`\n[FIN DE ARCHIVO]`;
    } else {
      block = `[ARCHIVO: ${data.name}]\n${content}${truncated}\n[FIN DE ARCHIVO]`;
    }

    if (question) block = `${question}\n\n${block}`;

    injectTextToChat(block);
    showStatus(`📎 Archivo ${data.name} enviado al chat`, "#10b981");
  }

  function injectTextToChat(text) {
    const selectors = [
      'textarea[placeholder]',
      'div[contenteditable="true"]',
      'textarea',
    ];

    let input = null;
    for (const sel of selectors) {
      const candidates = document.querySelectorAll(sel);
      for (const el of candidates) {
        if (el.id !== "oc-user-question" && !el.closest("#oc-attach-panel")) {
          input = el;
          break;
        }
      }
      if (input) break;
    }

    const fullText = "\n" + text + "\n\n";

    if (input) {
      input.focus();
      if (input.tagName === "TEXTAREA") {
        const nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
        if (nativeSetter) {
          nativeSetter.call(input, (input.value || "") + fullText);
          input.dispatchEvent(new Event("input",  { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        } else {
          input.value += fullText;
        }
        input.selectionStart = input.selectionEnd = input.value.length;
        input.scrollTop = input.scrollHeight;
      } else if (input.contentEditable === "true") {
        input.textContent += fullText;
        input.dispatchEvent(new InputEvent("input", { bubbles: true, data: fullText }));
      }
    } else {
      navigator.clipboard?.writeText(fullText).then(() => {
        showStatus("📋 Copiado al portapapeles — pega con Ctrl+V en el chat", "#f59e0b");
      });
    }
  }

  function resetPanel() {
    fileData = null;
    const dropZone = document.getElementById("oc-drop-zone");
    const preview  = document.getElementById("oc-file-preview");
    const processing = document.getElementById("oc-processing");
    const fileInput  = document.getElementById("oc-file-input");
    const imgWrap    = document.getElementById("oc-img-wrap");
    const imgModes   = document.getElementById("oc-img-modes");
    if (dropZone)   dropZone.style.display   = "flex";
    if (preview)    preview.style.display    = "none";
    if (processing) processing.style.display = "none";
    if (fileInput)  fileInput.value = "";
    if (imgWrap)    imgWrap.style.display    = "none";
    if (imgModes)   imgModes.style.display   = "none";
    setPanelStatus("");
    document.getElementById("oc-user-question").value = "";
  }

  // ── Init ──────────────────────────────────────────────────
  function init() {
    forceDark();
    if (document.body) {
      injectHeader();
      injectAttachPanel();
    } else {
      document.addEventListener("DOMContentLoaded", () => {
        injectHeader();
        injectAttachPanel();
      });
    }
  }

  init();
  window.addEventListener("load", () => { forceDark(); injectHeader(); injectAttachPanel(); });

})();

// ─── Live Vision System ──────────────────────────────────────────
// Captura pantalla en tiempo real y la analiza con IA
(function() {
  "use strict";

  let isStreaming = false;
  let streamInterval = null;
  let lastAnalysis = "";
  let captureFPS = 1; // 1 frame per second default

  function createLiveVisionPanel() {
    if (document.getElementById("oc-live-vision-panel")) return;

    const panel = document.createElement("div");
    panel.id = "oc-live-vision-panel";
    panel.innerHTML = `
      <div class="oc-lv-header">
        <div class="oc-lv-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <span>Live Vision</span>
          <div class="oc-lv-live-dot" id="oc-lv-live-dot"></div>
        </div>
        <button id="oc-lv-close">✕</button>
      </div>
      <div class="oc-lv-viewer">
        <img id="oc-lv-screen" alt="Live Screen" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">
        <div class="oc-lv-overlay" id="oc-lv-overlay">
          <span>Pantalla en vivo</span>
        </div>
      </div>
      <div class="oc-lv-controls">
        <div class="oc-lv-fps">
          <label>FPS:</label>
          <button class="oc-lv-fps-btn" data-fps="0.5">0.5</button>
          <button class="oc-lv-fps-btn active" data-fps="1">1</button>
          <button class="oc-lv-fps-btn" data-fps="2">2</button>
          <button class="oc-lv-fps-btn" data-fps="5">5</button>
        </div>
        <button id="oc-lv-toggle" class="oc-lv-btn-start">▶ Iniciar</button>
        <button id="oc-lv-capture" class="oc-lv-btn-capture">📸 Captura</button>
      </div>
      <div class="oc-lv-analysis">
        <div class="oc-lv-analysis-header">
          <span>🔍 Análisis IA</span>
          <button id="oc-lv-analyze" class="oc-lv-btn-analyze">Analizar ahora</button>
        </div>
        <div id="oc-lv-analysis-text" class="oc-lv-analysis-content">Esperando análisis...</div>
      </div>
      <div class="oc-lv-commands">
        <div class="oc-lv-cmd-header">💬 Comandos de visión</div>
        <div class="oc-lv-cmd-list">
          <button class="oc-lv-cmd" data-q="¿Qué hay en la pantalla?">¿Qué ves?</button>
          <button class="oc-lv-cmd" data-q="¿Qué aplicación está abierta?">¿Qué app?</button>
          <button class="oc-lv-cmd" data-q="¿Hay algún error visible?">¿Hay errores?</button>
          <button class="oc-lv-cmd" data-q="¿Qué texto se muestra en pantalla?">¿Qué dice?</button>
          <button class="oc-lv-cmd" data-q="Describe los elementos de la interfaz">Describir UI</button>
          <button class="oc-lv-cmd" data-q="¿Qué puedo hacer en esta pantalla?">¿Qué hago?</button>
        </div>
        <div class="oc-lv-custom-cmd">
          <input id="oc-lv-custom-q" type="text" placeholder="Pregunta personalizada...">
          <button id="oc-lv-custom-send">▶</button>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    setupLiveVisionEvents(panel);
  }

  function setupLiveVisionEvents(panel) {
    document.getElementById("oc-lv-close").onclick = () => {
      stopStreaming();
      panel.classList.remove("open");
    };

    // FPS buttons
    panel.querySelectorAll(".oc-lv-fps-btn").forEach(btn => {
      btn.onclick = () => {
        panel.querySelectorAll(".oc-lv-fps-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        captureFPS = parseFloat(btn.dataset.fps);
        if (isStreaming) { stopStreaming(); startStreaming(); }
      };
    });

    // Start/Stop toggle
    document.getElementById("oc-lv-toggle").onclick = () => {
      if (isStreaming) stopStreaming();
      else startStreaming();
    };

    // Single capture
    document.getElementById("oc-lv-capture").onclick = () => captureAndDisplay();

    // Analyze button
    document.getElementById("oc-lv-analyze").onclick = () => analyzeCurrentFrame();

    // Vision commands
    panel.querySelectorAll(".oc-lv-cmd").forEach(btn => {
      btn.onclick = () => analyzeWithQuestion(btn.dataset.q);
    });

    // Custom command
    document.getElementById("oc-lv-custom-send").onclick = () => {
      const q = document.getElementById("oc-lv-custom-q").value.trim();
      if (q) analyzeWithQuestion(q);
    };
    document.getElementById("oc-lv-custom-q").onkeydown = (e) => {
      if (e.key === "Enter") {
        const q = e.target.value.trim();
        if (q) analyzeWithQuestion(q);
      }
    };
  }

  let currentFrameBase64 = null;

  async function captureScreen() {
    try {
      const resp = await fetch("/api/agent/screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      });
      const data = await resp.json();
      if (data.base64) {
        currentFrameBase64 = data.base64;
        return data.base64;
      }
    } catch (e) {
      console.error("[live-vision] Error capturando:", e);
    }
    return null;
  }

  async function captureAndDisplay() {
    const base64 = await captureScreen();
    if (base64) {
      const img = document.getElementById("oc-lv-screen");
      if (img) img.src = `data:image/png;base64,${base64}`;
      const overlay = document.getElementById("oc-lv-overlay");
      if (overlay) overlay.style.display = "none";
    }
  }

  function startStreaming() {
    if (isStreaming) return;
    isStreaming = true;
    const toggle = document.getElementById("oc-lv-toggle");
    if (toggle) { toggle.textContent = "⏹ Detener"; toggle.className = "oc-lv-btn-stop"; }
    const dot = document.getElementById("oc-lv-live-dot");
    if (dot) dot.classList.add("active");
    streamInterval = setInterval(captureAndDisplay, 1000 / captureFPS);
    captureAndDisplay();
  }

  function stopStreaming() {
    isStreaming = false;
    if (streamInterval) { clearInterval(streamInterval); streamInterval = null; }
    const toggle = document.getElementById("oc-lv-toggle");
    if (toggle) { toggle.textContent = "▶ Iniciar"; toggle.className = "oc-lv-btn-start"; }
    const dot = document.getElementById("oc-lv-live-dot");
    if (dot) dot.classList.remove("active");
  }

  async function analyzeCurrentFrame() {
    if (!currentFrameBase64) {
      await captureAndDisplay();
    }
    if (currentFrameBase64) {
      await analyzeWithQuestion("Describe en detalle lo que ves en esta captura de pantalla en español.");
    }
  }

  async function analyzeWithQuestion(question) {
    if (!currentFrameBase64) {
      await captureAndDisplay();
    }
    if (!currentFrameBase64) {
      document.getElementById("oc-lv-analysis-text").textContent = "❌ No se pudo capturar la pantalla";
      return;
    }

    const analysisEl = document.getElementById("oc-lv-analysis-text");
    analysisEl.textContent = "🔍 Analizando...";
    analysisEl.style.color = "#8b5cf6";

    try {
      const resp = await fetch("/__vision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: currentFrameBase64,
          mime: "image/png",
          question: question
        })
      });
      const data = await resp.json();
      if (data.error) {
        analysisEl.textContent = `❌ ${data.error}`;
        analysisEl.style.color = "#ef4444";
      } else {
        lastAnalysis = data.description;
        analysisEl.textContent = data.description;
        analysisEl.style.color = "rgba(220,220,255,0.9)";
        // Add model badge
        const badge = document.createElement("span");
        badge.className = "oc-lv-model-badge";
        badge.textContent = data.model || "AI";
        analysisEl.appendChild(badge);
      }
    } catch (e) {
      analysisEl.textContent = `❌ Error: ${e.message}`;
      analysisEl.style.color = "#ef4444";
    }
  }

  // Inject live vision button
  function injectLiveVisionButton() {
    if (document.getElementById("oc-live-vision-btn")) return;
    const btn = document.createElement("div");
    btn.id = "oc-live-vision-btn";
    btn.title = "Live Vision — Ve tu pantalla en tiempo real";
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <circle cx="12" cy="12" r="10"/>
        <circle cx="12" cy="12" r="3" fill="currentColor"/>
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>
      </svg>
      <span>Live</span>
      <div class="oc-lv-pulse"></div>
    `;
    btn.addEventListener("click", () => {
      createLiveVisionPanel();
      document.getElementById("oc-live-vision-panel").classList.toggle("open");
    });
    document.body.appendChild(btn);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectLiveVisionButton);
  } else {
    injectLiveVisionButton();
  }
})();

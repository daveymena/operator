// ─── Voice System (STT + TTS) ────────────────────────────────────
(function() {
  "use strict";

  let recognition = null;
  let isListening = false;
  let synthesis = window.speechSynthesis;

  function initVoice() {
    if (document.getElementById("oc-voice-btn")) return;
    
    // Check for Speech Recognition support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("[voice] Speech Recognition no soportado en este navegador");
      return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "es-ES";

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      console.log("[voice] Reconocido:", transcript);
      processVoiceCommand(transcript);
    };

    recognition.onend = () => {
      isListening = false;
      updateVoiceUI(false);
    };

    recognition.onerror = (event) => {
      console.error("[voice] Error:", event.error);
      isListening = false;
      updateVoiceUI(false);
    };

    // Create voice button
    const btn = document.createElement("div");
    btn.id = "oc-voice-btn";
    btn.title = "Voice Control — Habla para controlar";
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      </svg>
      <span>Voz</span>
      <div class="oc-voice-pulse" id="oc-voice-pulse"></div>
    `;
    btn.addEventListener("click", toggleVoice);
    document.body.appendChild(btn);
  }

  function toggleVoice() {
    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
      isListening = true;
      updateVoiceUI(true);
      speak("¿En qué puedo ayudarte?");
    }
  }

  function updateVoiceUI(listening) {
    const pulse = document.getElementById("oc-voice-pulse");
    if (pulse) {
      pulse.style.display = listening ? "block" : "none";
    }
    const status = document.getElementById("oc-status-text");
    if (status && listening) {
      status.textContent = "🎤 Escuchando...";
      status.style.color = "#ef4444";
    }
  }

  function processVoiceCommand(text) {
    const lower = text.toLowerCase();
    
    // Show recognized text
    const status = document.getElementById("oc-status-text");
    if (status) {
      status.textContent = `🎤 "${text}"`;
      status.style.color = "#8b5cf6";
      setTimeout(() => { status.textContent = "listo"; status.style.color = ""; }, 5000);
    }

    // Command detection
    if (lower.includes("abrir navegador") || lower.includes("abre chrome")) {
      speak("Abriendo navegador");
      sendAgentCommand({ type: "open_url", url: "https://www.google.com" });
    }
    else if (lower.includes("captura") || lower.includes("screenshot")) {
      speak("Tomando captura de pantalla");
      takeScreenshot();
    }
    else if (lower.includes("información del sistema") || lower.includes("sysinfo")) {
      speak("Obteniendo información del sistema");
      sendAgentCommand({ type: "sysinfo" });
    }
    else if (lower.includes("abrir explorador") || lower.includes("abrir carpeta")) {
      speak("Abriendo explorador de archivos");
      sendAgentCommand({ type: "open_file", path: "C:\\" });
    }
    else if (lower.includes("apagar") || lower.includes("apaga")) {
      speak("Apagando computadora");
      sendAgentCommand({ type: "powershell", script: "Stop-Computer -Force" });
    }
    else if (lower.includes("reiniciar") || lower.includes("reinicia")) {
      speak("Reiniciando computadora");
      sendAgentCommand({ type: "powershell", script: "Restart-Computer -Force" });
    }
    else if (lower.includes("bloquear") || lower.includes("bloquea")) {
      speak("Bloqueando computadora");
      sendAgentCommand({ type: "powershell", script: "rundll32.exe user32.dll,LockWorkStation" });
    }
    else if (lower.includes("qué hora es") || lower.includes("hora")) {
      const now = new Date();
      const time = now.toLocaleTimeString("es-ES");
      speak(`Son las ${time}`);
    }
    else if (lower.includes("qué día es") || lower.includes("fecha")) {
      const now = new Date();
      const date = now.toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
      speak(`Hoy es ${date}`);
    }
    else {
      // Inject text into chat
      injectTextToChat(text);
      speak("Entendido. Lo envío al chat.");
    }
  }

  async function sendAgentCommand(cmd) {
    try {
      await fetch("/api/agent/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cmd)
      });
    } catch (e) {
      console.error("[voice] Error enviando comando:", e);
    }
  }

  async function takeScreenshot() {
    try {
      const resp = await fetch("/api/agent/screenshot", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const data = await resp.json();
      if (data.base64) {
        const win = window.open("", "_blank", "width=800,height=600");
        win.document.write(`<img src="data:image/png;base64,${data.base64}" style="max-width:100%">`);
      }
    } catch (e) {
      console.error("[voice] Error en screenshot:", e);
    }
  }

  function speak(text) {
    if (!synthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-ES";
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    synthesis.speak(utterance);
  }

  function injectTextToChat(text) {
    const selectors = ['textarea[placeholder]', 'div[contenteditable="true"]', 'textarea', 'input[type="text"]'];
    let input = null;
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.id !== "oc-agent-cmd" && el.id !== "oc-vision-question") {
        input = el;
        break;
      }
    }
    if (input) {
      input.focus();
      if (input.tagName === "TEXTAREA" || input.type === "text") {
        const nativeSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set
                          || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        if (nativeSetter) {
          nativeSetter.call(input, (input.value || "") + text);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        } else {
          input.value += text;
        }
      } else if (input.contentEditable === "true") {
        input.textContent += text;
        input.dispatchEvent(new InputEvent("input", { bubbles: true, data: text }));
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initVoice);
  } else {
    initVoice();
  }
})();

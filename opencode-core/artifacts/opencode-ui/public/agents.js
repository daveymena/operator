// ─── Multi-Agent Dashboard ───────────────────────────────────────
(function() {
  "use strict";

  const AGENT_API = "/api/agent";
  let agents = [];
  let commandHistory = [];

  function createAgentPanel() {
    if (document.getElementById("oc-agent-panel")) return;
    
    const panel = document.createElement("div");
    panel.id = "oc-agent-panel";
    panel.innerHTML = `
      <div class="oc-agent-header">
        <div class="oc-agent-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
          Agent Control
        </div>
        <button id="oc-agent-close">✕</button>
      </div>
      <div class="oc-agent-status" id="oc-agent-status">
        <div class="oc-agent-dot" id="oc-agent-dot"></div>
        <span id="oc-agent-status-text">Conectando...</span>
      </div>
      <div class="oc-agent-quick">
        <button class="oc-agent-qbtn" data-cmd="sysinfo">📊 SysInfo</button>
        <button class="oc-agent-qbtn" data-cmd="screenshot">📸 Screenshot</button>
        <button class="oc-agent-qbtn" data-cmd="explorer">📁 Explorer</button>
        <button class="oc-agent-qbtn" data-cmd="powershell">💻 PowerShell</button>
      </div>
      <div class="oc-agent-cmd-input">
        <input id="oc-agent-cmd" type="text" placeholder="Escribe un comando...">
        <button id="oc-agent-send">▶</button>
      </div>
      <div class="oc-agent-history" id="oc-agent-history"></div>
    `;
    document.body.appendChild(panel);
    setupAgentEvents(panel);
    checkAgentStatus();
  }

  function setupAgentEvents(panel) {
    document.getElementById("oc-agent-close").onclick = () => panel.classList.remove("open");
    
    // Quick commands
    panel.querySelectorAll(".oc-agent-qbtn").forEach(btn => {
      btn.onclick = async () => {
        const cmd = btn.dataset.cmd;
        await executeQuickCommand(cmd);
      };
    });

    // Custom command input
    const cmdInput = document.getElementById("oc-agent-cmd");
    const sendBtn = document.getElementById("oc-agent-send");
    
    sendBtn.onclick = () => executeCustomCommand(cmdInput.value);
    cmdInput.onkeydown = (e) => {
      if (e.key === "Enter") executeCustomCommand(cmdInput.value);
    };
  }

  async function executeQuickCommand(cmd) {
    addHistory(`> ${cmd}`, "pending");
    try {
      let result;
      switch (cmd) {
        case "sysinfo":
          result = await fetchJSON(`${AGENT_API}/sysinfo`, { method: "POST" });
          break;
        case "screenshot":
          result = await fetchJSON(`${AGENT_API}/screenshot`, { method: "POST", body: "{}" });
          if (result.base64) showScreenshot(result.base64);
          break;
        case "explorer":
          result = await fetchJSON(`${AGENT_API}/open-url`, { 
            method: "POST", body: JSON.stringify({ url: "explorer.exe" })
          });
          break;
        case "powershell":
          const script = prompt("Script de PowerShell:");
          if (script) {
            result = await fetchJSON(`${AGENT_API}/powershell`, {
              method: "POST", body: JSON.stringify({ script })
            });
          }
          break;
      }
      if (result) addHistory(JSON.stringify(result, null, 2), "success");
    } catch (e) {
      addHistory(`Error: ${e.message}`, "error");
    }
  }

  async function executeCustomCommand(text) {
    if (!text.trim()) return;
    const cmdInput = document.getElementById("oc-agent-cmd");
    cmdInput.value = "";
    addHistory(`> ${text}`, "pending");
    
    try {
      // Detect command type
      let endpoint, body;
      if (text.startsWith("ps ")) {
        endpoint = "/powershell";
        body = { script: text.slice(3) };
      } else if (text.startsWith("open ")) {
        endpoint = "/open-url";
        body = { url: text.slice(5) };
      } else if (text.startsWith("read ")) {
        endpoint = "/read-file";
        body = { path: text.slice(5) };
      } else if (text.startsWith("ls ") || text.startsWith("dir ")) {
        endpoint = "/list-dir";
        body = { path: text.slice(3) };
      } else if (text.startsWith("type ")) {
        endpoint = "/keyboard";
        body = { text: text.slice(5) };
      } else if (text.startsWith("key ")) {
        endpoint = "/key-press";
        body = { key: text.slice(4) };
      } else if (text.startsWith("notify ")) {
        endpoint = "/notify";
        body = { message: text.slice(7) };
      } else {
        endpoint = "/powershell";
        body = { script: text };
      }
      
      const result = await fetchJSON(`${AGENT_API}${endpoint}`, {
        method: "POST",
        body: JSON.stringify(body)
      });
      addHistory(JSON.stringify(result, null, 2), "success");
    } catch (e) {
      addHistory(`Error: ${e.message}`, "error");
    }
  }

  async function fetchJSON(url, opts = {}) {
    const resp = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      ...opts
    });
    return resp.json();
  }

  function addHistory(text, type = "info") {
    const history = document.getElementById("oc-agent-history");
    if (!history) return;
    const entry = document.createElement("div");
    entry.className = `oc-agent-entry oc-agent-${type}`;
    entry.textContent = text;
    history.prepend(entry);
    // Keep only last 50 entries
    while (history.children.length > 50) history.lastChild.remove();
  }

  function showScreenshot(base64) {
    const win = window.open("", "_blank", "width=800,height=600");
    win.document.write(`<img src="data:image/png;base64,${base64}" style="max-width:100%">`);
  }

  async function checkAgentStatus() {
    try {
      const status = await fetchJSON(`${AGENT_API}/status`);
      const dot = document.getElementById("oc-agent-dot");
      const text = document.getElementById("oc-agent-status-text");
      if (status.connected) {
        dot.className = "oc-agent-dot green";
        text.textContent = `Conectado: ${status.agent?.id || "agente"}`;
      } else {
        dot.className = "oc-agent-dot red";
        text.textContent = "Desconectado";
      }
    } catch {
      const dot = document.getElementById("oc-agent-dot");
      const text = document.getElementById("oc-agent-status-text");
      if (dot) dot.className = "oc-agent-dot red";
      if (text) text.textContent = "Error de conexión";
    }
  }

  // Add agent button to header
  function injectAgentButton() {
    if (document.getElementById("oc-agent-btn")) return;
    const btn = document.createElement("div");
    btn.id = "oc-agent-btn";
    btn.title = "Agent Control — Controla tu PC remotamente";
    btn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
        <line x1="8" y1="21" x2="16" y2="21"></line>
        <line x1="12" y1="17" x2="12" y2="21"></line>
      </svg>
      <span>Agent</span>
    `;
    btn.addEventListener("click", () => {
      createAgentPanel();
      document.getElementById("oc-agent-panel").classList.toggle("open");
    });
    document.body.appendChild(btn);
  }

  // Auto-refresh status
  setInterval(checkAgentStatus, 15000);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectAgentButton);
  } else {
    injectAgentButton();
  }
})();

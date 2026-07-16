// ============================================================
// OpenCode Evolved — Main Server (serve.js)
// Interfaz web + APIs sin depender del engine OpenCode CLI
// ============================================================

import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { WebSocket } from "ws";
import path from "path";
import { fileURLToPath } from "url";
import fs, { existsSync, readFileSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || "3000");
const OPERATOR_PORT = parseInt(process.env.OPERATOR_API_PORT || "3001");
const AGENT_WS_PORT = parseInt(process.env.AGENT_WS_PORT || "21291");
const MEDIA_DIR = path.join(__dirname, "media");

const app = express();
app.use(cors());
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));

fs.mkdirSync(MEDIA_DIR, { recursive: true });

// ─── Auth ──────────────────────────────────────────────────────
const AUTH_USER = process.env.OPENCODE_USERNAME || "opencode";
const AUTH_PASS = process.env.OPENCODE_SERVER_PASSWORD || "";
const SESSION_TOKEN = AUTH_PASS ? Buffer.from(`${AUTH_USER}:${AUTH_PASS}`).toString("base64") : "";

function isAuth(req) {
  if (!AUTH_PASS) return true;
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/oc_session=([^;]+)/);
  return match && match[1] === SESSION_TOKEN;
}

// ─── Static files + UI ────────────────────────────────────────
const UI_DIR = path.join(__dirname, "artifacts", "opencode-ui", "ui");
const PUBLIC_DIR = path.join(__dirname, "artifacts", "opencode-ui", "public");
app.use("/__shell", express.static(PUBLIC_DIR));

// ─── Sessions (in-memory) ─────────────────────────────────────
const sessions = new Map();
const messages = new Map();

function getSession(id) {
  if (!sessions.has(id)) {
    sessions.set(id, { id, name: `Chat ${sessions.size + 1}`, createdAt: Date.now() });
    messages.set(id, []);
  }
  return sessions.get(id);
}

// ─── Media Server (imágenes, archivos) ─────────────────────────
app.use("/media", express.static(MEDIA_DIR, { maxAge: "1d", etag: true }));

app.get("/api/media/list", (_, res) => {
  try {
    const files = fs.readdirSync(MEDIA_DIR).filter(f => f !== ".gitkeep").map(f => {
      const stat = fs.statSync(path.join(MEDIA_DIR, f));
      return { name: f, size: stat.size, modified: stat.mtime, url: `/media/${f}` };
    });
    res.json({ ok: true, files, path: MEDIA_DIR, baseUrl: `/media` });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

app.post("/api/media/upload", async (req, res) => {
  try {
    const { name, data } = req.body;
    if (!data) return res.status(400).json({ error: "No data" });
    const filename = name || `upload_${Date.now()}.png`;
    const fp = path.join(MEDIA_DIR, filename);
    const buf = Buffer.from(data, "base64");
    fs.writeFileSync(fp, buf);
    res.json({ ok: true, filename, size: buf.length, url: `/media/${filename}` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/media/upload-url", async (req, res) => {
  try {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "No URL" });
    const resp = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!resp.ok) return res.status(400).json({ error: `Fetch failed: ${resp.status}` });
    const buf = Buffer.from(await resp.arrayBuffer());
    const name = url.split("/").pop() || `download_${Date.now()}`;
    const fp = path.join(MEDIA_DIR, name);
    fs.writeFileSync(fp, buf);
    res.json({ ok: true, filename: name, size: buf.length, url: `/media/${name}`, originalUrl: url });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post("/api/media/screenshot", async (_, res) => {
  try {
    const bridgeResp = await fetch(`http://localhost:${process.env.BRIDGE_PORT || 21295}/screenshot?quality=75&scale=0.75&force=true`);
    const data = await bridgeResp.json();
    if (!data.ok || !data.base64) return res.status(502).json({ error: "Screenshot failed" });
    const filename = `screenshot_${Date.now()}.jpg`;
    const fp = path.join(MEDIA_DIR, filename);
    fs.writeFileSync(fp, Buffer.from(data.base64, "base64"));
    res.json({ ok: true, filename, url: `/media/${filename}`, width: data.width, height: data.height });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Public API routes (no auth needed) ───────────────────────
app.get("/__health", (_, res) => res.json({ status: "ok", uptime: process.uptime() }));
app.get("/health", (_, res) => res.json({ status: "ok" }));
app.get("/global/health", (_, res) => res.json({ status: "ok" }));

// SSE event stream — para compatibilidad con OpenCode UI
app.get("/global/event", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.write("event: open\ndata: {}\n\n");
  const keepAlive = setInterval(() => res.write(": keepalive\n\n"), 15000);
  req.on("close", () => clearInterval(keepAlive));
});

// SSE para eventos del navegador interno (__shell)
app.get("/api/ui-events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const keepAlive = setInterval(() => res.write(": keepalive\n\n"), 15000);
  req.on("close", () => clearInterval(keepAlive));
});

app.get("/api/models", (_, res) => {
  const models = [];
  if (process.env.FREEMODEL_API_KEY) models.push({ id: process.env.FREEMODEL_MODEL || "gpt-4o", name: "GPT-4o (FreeModel)", provider: "freemodel" });
  if (process.env.OPENAI_API_KEY) models.push({ id: "gpt-4o", name: "GPT-4o", provider: "openai" });
  if (process.env.ANTHROPIC_API_KEY) models.push({ id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", provider: "anthropic" });
  if (process.env.GITHUB_COPILOT_TOKEN || process.env.GITHUB_TOKEN) {
    models.push({ id: "gpt-4o", name: "GPT-4o (Copilot)", provider: "github-copilot" });
    models.push({ id: "gpt-4o-mini", name: "GPT-4o Mini (Copilot)", provider: "github-copilot" });
    models.push({ id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4 (Copilot)", provider: "github-copilot" });
  }
  if (models.length === 0) models.push({ id: "gpt-4o", name: "GPT-4o", provider: "freemodel" });
  res.json({ models });
});

// ─── Chat API (streaming) ─────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { sessionId, message, model = "gpt-4o" } = req.body;
  if (!message) return res.status(400).json({ error: "Message required" });

  const sid = sessionId || "default";
  getSession(sid);
  const history = messages.get(sid) || [];
  history.push({ role: "user", content: message });

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");

  let fullReply = "";
  const modelProvider = model.includes("copilot") || model.includes("Copilot") ? "copilot" : "";
  if (modelProvider === "copilot" && process.env.GITHUB_COPILOT_TOKEN) {
    try {
      const resp = await fetch("https://api.githubcopilot.com/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${process.env.GITHUB_COPILOT_TOKEN}`, "Content-Type": "application/json", "Editor-Version": "vscode/1.96.0", "Editor-Plugin-Version": "copilot/1.250.0", "Openai-Organization": "github-copilot", "Copilot-Integration-Id": "vscode-chat" },
        body: JSON.stringify({ model: "gpt-4o", max_tokens: 4096, messages: history.map(m => ({ role: m.role, content: m.content })), stream: true }),
        signal: AbortSignal.timeout(120000),
      });
      if (resp.ok) {
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        while (true) { const { done, value } = await reader.read(); if (done) break; const text = decoder.decode(value, { stream: true }); for (const line of text.split("\n").filter(l => l.startsWith("data: "))) { const d = line.slice(6).trim(); if (d === "[DONE]") continue; try { const c = JSON.parse(d).choices?.[0]?.delta?.content; if (c) { fullReply += c; res.write(c); } } catch {} } }
        if (fullReply) { history.push({ role: "assistant", content: fullReply }); res.end(); return; }
      }
    } catch {}
  }
  const apiKey = process.env.FREEMODEL_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) { res.write("\nNo API key configurada.\n"); res.end(); return; }

  const baseUrl = process.env.FREEMODEL_BASE_URL || "https://api.openai.com/v1";
  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: history.map(m => ({ role: m.role, content: m.content })), stream: true, max_tokens: 4096 }),
      signal: AbortSignal.timeout(120000),
    });
    if (!resp.ok) { const t = await resp.text(); throw new Error(t.slice(0, 200)); }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value, { stream: true }).split("\n").filter(l => l.startsWith("data: "))) {
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try { const c = JSON.parse(data).choices?.[0]?.delta?.content; if (c) { fullReply += c; res.write(c); } } catch {}
      }
    }
  } catch (e) { if (!fullReply) res.write(`\nError: ${e.message}`); }
  if (fullReply) history.push({ role: "assistant", content: fullReply });
  res.end();
});

// ─── Vision API ────────────────────────────────────────────────
app.post("/__vision", async (req, res) => {
  const { image, mime = "image/jpeg", question = "Describe esta imagen en español." } = req.body;
  if (!image) return res.status(400).json({ error: "image required" });
  const base64 = image.includes(",") ? image.split(",")[1] : image;
  const apiKey = process.env.FREEMODEL_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: "No API key" });
  const baseUrl = process.env.FREEMODEL_BASE_URL || "https://api.openai.com/v1";
  try {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: process.env.FREEMODEL_MODEL || "gpt-4o",
        messages: [{ role: "user", content: [{ type: "text", text: question }, { type: "image_url", image_url: { url: `data:${mime};base64,${base64}`, detail: "high" } }] }],
        max_tokens: 2048,
      }),
      signal: AbortSignal.timeout(60000),
    });
    const data = await resp.json();
    res.json({ description: data.choices?.[0]?.message?.content || "Sin descripción", model: "vision" });
  } catch (e) { res.status(503).json({ error: e.message }); }
});

// ─── Session management ───────────────────────────────────────
app.get("/api/sessions", (_, res) => res.json({ sessions: Array.from(sessions.values()) }));
app.post("/api/sessions", (_, res) => {
  const id = "sess_" + Math.random().toString(36).slice(2, 10);
  res.json(getSession(id));
});
app.delete("/api/sessions/:id", (req, res) => {
  sessions.delete(req.params.id);
  messages.delete(req.params.id);
  res.json({ ok: true });
});
app.get("/api/sessions/:id/messages", (req, res) => res.json({ messages: messages.get(req.params.id) || [] }));

// ─── Agent API (PC control proxy) ─────────────────────────────
let agentWs = null;
let agentReconnectTimer = null;

function connectAgent() {
  if (agentWs && agentWs.readyState === WebSocket.OPEN) return;
  const url = `ws://localhost:${AGENT_WS_PORT}/agent`;
  console.log(`[agent] Conectando a ${url}...`);
  try {
    const agentToken = process.env.AGENT_SERVER_TOKEN || '';
    const options = {};
    if (agentToken) {
      options.headers = { Authorization: `Bearer ${agentToken}` };
    }
    agentWs = new WebSocket(url, options);
    agentWs.on("open", () => {
      console.log("[agent] Conectado a agent-server");
      agentWs.send(JSON.stringify({ type: "register", agentName: "opencode-ui", agentId: "opencode-evolved-ui", sysinfo: { role: "controller" } }));
    });
    agentWs.on("close", () => { agentWs = null; agentReconnectTimer = setTimeout(connectAgent, 5000); });
    agentWs.on("error", () => {});
  } catch {}
}
connectAgent();

function sendToAgent(cmd) {
  return new Promise((resolve, reject) => {
    if (!agentWs || agentWs.readyState !== WebSocket.OPEN) return reject(new Error("Agent no conectado"));
    const id = Math.random().toString(36).slice(2, 8);
    const handler = (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.requestId === id || msg.id === id) {
          agentWs.removeListener("message", handler);
          resolve(msg.result || msg.data || msg);
        }
      } catch {}
    };
    agentWs.on("message", handler);
    agentWs.send(JSON.stringify({ type: "command", cmd, requestId: id }));
    setTimeout(() => { agentWs.removeListener("message", handler); reject(new Error("Timeout")); }, 30000);
  });
}

app.get("/api/agent/status", (_, res) => res.json({ connected: !!(agentWs && agentWs.readyState === WebSocket.OPEN) }));
app.post("/api/agent/command", async (req, res) => {
  try { const r = await sendToAgent(req.body); res.json(r); } catch (e) { res.status(503).json({ error: e.message }); }
});
app.post("/api/agent/screenshot", async (_, res) => {
  try { const r = await sendToAgent({ type: "screenshot" }); res.json(r); } catch (e) { res.status(503).json({ error: e.message }); }
});
app.post("/api/agent/powershell", async (req, res) => {
  try { const r = await sendToAgent({ type: "powershell", script: req.body.script }); res.json(r); } catch (e) { res.status(503).json({ error: e.message }); }
});
app.post("/api/agent/cmd", async (req, res) => {
  try { const r = await sendToAgent({ type: "cmd", command: req.body.command }); res.json(r); } catch (e) { res.status(503).json({ error: e.message }); }
});
app.post("/api/agent/sysinfo", async (_, res) => {
  try { const r = await sendToAgent({ type: "sysinfo" }); res.json(r); } catch (e) { res.status(503).json({ error: e.message }); }
});
app.post("/api/agent/open-url", async (req, res) => {
  try { const r = await sendToAgent({ type: "open_url", url: req.body.url }); res.json(r); } catch (e) { res.status(503).json({ error: e.message }); }
});

// ─── Colmena / Agents API proxy ──────────────────────────────
const AGENT_SERVER_HTTP = `http://localhost:${AGENT_WS_PORT}`;

app.get("/api/agents", async (_, res) => {
  try { const r = await fetch(`${AGENT_SERVER_HTTP}/agents`); res.json(await r.json()); }
  catch (e) { res.json([]); }
});
app.post("/api/agents/:id", async (req, res) => {
  try {
    const r = await fetch(`${AGENT_SERVER_HTTP}/agents/${req.params.id}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req.body)
    });
    res.json(await r.json());
  } catch (e) { res.status(503).json({ error: e.message }); }
});
app.get("/api/agents/health", async (_, res) => {
  try { const r = await fetch(`${AGENT_SERVER_HTTP}/health`); res.json(await r.json()); }
  catch (e) { res.json({ ok: false, error: e.message }); }
});

// ─── Web Operator API proxy ───────────────────────────────────
app.post("/api/browser/open", async (req, res) => {
  try {
    const resp = await fetch(`http://localhost:${OPERATOR_PORT}/api/browser/open`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req.body), signal: AbortSignal.timeout(10000)
    });
    res.json(await resp.json());
  } catch (e) { res.status(503).json({ error: e.message }); }
});
app.post("/api/browser/action", async (req, res) => {
  try {
    const resp = await fetch(`http://localhost:${OPERATOR_PORT}/api/browser/action`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req.body), signal: AbortSignal.timeout(30000)
    });
    res.json(await resp.json());
  } catch (e) { res.status(503).json({ error: e.message }); }
});
app.get("/api/browser", async (_, res) => {
  try {
    const resp = await fetch(`http://localhost:${OPERATOR_PORT}/api/browser`, { signal: AbortSignal.timeout(10000) });
    res.json(await resp.json());
  } catch (e) { res.status(503).json({ error: e.message }); }
});
app.post("/api/run", async (req, res) => {
  try {
    const resp = await fetch(`http://localhost:${OPERATOR_PORT}/api/run`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req.body), signal: AbortSignal.timeout(10000)
    });
    res.json(await resp.json());
  } catch (e) { res.status(503).json({ error: e.message }); }
});
app.post("/api/run/cua", async (req, res) => {
  try {
    const resp = await fetch(`http://localhost:${OPERATOR_PORT}/api/run/cua`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req.body), signal: AbortSignal.timeout(10000)
    });
    res.json(await resp.json());
  } catch (e) { res.status(503).json({ error: e.message }); }
});
app.get("/api/status", async (_, res) => {
  try {
    const resp = await fetch(`http://localhost:${OPERATOR_PORT}/api/status`, { signal: AbortSignal.timeout(5000) });
    res.json(await resp.json());
  } catch (e) { res.json({ running: false, error: e.message }); }
});

// ─── Skills API ────────────────────────────────────────────────
app.get("/api/skills/claro/status", async (_, res) => {
  try { const r = await fetch(`http://localhost:${OPERATOR_PORT}/api/skills/claro/status`); res.json(await r.json()); } catch { res.json({ status: "offline" }); }
});
app.post("/api/skills/claro/order", async (req, res) => {
  try { const r = await fetch(`http://localhost:${OPERATOR_PORT}/api/skills/claro/order`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req.body) }); res.json(await r.json()); } catch (e) { res.status(503).json({ error: e.message }); }
});
app.get("/api/skills/preoperacional/status", async (_, res) => {
  try { const r = await fetch(`http://localhost:${OPERATOR_PORT}/api/skills/preoperacional/status`); res.json(await r.json()); } catch { res.json({ status: "offline" }); }
});
app.post("/api/skills/preoperacional/run", async (req, res) => {
  try { const r = await fetch(`http://localhost:${OPERATOR_PORT}/api/skills/preoperacional/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(req.body) }); res.json(await r.json()); } catch (e) { res.status(503).json({ error: e.message }); }
});

// ─── Serve UI (primary interface) ──────────────────────────────
const UI_INDEX = path.join(UI_DIR, "index.html");
if (!existsSync(UI_INDEX)) {
  console.error("ERROR: No se encontro", UI_INDEX);
  process.exit(1);
}

// Auth middleware (after API routes)
if (AUTH_PASS) {
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/") || req.path === "/__health" || req.path === "/health" ||
        req.path.startsWith("/__shell") || req.path === "/__vision" ||
        req.path === "/__login" || req.path === "/__logout") return next();
    if (!isAuth(req)) return res.redirect("/__login");
    next();
  });
}

// Login pages
const LOGIN_HTML = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>OpenCode Evolved — Acceso</title><style>*{margin:0;padding:0;box-sizing:border-box}body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#07070d;background-image:radial-gradient(ellipse 80% 50% at 20% -10%,rgba(124,58,237,.22) 0%,transparent 60%),radial-gradient(ellipse 60% 40% at 80% 110%,rgba(59,130,246,.14) 0%,transparent 60%);font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif}.card{width:340px;padding:36px 32px;background:rgba(13,13,22,.92);border:1px solid rgba(124,58,237,.28);border-radius:20px;box-shadow:0 24px 64px rgba(0,0,0,.6);backdrop-filter:blur(24px)}.logo{display:flex;align-items:center;gap:10px;margin-bottom:28px;justify-content:center}.logo svg{width:28px;height:28px}.logo-text{font-size:17px;font-weight:700;color:#fff}.badge{font-size:9px;font-weight:700;letter-spacing:1.2px;color:#8b5cf6;background:rgba(124,58,237,.15);border:1px solid rgba(124,58,237,.3);border-radius:4px;padding:2px 7px;text-transform:uppercase}h2{font-size:14px;color:rgba(200,200,240,.7);text-align:center;margin-bottom:24px;font-weight:400}label{display:block;font-size:11.5px;color:rgba(180,180,220,.75);margin-bottom:6px;font-weight:500}input{width:100%;padding:10px 13px;margin-bottom:16px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:9px;color:rgba(240,240,255,.92);font-size:13px;outline:none}input:focus{border-color:rgba(124,58,237,.6)}button{width:100%;padding:11px;margin-top:4px;background:linear-gradient(135deg,#7c3aed,#6d28d9);border:none;border-radius:9px;color:#fff;font-size:13px;font-weight:600;cursor:pointer}button:hover{background:linear-gradient(135deg,#8b5cf6,#7c3aed)}</style></head><body><div class="card"><div class="logo"><svg viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7L12 12L22 7Z" stroke="#8b5cf6" stroke-width="1.8" stroke-linejoin="round"/><path d="M2 17L12 22L22 17" stroke="#8b5cf6" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 12L12 17L22 12" stroke="#6d28d9" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg><span class="logo-text">OpenCode</span><span class="badge">EVOLVED</span></div><h2>Ingresa tus credenciales</h2><form method="POST" action="/__login"><label>Usuario</label><input name="username" type="text" value="opencode" required><label>Contraseña</label><input name="password" type="password" required autofocus><button type="submit">Entrar</button></form></div></body></html>`;

app.get("/__login", (req, res) => {
  if (isAuth(req)) return res.redirect("/");
  res.send(LOGIN_HTML);
});
app.post("/__login", (req, res) => {
  if (req.body.username === AUTH_USER && req.body.password === AUTH_PASS) {
    res.setHeader("Set-Cookie", `oc_session=${SESSION_TOKEN}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`);
    return res.redirect("/");
  }
  res.send(LOGIN_HTML.replace("Ingresa tus credenciales", "Credenciales incorrectas"));
});
app.get("/__logout", (_, res) => { res.setHeader("Set-Cookie", "oc_session=; Path=/; Max-Age=0"); res.redirect("/__login"); });

// SPA fallback: serve index.html for all non-API routes
app.use((req, res, next) => {
  if (req.method === "GET" && !req.path.startsWith("/api/") && !req.path.startsWith("/__")) {
    res.sendFile(UI_INDEX);
  } else {
    next();
  }
});

// ─── Start server ──────────────────────────────────────────────
const server = createServer(app);
server.on("error", (err) => {
  console.error(`[serve.js] Error del servidor: ${err.message}`);
  if (err.code === "EADDRINUSE") {
    console.error(`[serve.js] Puerto ${PORT} en uso. Reintentando en puerto ${PORT + 1}...`);
    server.listen(PORT + 1, "0.0.0.0");
    return;
  }
});
server.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("  ╔══════════════════════════════════════════════╗");
  console.log("  ║     OpenCode Evolved — Servidor Activo      ║");
  console.log("  ╠══════════════════════════════════════════════╣");
  console.log(`  ║  Web UI:     http://localhost:${server.address().port}          ║`);
  console.log(`  ║  Chat API:   http://localhost:${server.address().port}/api/chat  ║`);
  console.log(`  ║  Agent:      ws://localhost:${AGENT_WS_PORT}/agent       ║`);
  console.log(`  ║  Operator:   http://localhost:${OPERATOR_PORT}/api      ║`);
  console.log("  ╚══════════════════════════════════════════════╝");
  console.log("");
});

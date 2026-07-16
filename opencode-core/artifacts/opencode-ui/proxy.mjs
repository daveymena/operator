// ============================================================
// OpenCode Evolved — Proxy híbrido (:3000 → :21294)
// Assets desde caché local (rápido) + API/SSE forwardeados
// ============================================================

import http from "http";
import httpProxy from "http-proxy";
import path from "path";
import { existsSync, readFileSync } from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = parseInt(process.env.PORT || "3000");
const OPENCODE_PORT = parseInt(process.env.OPENCODE_INTERNAL_PORT || "21294");
const TARGET = `http://127.0.0.1:${OPENCODE_PORT}`;
const ASSETS_DIR = path.join(__dirname, "public", "assets");

const MIME_TYPES = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".json": "application/json",
  ".webmanifest": "application/manifest+json",
};

const CACHED_PREFIXES = [
  "/assets/",
  "/favicon-",
  "/apple-touch-icon-",
  "/site.webmanifest",
  "/social-share.",
];

const proxy = httpProxy.createProxyServer({
  target: TARGET,
  ws: true,
  changeOrigin: true,
  xfwd: true,
});

proxy.on("error", (err, req, res) => {
  if (res && !res.headersSent) {
    res.writeHead(502, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<h1>502 Bad Gateway</h1><p>Reintenta...</p>`);
  }
});

function serveAsset(req, res) {
  const baseName = path.basename(req.url);
  const filePath = path.join(ASSETS_DIR, baseName);
  if (!existsSync(filePath)) {
    proxy.web(req, res);
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  try {
    const data = readFileSync(filePath);
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": data.length,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(data);
  } catch {
    proxy.web(req, res);
  }
}

function isCachedAsset(url) {
  for (const prefix of CACHED_PREFIXES) {
    if (url.startsWith(prefix)) return true;
  }
  return false;
}

const server = http.createServer((req, res) => {
  if (isCachedAsset(req.url)) {
    serveAsset(req, res);
    return;
  }

  proxy.web(req, res);
});

server.timeout = 0;
server.keepAliveTimeout = 120000;
server.headersTimeout = 120000;

server.on("upgrade", (req, socket, head) => {
  proxy.ws(req, socket, head);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`✦ Proxy híbrido: http://0.0.0.0:${PORT} → ${TARGET}`);
  console.log(`✦ Assets locales: ${ASSETS_DIR}`);
  console.log(`  Abre http://localhost:${PORT} en tu navegador`);
});

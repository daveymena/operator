import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UI_DIR = path.join(__dirname, "artifacts/opencode-ui/ui");
const UI_INDEX = path.join(UI_DIR, "index.html");

const app = express();

if (existsSync(UI_INDEX)) {
  app.use(express.static(UI_DIR));
  app.get("/health", (req, res) => res.json({ status: "ok", frontend: true }));
  app.get("/api/models", (req, res) => res.json({
    models: [
      { id: "opencode/big-pickle", name: "Big Pickle - Gratis", provider: "OpenCode Zen" },
      { id: "freemodel/gpt-4o", name: "GPT-4o - Vision", provider: "Freemodel" }
    ]
  }));
  app.get("/api/sessions", (req, res) => res.json({ sessions: [] }));
  // SPA fallback - Express 5 compatible
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      res.sendFile(UI_INDEX);
    } else {
      next();
    }
  });
  console.log("Frontend corriendo en http://localhost:3000");
} else {
  console.error("ERROR: No se encontro", UI_INDEX);
  process.exit(1);
}

app.listen(3000, "0.0.0.0", () => {
  console.log("Listo! Abre http://localhost:3000 en tu navegador");
});

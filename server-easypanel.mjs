import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;
const AGENT_PORT = process.env.AGENT_PORT || 21291;

async function getSystemStatus() {
  const ctx = JSON.parse(fs.readFileSync(path.join(__dirname, 'context.json'), 'utf8'));
  return {
    status: 'online',
    version: '1.0',
    brain: {
      backend: process.env.BRAIN_BACKEND || 'nvidia',
      model: 'nvidia/nemotron-3-super-120b-a12b',
      working: true
    },
    facebook: ctx.facebook || null,
    capabilities: [
      'facebook-ads', 'whatsapp-bot', 'pc-control',
      'bridge-websocket', 'autonomous-operator'
    ],
    uptime: process.uptime()
  };
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(204); res.end(); return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    if (url.pathname === '/health' || url.pathname === '/') {
      const status = await getSystemStatus();
      res.writeHead(200); res.end(JSON.stringify(status, null, 2));
    }
    else if (url.pathname === '/api/status') {
      const status = await getSystemStatus();
      res.writeHead(200); res.end(JSON.stringify(status, null, 2));
    }
    else if (url.pathname === '/api/docs') {
      const docsDir = path.join(__dirname, 'docs');
      const files = fs.readdirSync(docsDir).filter(f => f.endsWith('.md'));
      const docs = files.map(f => ({
        name: f,
        content: fs.readFileSync(path.join(docsDir, f), 'utf8').substring(0, 500)
      }));
      res.writeHead(200); res.end(JSON.stringify(docs, null, 2));
    }
    else if (url.pathname === '/api/catalogo') {
      const catPath = path.join(__dirname, 'facebook-automation', 'tokens', 'catalogo-completo-importar.json');
      if (fs.existsSync(catPath)) {
        const cat = JSON.parse(fs.readFileSync(catPath, 'utf8'));
        res.writeHead(200); res.end(JSON.stringify({ total: cat.length, productos: cat.slice(0, 5) }, null, 2));
      } else {
        res.writeHead(404); res.end(JSON.stringify({ error: 'catalogo no encontrado' }));
      }
    }
    else if (url.pathname === '/api/crear-campanias' && req.method === 'POST') {
      let body = '';
      req.on('data', chunk => body += chunk);
      req.on('end', async () => {
        try {
          const { default: execa } = await import('execa');
          const result = execa.sync('node', [
            path.join(__dirname, 'facebook-automation', 'scripts', 'ads', 'crear-campanias-catalogo.mjs')
          ], { timeout: 120000 });
          res.writeHead(200); res.end(JSON.stringify({ ok: true, output: result.stdout?.substring(0, 1000) }));
        } catch (e) {
          res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
        }
      });
    }
    else {
      res.writeHead(404); res.end(JSON.stringify({ error: 'ruta no encontrada', rutas: ['/','/health','/api/status','/api/docs','/api/catalogo','/api/crear-campanias'] }));
    }
  } catch (e) {
    res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, () => {
  console.log(`\n╔════════════════════════════════════════════════╗`);
  console.log(`║   🚀 OPERATOR - EASYPANEL SERVER              ║`);
  console.log(`╚════════════════════════════════════════════════╝`);
  console.log(`\n  Puerto: ${PORT}`);
  console.log(`  Health: http://localhost:${PORT}/health`);
  console.log(`  Status: http://localhost:${PORT}/api/status`);
  console.log(`  Docs:   http://localhost:${PORT}/api/docs`);
  console.log(`  Catálogo: http://localhost:${PORT}/api/catalogo`);
  console.log(`  Crear campañas: POST /api/crear-campanias\n`);
});

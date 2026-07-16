# Changelog — Historial de Trabajo

## 2026-07-15 — Reorganización + Últimos cambios

### Reorganización completa de Music/
- Se creó estructura de carpetas por proyecto:
  - `facebook-automation/` — Todo lo relacionado con Facebook
  - `whatsapp-bot/` — Bot de ventas WhatsApp
  - `pc-agent/` — Archivos del PC Agent
  - `scripts/` — Scripts de utilidad
  - `config/` — Archivos de configuración (.env)
  - `logs/` — Logs del sistema
  - `docs/` — Documentación maestra
  - `assets/` — Archivos multimedia
- Se movieron ~40 archivos sueltos a sus carpetas correspondientes
- Se eliminaron carpetas vacías

### Facebook Automation
- `crear-borradores-adsmanager.mjs` — Último script creado: conecta a Ads Manager via Puppeteer, prepara creación de campañas con 6 estrategias
- Token de página obtenido y guardado en `fb_tokens_output.json`
- Múltiples métodos de extracción de token probados (DOM, scripts, localStorage, Graph API Explorer, cookies)

## 2026-07-14 — Puente Hermes-OpenCode

### Bridge System
- `bridge/bridge.mjs` — Orquestador principal con WebSocket
- `bridge/hermes_init.py` — Inyección automática de herramientas
- `bridge/opencode_bridge_tools.py` — 12 herramientas OpenCode para Hermes
- `hermes.bat` / `opencode.bat` — Lanzadores duales
- `iniciar-bridge-independiente.bat` — Modo standalone
- `start-unified.bat` — Menú selector

### OpenCode Core
- `pc-agent.mjs` creado para control de PC Windows
- `agent-server.mjs` con soporte de tokens
- `docker-start.sh` refactorizado con puertos fijos
- Skills: claro-agent, preoperacional-nova

### Hermes Core
- Configuraciones para DeepSeek V4 Pro, Gemini, NVIDIA
- Plugin system con OpenCode Bridge
- Trading bot implementation

## 2026-07-13 — Inicio Facebook Automation

### Configuración Facebook
- Business Manager creado: `4482432028697067`
- Página VentasPro creada: `1278583508663384`
- Ad Account: `1545022093928422`
- Primeros scripts de extracción de token
- Capturas de pantalla del proceso de configuración

## 2026-07-10 — WhatsApp Bot

- Bot de ventas con Groq IA + Baileys
- `src/main.js`, `groqClient.js`, `promptBase.js`, `whatsappBot.js`
- Integración con Facebook para ventas

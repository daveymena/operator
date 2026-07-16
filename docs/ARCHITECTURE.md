# Architecture — Arquitectura del Sistema

## Diagrama de Conexiones

```
┌──────────────────────────────────────────────────────────────────┐
│                        WINDOWS PC                                │
│                                                                  │
│  ┌──────────────┐    ┌──────────────────┐    ┌───────────────┐  │
│  │  Hermes CLI  │    │  Bridge (ws20100)│    │ OpenCode Core │  │
│  │  (cli.py)    │◄──►│  bridge.mjs      │◄──►│ (serve.js)    │  │
│  │  plugins/    │    │  hermes_init.py  │    │ pc-agent.mjs  │  │
│  │  skills/     │    │  opencode_tools  │    │ agent-server  │  │
│  └──────┬───────┘    └────────┬─────────┘    └───────┬────────┘  │
│         │                     │                      │           │
│         │              ┌──────▼───────┐              │           │
│         │              │  Facebook    │              │           │
│         └──────────────►  Automation  │◄─────────────┘           │
│                        │  (Puppeteer) │                          │
│                        └──────────────┘                          │
│                                                                  │
│  ┌─────────────┐    ┌──────────────────┐                        │
│  │ WhatsApp Bot│    │  PC Agent        │                        │
│  │ (Baileys)   │    │  (pc-agent.mjs)  │                        │
│  └─────────────┘    └──────────────────┘                        │
└──────────────────────────────────────────────────────────────────┘
```

## Flujo de Datos

### Modo 1: Hermes controla OpenCode
1. `hermes.bat` inicia el bridge + inyecta herramientas en Hermes
2. Hermes CLI se ejecuta con 12 herramientas OpenCode disponibles
3. Cuando Hermes llama a `opencode_screenshot()`, el bridge envía el comando vía WebSocket a OpenCode
4. OpenCode ejecuta la acción en el PC y devuelve el resultado

### Modo 2: OpenCode controla Hermes
1. `opencode.bat` inicia el bridge + PC Agent + OpenCode Serve
2. OpenCode puede solicitar tareas a Hermes vía el bridge

### Automatización Facebook
1. Los scripts .mjs usan Puppeteer para conectarse a Chrome (`http://127.0.0.1:9222`)
2. Navegan Facebook Business Manager, Graph API Explorer, Ads Manager
3. Extraen tokens, crean campañas, configuran páginas

## Dependencias

- **Node.js** — Todos los scripts .mjs, bridge, opencode-core, WhatsApp bot
- **Python** — Hermes CLI, hermes_init.py
- **Puppeteer** — Automatización Chrome para Facebook
- **Baileys** — WhatsApp bot
- **Groq API** — IA para WhatsApp bot
- **WebSocket (ws)** — Comunicación bridge

## Variables de Entorno Clave

| Variable | Dónde se usa | Propósito |
|---|---|---|
| `HERMES_BRIDGE_PORT` | bridge/hermes_init.py | Puerto del bridge (20100) |
| `OPENCODE_CONTROL` | bridge/ | Activa inyección de herramientas (1=on) |
| `AGENT_SERVER_URL` | opencode-core/pc-agent.mjs | URL del Agent Server |
| `FB_ACCESS_TOKEN` | facebook-automation/ | Token de Facebook |
| `FB_PAGE_ID` | facebook-automation/ | ID de página VentasPro |
| `FB_AD_ACCOUNT_ID` | facebook-automation/ | ID de Ad Account |

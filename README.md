# Proyecto Unificado — Hermes + OpenCode + Automatización

```
Music/
├── proyecto-unificado/            ← TODO EL PROYECTO AQUÍ
│   ├── bridge/                    ← Puente Hermes ↔ OpenCode
│   ├── facebook-automation/       ← Automatización Facebook Ads
│   ├── whatsapp-bot/              ← Bot ventas WhatsApp
│   ├── pc-agent/                  ← PC Agent
│   ├── docs/                      ← Documentación completa
│   ├── config/                    ← Configuración (.env)
│   ├── scripts/                   ← Scripts de utilidad
│   ├── assets/                    ← Multimedia
│   ├── logs/                      ← Logs
│   ├── node_modules/              ← Dependencias
│   │
│   ├── hermes.bat                 ← Lanzador Hermes
│   ├── opencode.bat               ← Lanzador OpenCode
│   ├── start-unified.bat          ← Menú unificado
│   └── iniciar-bridge-independiente.bat
│
├── hermes-core/                   ← Repositorio externo
├── opencode-core/                 ← Repositorio externo
└── (logs bloqueados)
```

### Documentación

| Archivo | Qué contiene |
|---|---|
| `docs/PROJECT_OVERVIEW.md` | Contexto completo del proyecto |
| `docs/CHANGELOG.md` | Historial de cambios |
| `docs/ARCHITECTURE.md` | Diagramas y conexiones |
| `facebook-automation/docs/FACEBOOK_CONFIG_DONE.md` | Config Facebook |
| `bridge/opencode_bridge_tools.py` | 12 herramientas OpenCode |

### Cómo usar

```cmd
cd proyecto-unificado
hermes.bat              → Hermes controla el PC
opencode.bat            → OpenCode con IA Hermes
start-unified.bat       → Menú selector
```

### Facebook Automation

```cmd
cd proyecto-unificado
node facebook-automation/scripts/ads/crear-borradores-adsmanager.mjs
```

### WhatsApp Bot

```cmd
cd proyecto-unificado\whatsapp-bot
npm start
```

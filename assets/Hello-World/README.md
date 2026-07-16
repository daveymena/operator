# OpenCode Evolved

> **OpenCode Evolved** es una interfaz web avanzada para [OpenCode](https://opencode.ai/) (el agente de IA de SST) con soporte para múltiples proveedores de IA, automatización de navegador con Playwright, VNC remoto y proxy con autenticación.

---

## 🚀 Deploy en EasyPanel

### Paso 1 — Subir a GitHub

```bash
# Configura tus datos
export GITHUB_USER="tu-usuario"
export GITHUB_REPO="opencode-evolved"
export GITHUB_PERSONAL_ACCESS_TOKEN="ghp_..."

# Push al repo
bash bin/push-to-github.sh
```

### Paso 2 — Crear servicio en EasyPanel

1. Entra a tu panel de EasyPanel
2. **New Project** → dale un nombre (ej. `opencode`)
3. **Add Service** → **App**
4. **Source**: GitHub → conecta tu cuenta → selecciona el repo
5. **Branch**: `main`
6. EasyPanel detecta el `Dockerfile` automáticamente ✅

### Paso 3 — Configurar variables de entorno

En la pestaña **Environment** del servicio, agrega al menos **una** API key:

| Variable | Descripción | Link |
|---|---|---|
| `FREEMODEL_API_KEY` | GPT-4o **gratis** ⭐ | [freemodel.dev](https://freemodel.dev) |
| `ANTHROPIC_API_KEY` | Claude 3/4 | [console.anthropic.com](https://console.anthropic.com) |
| `OPENAI_API_KEY` | GPT-4o | [platform.openai.com](https://platform.openai.com/api-keys) |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini | [aistudio.google.com](https://aistudio.google.com/app/apikey) |
| `GROQ_API_KEY` | Llama/Mixtral **gratis** | [console.groq.com](https://console.groq.com/keys) |
| `OPENROUTER_API_KEY` | 60+ modelos | [openrouter.ai](https://openrouter.ai/keys) |

**Variable opcional de seguridad:**
```
OPENCODE_SERVER_PASSWORD=mi-contraseña-segura
```

### Paso 4 — Configurar dominio

1. Ve a la pestaña **Domains**
2. Agrega tu dominio o usa el subdominio de EasyPanel
3. Puerto: `3000`
4. Activa HTTPS ✅

### Paso 5 — Deploy

Haz click en **Deploy** y espera ~5-10 minutos (la primera vez descarga todas las dependencias).

---

## 🛠 Arquitectura

```
Internet → Puerto 3000 (Proxy)
              ├── Autenticación (si OPENCODE_SERVER_PASSWORD)
              ├── /api/* → OpenCode interno (puerto 3001)
              ├── /__vision → API de visión multi-proveedor
              └── UI standalone (fallback) o UI React compilada

Web Operator → Puerto 3001
              └── Playwright Chromium (automatización de navegador)

VNC → Puerto 6080
              └── noVNC (pantalla virtual remota)
```

## 📁 Estructura del proyecto

```
Hello-World/
├── Dockerfile              ← Imagen Docker completa
├── docker-compose.yml      ← Para desarrollo local
├── easypanel.yml           ← Config para EasyPanel
├── docker/start.sh         ← Script de inicio del contenedor
├── .env.example            ← Plantilla de variables (copia a .env)
├── artifacts/
│   ├── opencode-ui/        ← Proxy + Frontend React
│   │   ├── proxy.mjs       ← Proxy principal (Express)
│   │   ├── ui/index.html   ← UI standalone (sin build)
│   │   └── src/            ← Código fuente React
│   └── web-operator/       ← Automatización con Playwright
├── bin/
│   ├── push-to-github.sh   ← Script para subir a GitHub
│   ├── mcp-body.mjs        ← MCP server (cuerpo digital)
│   └── mcp-computer.mjs    ← MCP server (computer tools)
└── .config/opencode/
    └── opencode.json       ← Config de OpenCode (modelos, MCP)
```

## 🐳 Desarrollo local

```bash
# Copia y edita el .env
cp .env.example .env

# Inicia con Docker Compose
docker compose up -d

# Abre http://localhost:3000
```

## 🔧 Solución de problemas

### El contenedor no inicia
- Revisa los logs en EasyPanel → Service → Logs
- Verifica que tengas al menos una API key configurada

### OpenCode no se conecta
- El primer inicio puede tardar hasta 2 minutos
- Recarga la página

### Error 502 Bad Gateway
- OpenCode todavía está iniciando, espera 30-60 segundos
- La UI standalone (`ui/index.html`) funciona aunque OpenCode no esté listo

### Problemas de memoria
- Aumenta `memoryLimit` en `easypanel.yml` (mínimo 2048 MB)
- Deshabilita Ollama si no lo necesitas

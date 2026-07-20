# 🌐 Operator Pro + OpenCode Web Interface

## Configuración para la Interfaz Web de OpenCode

### 1. Encuentra tu archivo de configuración

OpenCode web usa el mismo archivo de configuración que la CLI. Busca:

```bash
# Opción 1: En tu proyecto
opencode.json

# Opción 2: Configuración global
~/.config/opencode/config.json
# o
~/.opencode/config.json
```

### 2. Agrega Operator Pro como MCP Server

Copia este contenido en tu `opencode.json`:

```json
{
  "mcpServers": {
    "operator": {
      "command": "node",
      "args": ["/ruta/absoluta/a/operator/operator/mcp-server.mjs"],
      "env": {
        "OPENCODE_ZEN_API_KEY": "tu_api_key_aqui",
        "FACEBOOK_ACCESS_TOKEN": "tu_token_aqui",
        "FACEBOOK_AD_ACCOUNT": "tu_ad_account_id"
      }
    }
  }
}
```

**IMPORTANTE:** Cambia `/ruta/absoluta/a/operator/` por la ruta real donde clonaste Operator Pro.

Para encontrar la ruta:
```bash
cd /ruta/a/operator
pwd
# Copia la salida y pégala en el JSON
```

### 3. Inicia OpenCode Web

```bash
# Si usas opencode CLI con web UI
opencode --web

# O si tienes un script
npm run opencode:web

# O directamente
npx opencode web
```

Abre tu navegador en `http://localhost:3000` (o el puerto que te indique).

### 4. Verifica que Operator está conectado

En la interfaz web de OpenCode:

1. **Panel lateral izquierdo** → Busca "MCP Servers" o "Tools"
2. Deberías ver **"operator"** con un indicador verde ✅
3. Click en "operator" para ver las **30+ herramientas disponibles**

### 5. ¡Usa Operator desde el chat!

Escribe en el chat de OpenCode web:

```
Crea una campaña en Facebook Ads llamada "Venta de Cursos" 
con objetivo de tráfico y presupuesto de $10,000 COP diarios. 
Guárdala como borrador.
```

OpenCode va a:
1. Ver que tiene la herramienta `operator_fb_create_campaign`
2. Llamarla con los parámetros correctos
3. Mostrarte el resultado en el chat

---

## 🎯 Cómo se ve en la Web UI

### Panel de herramientas (izquierda)

```
┌─────────────────────────────────┐
│ 🔧 MCP Servers                  │
├─────────────────────────────────┤
│ ✅ operator (30 tools)          │
│    ├─ operator_run_task         │
│    ├─ operator_terminal         │
│    ├─ operator_browser_navigate │
│    ├─ operator_fb_create_...    │
│    ├─ operator_fb_analyze_...   │
│    └─ ... 25 more               │
└─────────────────────────────────┘
```

### Chat (centro)

```
┌────────────────────────────────────────────────────────────┐
│ Tú:                                                         │
│ Analiza mis métricas de Facebook Ads de los últimos 7 días │
│ y dame recomendaciones                                      │
│                                                             │
│ OpenCode:                                                   │
│ Voy a usar operator_fb_analyze_metrics para obtener tus    │
│ métricas...                                                 │
│                                                             │
│ 🔧 Calling: operator_fb_analyze_metrics                    │
│    { date_preset: "last_7d" }                              │
│                                                             │
│ ✅ Result:                                                  │
│ 📊 REPORTE DE FACEBOOK ADS                                  │
│ Campañas: 5                                                 │
│ Inversión: $125,000 COP                                     │
│ CTR Promedio: 2.3%                                          │
│                                                             │
│ 💡 INSIGHTS:                                                │
│ 🏆 Mejor campaña: "Promo Enero" (CTR 4.2%)                │
│ ⚠️ "Campaña Vieja" tiene CTR bajo (0.8%) - considera...   │
└────────────────────────────────────────────────────────────┘
```

---

## 💡 Ejemplos de comandos en la Web UI

### Facebook Ads
```
Crea 3 variaciones de campaña para vender cursos online
```
```
¿Cuáles son mis campañas con mejor CTR?
```
```
Pausa todas las campañas con CPC mayor a $2000
```
```
Inicia el auto-optimizador de campañas
```

### Navegador
```
Abre Facebook Ads Manager y toma un screenshot
```
```
Ve a google.com y busca "mejores prácticas de marketing 2026"
```

### Terminal
```
Ejecuta git status en el proyecto actual
```
```
¿Qué procesos están consumiendo más memoria?
```

### Archivos
```
Lee el archivo config.json y muéstrame las API keys configuradas
```
```
Busca todos los archivos .env en el proyecto
```

### Sistema
```
¿Cómo está el servidor? Muéstrame CPU, RAM y disco
```
```
Toma un screenshot de la pantalla actual
```

### Tareas autónomas
```
Investiga en la web las tendencias de IA 2026, 
crea un resumen en markdown, y guarda el archivo
```

---

## 🔧 Troubleshooting

### "operator" no aparece en MCP Servers

1. Verifica que la ruta en `args` sea **absoluta** (no relativa)
2. Asegúrate de que Node.js esté instalado: `node --version`
3. Verifica permisos: `chmod +x operator/mcp-server.mjs`
4. Reinicia OpenCode web

### "Tool execution failed"

1. Revisa la consola del navegador (F12) para ver errores
2. Verifica que Operator Pro tenga las dependencias instaladas:
   ```bash
   cd /ruta/a/operator
   npm install
   ```
3. Si es un error de Facebook, verifica que el token sea válido

### Las herramientas no responden

1. Verifica que el MCP server esté corriendo:
   ```bash
   # En otra terminal
   ps aux | grep mcp-server
   ```
2. Revisa los logs de OpenCode
3. Intenta recargar la página web

---

## 🎨 Tips para la Web UI

1. **Usa lenguaje natural** — No necesitas saber los nombres de las herramientas
2. **Sé específico** — "Crea una campaña de tráfico con $5000 COP" es mejor que "Crea una campaña"
3. **Pide confirmación** — "Antes de publicar, muéstrame cómo quedó"
4. **Usa el contexto** — OpenCode recuerda la conversación, puedes decir "ahora pausa esa campaña"
5. **Combina herramientas** — "Analiza métricas, crea una campaña basada en los resultados, y guárdala como borrador"

---

## 📱 Acceso remoto a la Web UI

Si quieres acceder a la web UI de OpenCode desde tu celular u otra computadora:

```bash
# Expone OpenCode web con ngrok
ngrok http 3000

# Te dará una URL como:
# https://abc123.ngrok-free.app

# Ábrela en cualquier dispositivo
```

Ahora puedes controlar Operator Pro desde tu celular vía OpenCode web. 🚀

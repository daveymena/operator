# 🚀 Guía Rápida: Operator Pro + OpenCode Zen (Gratis)

## ¿Qué es OpenCode Zen?

OpenCode Zen es un gateway de modelos de IA que ofrece **7 modelos gratuitos** sin necesidad de tarjeta de crédito. Es perfecto para probar Operator Pro sin costos.

## Modelos Gratuitos Disponibles

| Modelo | ID | Descripción | Mejor Para |
|--------|-----|-------------|------------|
| **Big Pickle** ⭐ | `big-pickle` | Modelo stealth grande (más potente) | Tareas complejas, razonamiento |
| **Nemotron 3 Ultra** | `nemotron-3-ultra-free` | NVIDIA 120B params | Código, razonamiento técnico |
| **MiniMax M3** | `minimax-m3-free` | Excelente para contenido largo | Documentos, análisis |
| **DeepSeek V4 Flash** | `deepseek-v4-flash-free` | Rápido y eficiente | Respuestas rápidas |
| **MiMo V2.5** | `mimo-v2.5-free` | Xiaomi MiMo | Generación de código |
| **Qwen 3.6 Plus** | `qwen3.6-plus-free` | Alibaba Qwen | Multilingüe |
| **North Mini Code** | `north-mini-code-free` | Optimizado para código | Programación |

**Límites del Free Tier:**
- 100 requests por día
- Todos los modelos disponibles
- Sin tarjeta de crédito requerida

## Paso 1: Obtener API Key Gratis

1. Ve a **https://opencode.ai/auth**
2. Regístrate con email o GitHub
3. Ve al Dashboard y copia tu API key (formato: `sk-...`)

## Paso 2: Configurar Operator Pro

```bash
# Clonar el repositorio (si aún no lo tienes)
git clone <tu-repo>
cd operator

# Instalar dependencias
npm install

# Crear archivo de configuración
mkdir -p config
cat > config/.env << 'EOF'
# OpenCode Zen API Key (GRATIS)
OPENCODE_ZEN_API_KEY=tu_api_key_aqui

# Servidor
OPERATOR_PORT=3000
OPERATOR_HOST=0.0.0.0
EOF

# Editar y pegar tu API key
nano config/.env
```

## Paso 3: Probar la Integración

```bash
# Ejecutar el test completo
node test-opencode-zen.mjs
```

Este script probará:
- ✅ Cada modelo gratuito con un prompt de prueba
- ✅ La integración completa con Operator Pro
- ✅ La capacidad de planificación autónoma

## Paso 4: Usar Operator Pro

### Modo CLI (Tareas Autónomas)

```bash
# Ejemplo 1: Búsqueda web
node operator.mjs "busca en google los mejores frameworks de IA 2026 y dame un resumen"

# Ejemplo 2: Automatización de código
node operator.mjs "crea un script de Python que descargue imágenes de una URL"

# Ejemplo 3: Análisis de sistema
node operator.mjs "lista todos los procesos corriendo y mata el que use más memoria"

# Ejemplo 4: Navegación web
node operator.mjs "abre google.com, busca 'autonomous agents' y haz screenshot"
```

### Modo Servidor (Dashboard Web)

```bash
# Iniciar servidor
node operator.mjs --server

# Abrir en navegador:
# Dashboard: http://localhost:3000/dashboard
# API: http://localhost:3000/api
# Health: http://localhost:3000/health
```

### Modo Acción Directa

```bash
# Screenshot
node operator.mjs --action=screenshot

# Navegar a URL
node operator.mjs --action=browser_goto --url=https://google.com

# Ejecutar comando
node operator.mjs --action=terminal_exec --command="ls -la"

# Info del sistema
node operator.mjs --action=sysinfo
```

## Paso 5: Forzar OpenCode Zen como Backend

Si quieres usar específicamente OpenCode Zen (en lugar de auto-selección):

```bash
node operator.mjs --brain=opencodeZen "tu tarea aquí"
```

O en el código:

```javascript
const brain = new Brain({
  backend: 'opencodeZen',
  groqKey: process.env.GROQ_API_KEY
});
```

## Ejemplos de Tareas que Puedes Automatizar

### 🌐 Web Automation
```bash
node operator.mjs "ve a amazon.com, busca 'laptop', y extrae los precios de los primeros 5 resultados"
node operator.mjs "abre linkedin.com y busca perfiles de 'AI engineer' en Colombia"
```

### 🖥️ Desktop Control
```bash
node operator.mjs "toma un screenshot y dime qué aplicaciones están abiertas"
node operator.mjs "abre vscode, crea un nuevo archivo Python y escribe un hello world"
```

### ⚡ Server Operations
```bash
node operator.mjs "revisa el uso de disco y limpia archivos temporales mayores a 7 días"
node operator.mjs "haz un backup de la carpeta /var/log y comprímelo"
```

### 🤖 Multi-Step Workflows
```bash
node operator.mjs "busca las últimas noticias de IA, crea un resumen en markdown, y guárdalo en ~/ai-news.md"
```

## Troubleshooting

### Error: "API key inválida"
- Verifica que copiaste la key completa (empieza con `sk-`)
- Asegúrate de no tener espacios extra en el .env

### Error: "Rate limit exceeded"
- El free tier tiene 100 requests/día
- Espera unos minutos o usa otro modelo

### Error: "Model not found"
- Algunos modelos pueden estar temporalmente fuera de servicio
- Prueba con otro modelo de la lista

### Error: "Network timeout"
- Verifica tu conexión a internet
- OpenCode Zen puede tener latencia alta en algunas regiones

## Comparación de Modelos Gratuitos

| Modelo | Velocidad | Calidad | Contexto | Recomendado Para |
|--------|-----------|---------|----------|------------------|
| Big Pickle | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | 128K | **Uso general** (mejor opción) |
| Nemotron 3 Ultra | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 128K | Código técnico |
| MiniMax M3 | ⭐⭐⭐ | ⭐⭐⭐⭐ | 1M | Documentos largos |
| DeepSeek V4 Flash | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | 32K | Respuestas rápidas |
| MiMo V2.5 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 64K | Generación de código |
| Qwen 3.6 Plus | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | 128K | Multilingüe |

## Próximos Pasos

1. **Prueba diferentes modelos** para ver cuál funciona mejor para tu caso de uso
2. **Crea plugins personalizados** en `operator/plugins/`
3. **Integra con otras APIs** usando el engine de filesystem
4. **Automatiza workflows completos** combinando múltiples acciones

## Soporte

- **Documentación completa**: README.md
- **API Reference**: http://localhost:3000/api (con servidor corriendo)
- **Dashboard**: http://localhost:3000/dashboard
- **Issues**: GitHub Issues del repositorio

---

**¡Listo! Ahora tienes Operator Pro funcionando con modelos de IA gratuitos y potentes.** 🎉

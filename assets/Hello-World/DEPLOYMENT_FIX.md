# 🔧 Solución: Frontend no se muestra en EasyPanel

## Arquitectura del Proyecto

Este proyecto tiene **3 servicios**:

1. **OpenCode** (puerto interno 3001) - IDE con interfaz nativa
2. **Proxy** (puerto 3000) - Proxy transparente a OpenCode + shell personalizado
3. **Web Operator** (puerto 3001) - Interfaz web para automatización de navegador

## Problema Identificado

El frontend NO se muestra por una de estas razones:

### ✅ Causa 1: OpenCode no inicia correctamente
- OpenCode requiere tiempo para iniciar (hasta 60 segundos)
- Si OpenCode falla, el proxy muestra error 502 "Bad Gateway"
- Necesita suficiente memoria RAM (mínimo 2GB)

### ✅ Causa 2: Dominios mal configurados en EasyPanel
- El dominio debe apuntar al puerto **3000** (proxy)
- NO al puerto 3001 (OpenCode interno)

### ✅ Causa 3: Dependencias no instaladas
- OpenCode debe instalarse globalmente: `npm install -g opencode-ai`
- Si falla la instalación, OpenCode no existe y el contenedor falla

## Cambios Realizados

### 1. **Dockerfile** - Build del shell personalizado
```dockerfile
# Instalar y construir el shell personalizado
RUN cd artifacts/opencode-ui && npm install
RUN cd artifacts/opencode-ui && npm run build
```

Esto construye los archivos CSS/JS personalizados que se inyectan en OpenCode.

### 2. **proxy.mjs** - Revertido a configuración correcta
- Hace proxy completo a OpenCode (interfaz nativa)
- Inyecta shell personalizado desde `public/shell.css` y `public/shell.js`
- NO sirve un frontend React propio

## Diagnóstico: Revisar Logs de EasyPanel

### ✅ Logs correctos (todo funciona):

```bash
# 1. Instalación exitosa
Successfully installed opencode-ai

# 2. OpenCode iniciado
Starting OpenCode engine on port 3001...
OpenCode ready (15s)

# 3. Web Operator iniciado
Starting Web Operator on port 3001...
Web Operator ready

# 4. Proxy funcionando
OpenCode Evolved shell corriendo en http://0.0.0.0:3000
Proxying a OpenCode en http://localhost:3001
```

### ❌ Error 1: OpenCode no instalado
```bash
/bin/sh: opencode: not found
# o
Error: Cannot find module 'opencode-ai'
```

**Solución:** El RUN global falló. Verifica que la imagen base tenga Node.js 20+

### ❌ Error 2: OpenCode no inicia
```bash
Waiting for OpenCode to start (up to 60s)...
[timeout sin ver "OpenCode ready"]
```

**Solución:** Aumenta memoria en easypanel.yml a 4096 MB

### ❌ Error 3: Proxy muestra 502
```bash
OpenCode Evolved shell corriendo en http://0.0.0.0:3000
[pero no dice "OpenCode ready"]
```

**Solución:** OpenCode no respondió a tiempo, reinicia el servicio

## Soluciones Paso a Paso

### Solución 1: Aumentar recursos en EasyPanel

Edita `easypanel.yml` y aumenta la memoria:

```yaml
resources:
  memoryLimit: 4096  # Aumentar de 2048 a 4096
  cpuLimit: 2
```

### Solución 2: Verificar configuración de dominios

En EasyPanel → Tu servicio → Domains:

| Dominio | Puerto | Propósito |
|---------|--------|-----------|
| `opencode.tudominio.com` | **3000** | Interfaz principal |
| `operator.tudominio.com` | 3001 | Web Operator (opcional) |
| `mimo.tudominio.com` | 4000 | MiMo Code (opcional) |

### Solución 3: Redesplegar con los cambios

```bash
# 1. Hacer commit de los cambios
git add .
git commit -m "Fix: Construir shell personalizado + diagnostics"
git push origin main

# 2. En EasyPanel:
#    - Ve a tu servicio OpenCode
#    - Click en "Rebuild"
#    - ESPERA 10-15 minutos (la instalación es lenta)
#    - Monitorea los logs en tiempo real

# 3. Busca estas líneas en los logs:
#    ✅ "Successfully installed opencode-ai"
#    ✅ "OpenCode ready (Xs)"
#    ✅ "OpenCode Evolved shell corriendo en http://0.0.0.0:3000"
```

### Solución 4: Probar localmente (antes de desplegar)

```bash
# 1. Construir imagen Docker
docker build -t opencode-test .

# 2. Ejecutar con tus variables de entorno
docker run -p 3000:3000 -p 3001:3001 \
  -e FREEMODEL_API_KEY=tu_key_aqui \
  -e OPENAI_API_KEY=tu_key_aqui \
  opencode-test

# 3. Esperar hasta ver:
#    "OpenCode ready"
#    "OpenCode Evolved shell corriendo en http://0.0.0.0:3000"

# 4. Abrir en navegador:
http://localhost:3000        # ← Interfaz principal de OpenCode
http://localhost:3001        # ← Web Operator (navegador AI)
```

## Verificar que Funciona

Después del redespliegue:

### ✅ Caso exitoso:
1. Visita `https://opencode.tudominio.com`
2. Deberías ver la interfaz de OpenCode (similar a VS Code)
3. Puede pedirte login si configuraste `OPENCODE_SERVER_PASSWORD`
4. La interfaz debe ser **interactiva** (puedes abrir archivos, escribir código)

### ❌ Caso fallido:
1. Ves error "502 Bad Gateway" → OpenCode no inició
2. Ves "Cannot GET /" → Dominio apunta a puerto incorrecto
3. Página en blanco → Revisa Console en DevTools (F12)

## Endpoints Disponibles

Después de desplegar correctamente:

| URL | Descripción |
|-----|-------------|
| `https://opencode.tudominio.com` | Interfaz principal de OpenCode |
| `https://opencode.tudominio.com/__shell/shell.css` | Shell personalizado CSS |
| `https://opencode.tudominio.com/__shell/shell.js` | Shell personalizado JS |
| `https://opencode.tudominio.com/__vision` | API de visión (convierte imágenes a texto) |
| `https://opencode.tudominio.com/__login` | Login (si usas password) |
| `https://operator.tudominio.com` | Web Operator (navegador AI) |
| `https://operator.tudominio.com/api/health` | Health check del Web Operator |

## Estructura Correcta Después del Build

```
/app/
├── docker/start.sh                    ← Script de inicio
├── artifacts/
│   ├── opencode-ui/
│   │   ├── dist/public/               ← Shell construido (CSS/JS)
│   │   ├── proxy.mjs                  ← Proxy a OpenCode
│   │   └── public/
│   │       ├── shell.css              ← Estilos personalizados
│   │       └── shell.js               ← Scripts personalizados
│   └── mcp-*.mjs                      ← MCP tools
├── web-operator/
│   ├── api-server.js                  ← Servidor Web Operator
│   └── public/index.html              ← UI del Web Operator
└── node_modules/
    └── opencode-ai/                   ← OpenCode instalado globalmente
```

## Acceso SSH al Contenedor (para debug)

Si tienes acceso SSH al contenedor de EasyPanel:

```bash
# 1. Verificar que OpenCode existe
which opencode
# Debe mostrar: /usr/local/bin/opencode

# 2. Ver si OpenCode está corriendo
ps aux | grep opencode
# Debe mostrar el proceso

# 3. Verificar el puerto del proxy
curl -I http://localhost:3000
# Debe responder HTTP 200 o 302

# 4. Verificar OpenCode interno
curl -I http://localhost:3001
# Debe responder HTTP 200

# 5. Ver logs en tiempo real
tail -f /app/artifacts/opencode-ui/*.log
```

## Troubleshooting Avanzado

### Problema: "opencode: command not found"

El npm install global falló. Verifica:
```dockerfile
# En Dockerfile debe existir:
RUN npm install -g opencode-ai @mimo-ai/cli pm2
```

### Problema: OpenCode inicia pero proxy no conecta

Verifica que `OPENCODE_INTERNAL_PORT` coincida:
```bash
# En start.sh:
OC_PORT="$(( PROXY_PORT + 1 ))"  # Si PROXY_PORT=3000 → OC_PORT=3001

# En proxy.mjs:
const OPENCODE_PORT = parseInt(process.env.OPENCODE_INTERNAL_PORT || "21294");
```

### Problema: Página blanca con errores en Console

Abre DevTools (F12) → Console. Si ves:
- `ERR_CONNECTION_REFUSED` → Proxy no conecta a OpenCode
- `404 Not Found` → Archivos del shell no existen
- `CORS errors` → Problema de proxy/headers

## Contacto y Soporte

Si después de seguir estos pasos sigue sin funcionar:

1. **Copia los logs completos** del build de EasyPanel
2. **Copia los logs de runtime** (primeros 5 minutos)
3. **Screenshot del error** que ves en el navegador
4. **DevTools Console** (F12 → Console → screenshot)
5. **Configuración de dominios** en EasyPanel (screenshot)

Con esa información podremos diagnosticar el problema exacto.

---

## Resumen

- ✅ OpenCode es un IDE (no React), usa interfaz nativa
- ✅ El proxy hace forward transparente a OpenCode
- ✅ El "frontend" es solo CSS/JS que se inyecta en OpenCode
- ✅ Debe apuntar al puerto 3000 (proxy), no 3001 (OpenCode)
- ✅ Requiere 2-4 GB RAM y tiempo de inicio (60s)
- ✅ Web Operator es un servicio separado en puerto 3001

**El problema más común es que OpenCode no inicia por falta de recursos o timeout.**

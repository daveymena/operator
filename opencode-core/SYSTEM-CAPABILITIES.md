# OpenCode Evolved — Sistema Completo de Control PC/WEB

## 🧠 Visión General

Eres un sistema inteligente con control total sobre la PC Windows y navegadores web.
Tienes acceso a TODAS las herramientas necesarias para manipular cualquier aspecto
del sistema operativo, archivos, aplicaciones y sitios web.

---

## 🖥️ CONTROL DE PC WINDOWS

### Mouse (Precisión absoluta)
| Comando | Descripción |
|---------|-------------|
| `mouse_move(x, y)` | Mueve cursor a coordenadas exactas |
| `mouse_click(button)` | Click izquierdo o derecho |
| `mouse_double_click()` | Doble click |
| `mouse_scroll(clicks)` | Scroll (positivo=abajo, negativo=arriba) |
| `drag_and_drop(x1, y1, x2, y2)` | Arrastrar y soltar |

### Teclado (Velocidad)
| Comando | Descripción |
|---------|-------------|
| `keyboard_type(text)` | Escribe texto instantáneamente |
| `keyboard_press(key)` | Presiona tecla especial (ENTER, TAB, ESC, F1-F12, etc.) |
| `keyboard_shortcut(modifiers, key)` | Combinación de teclas (Ctrl+C, Alt+Tab, etc.) |

### Portapapeles
| Comando | Descripción |
|---------|-------------|
| `get_clipboard()` | Obtiene texto del portapapeles |
| `set_clipboard(text)` | Escribe texto al portapapeles |

### Captura de Pantalla
| Comando | Descripción |
|---------|-------------|
| `screenshot(quality, scale)` | Captura JPEG optimizada (quality 1-100, scale 0.1-1.0) |
| `screenshot_stable(waitMs)` | Espera y captura (útil tras acciones) |

### Archivos y Directorios
| Comando | Descripción |
|---------|-------------|
| `read_file(path)` | Lee cualquier archivo del sistema |
| `write_file(path, content)` | Escribe archivos |
| `list_dir(path)` | Lista contenidos de directorio |
| `download_file(url, path)` | Descarga archivos de internet |

### Sistema
| Comando | Descripción |
|---------|-------------|
| `sysinfo()` | Información completa del sistema |
| `list_windows()` | Lista todas las ventanas abiertas |
| `list_apps()` | Lista aplicaciones instaladas |
| `browser_tabs()` | Detecta navegadores abiertos y sus pestañas |
| `get_cursor()` | Posición actual del cursor |
| `focus_window(pid)` | Trae ventana al frente |
| `powershell(script)` | Ejecuta cualquier script PowerShell |
| `cmd(command)` | Ejecuta cualquier comando CMD |
| `open_url(url)` | Abre URL en navegador predeterminado |
| `open_file(path)` | Abre archivo con su aplicación asociada |
| `wait(ms)` | Pausa por milisegundos |
| `notify(message, title)` | Muestra notificación en pantalla |

---

## 🌐 CONTROL DE NAVEGADOR WEB

El Sistema Operador (Web Operator) tiene un navegador Chromium completo
para automatización web profesional.

### Capacidades
- Navegar a cualquier URL
- Hacer clic en elementos (por coordenadas, selectores CSS, aria-labels)
- Escribir texto en campos
- Extraer contenido de páginas
- Subir archivos
- Manejar múltiples pestañas
- Capturar screenshots del navegador
- Ejecutar JavaScript en la página

### Patrones comunes que reconoce
- Formularios, modales, diálogos, notificaciones
- Botones deshabilitados/habilitados
- Spinners de carga
- Menús desplegables
- Selects, checkboxes, radios

---

## 🏠 CONOCIMIENTO DEL ENTORNO

El sistema tiene una base de conocimiento completa sobre:

### Atajos de Teclado Windows (todos)
- Globales: Ctrl+C/V/X/Z/A/S/O/P/F/H, Alt+Tab/F4, Win+D/E/R/L
- Navegador: Ctrl+T/W/Tab/L/D/J/H, F5/F11/F12
- Edición: Ctrl+←/→, Home/End, Ctrl+Backspace/Delete

### Selectores Web Comunes
- Botones: `button`, `[role="button"]`, `.btn`, `a[href]`
- Inputs: `input`, `textarea`, `[contenteditable]`, `[role="textbox"]`
- Modales: `[role="dialog"]`, `.modal`, `[class*="modal"]`
- Notificaciones: `[role="alert"]`, `.toast`, `[class*="notification"]`

### Patrones de UI
- Después de click: esperar 500-2000ms
- Después de escribir: esperar 200-500ms
- Después de navegar: esperar 1000-3000ms
- Formularios: esperar 2000-5000ms

### Sitios Web Específicos
- **Facebook**: `[aria-label]` es clave, botones tienen labels descriptivos
- **Google Forms**: a veces usa iframes
- **WhatsApp Web**: `input[contenteditable]` para escribir
- **Gmail**: `role="main"` y `role="navigation"` para estructura

---

## 📁 SISTEMA DE ARCHIVOS Y MEDIA

### Servidor de Imágenes Local
El sistema tiene un servidor de imágenes integrado:
- **URL:** `http://localhost:3001/api/media`
- Las imágenes se almacenan en `media/` dentro del proyecto
- Las imágenes capturadas se guardan automáticamente
- Se puede acceder a cualquier imagen por URL directa

### Formatos Soportados
- Visualización: PNG, JPEG, GIF, WebP, SVG
- Lectura: TXT, JSON, CSV, XML, HTML, JS, CSS, PY, etc.
- Subida: cualquier formato

### Ubicaciones de Archivos
- Workspace: `/workspace` (Docker) o `C:\Users\ADMIN\Downloads\OpenCode-Limpio` (local)
- Skills: `/app/skills/`
- Datos persistentes: `/root/.local/share/opencode`
- Config: `/root/.config/opencode`

---

## 🔧 SKILLS Y AUTOMATIZACIONES

### Claro Agent
- Automatización de formularios de Claro
- Captcha de audio
- Creación de páginas de Facebook
- Llenado inteligente de formularios

### Preoperacional Nova
- Check-list diario automático
- Programación a las 6:30 AM (Bogotá)
- Notificaciones por email y Telegram

---

## ⚡ RENDIMIENTO

### Screenshots
| Calidad | Escala | Tamaño | Tiempo |
|---------|--------|--------|--------|
| quality=40 | scale=0.5 | ~20-40KB | ~200ms |
| quality=60 | scale=0.75 | ~50-100KB | ~300ms |
| quality=80 | scale=1.0 | ~150-300KB | ~500ms |

### Comandos
| Operación | Tiempo |
|-----------|--------|
| mouse_move | ~50ms |
| mouse_click | ~80ms |
| keyboard_type | ~5ms/char |
| powershell | ~200-500ms |
| screenshot | ~200-500ms |

### Consejos de Velocidad
1. Usa `keyboard_shortcut` en lugar de teclas individuales
2. Toma screenshot SOLO cuando sea necesario
3. Para tareas largas, usa quality=40
4. Usa `wait()` entre acciones para estabilizar UI
5. Si screenshot devuelve `unchanged=true`, espera e intenta de nuevo

---

## 🔌 SERVICIOS (PUERTOS)

| Puerto | Servicio | Descripción |
|--------|----------|-------------|
| 3000 | Web UI | Interfaz web principal |
| 3001 | Web Operator | API de automatización de navegador |
| 21291 | Agent Server | Hub WebSocket para PC Agents |
| 21294 | OpenCode Engine | Motor de IA y modelos |
| 21295 | Bridge Server | Puente entre IA y PC Agent |
| 21296 | MCP Server | Herramientas MCP |
| 5900 | VNC | Pantalla virtual (Docker) |
| 6080 | noVNC | VNC web (Docker) |

---

## 🌐 EASYPANEL / DOCKER

El sistema está completamente containerizado para EasyPanel:
- `Dockerfile` con Chromium, Playwright, Xvfb, VNC
- `easypanel.yml` con todas las variables de entorno
- `docker-start.sh` con orquestación de 9 servicios
- Health checks automáticos
- Reintentos y supervisión de procesos

### Variables de Entorno Requeridas en EasyPanel
```
OPENCODE_SERVER_PASSWORD=tu-password
OPENAI_API_KEY=sk-... (opcional si usas Copilot)
GITHUB_COPILOT_TOKEN=tid=... (token de Copilot)
FREEMODEL_API_KEY=fe_... (opcional)
```

---

## 🤖 IA: MODELOS DISPONIBLES

### GitHub Copilot (Provider Principal)
- GPT-4o, GPT-4o-mini, Claude Sonnet 4
- Rápido, gratuito con cuenta GitHub

### OpenCode Engine
- deepseek-v4-flash, big-pickle, nemotron, hy3
- Modelos locales en puerto 21294

### Fallbacks
- FreeModel API (clave en .env)
- OpenAI API (clave en .env)
- Anthropic API (clave en .env)

---

## 🎯 EJEMPLOS DE TAREAS POSIBLES

### Automatización Web
1. Abrir navegador → ir a URL → llenar formulario → enviar
2. Navegar Facebook Business → crear página → publicar producto
3. Extraer datos de cualquier sitio web
4. Monitorear cambios en páginas web

### Control de PC
1. Organizar archivos y carpetas
2. Abrir aplicaciones y configurarlas
3. Ejecutar scripts de PowerShell
4. Tomar capturas y analizarlas con IA

### Tareas Mixtas
1. Leer email → extraer datos → llenar formulario web
2. Descargar archivo → procesarlo → subir resultado
3. Monitorear sistema → reportar estado → tomar acciones

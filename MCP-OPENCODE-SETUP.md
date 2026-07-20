# 🔌 Integración con OpenCode vía MCP

## ¿Qué es esto?

Esto permite controlar **Operator Pro** directamente desde la terminal de **OpenCode**.

Escribes en OpenCode:
```
> Crea una campaña en Facebook Ads para vender cursos con presupuesto de $10,000 COP
```

Y OpenCode usa Operator Pro automáticamente para:
1. Conectarse a Facebook Ads Manager
2. Crear la campaña con los parámetros correctos
3. Verificar que se creó correctamente
4. Reportarte el resultado

## Configuración

### 1. Encuentra la ruta absoluta de Operator Pro

```bash
pwd
# Ejemplo: /home/tu-usuario/operator
```

### 2. Edita la configuración de OpenCode

Busca el archivo de configuración de OpenCode. Puede estar en:
- `~/.config/opencode/config.json`
- `~/.opencode/config.json`
- O en la carpeta de tu proyecto: `opencode.json`

Agrega:

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

### 3. Reinicia OpenCode

```bash
# En la terminal de OpenCode
/reload
```

### 4. ¡Listo! Ahora OpenCode tiene acceso a 30+ herramientas de Operator

## Herramientas disponibles en OpenCode

Una vez configurado, puedes pedirle a OpenCode:

### 🎯 Tareas Autónomas
```
> Ejecuta una tarea: busca en Google los mejores cursos de IA y guarda los resultados en un archivo
```
Usa: `operator_run_task`

### 💻 Terminal
```
> Ejecuta "git status" en el proyecto
> Instala las dependencias con npm install
> Despliega a producción con docker compose up -d
```
Usa: `operator_terminal`

### 🌐 Navegador
```
> Abre Facebook Ads Manager
> Toma un screenshot del navegador
> Haz click en el botón "Crear campaña"
> Escribe "Mi campaña" en el campo de nombre
```
Usa: `operator_browser_navigate`, `operator_browser_click`, `operator_browser_type`, `operator_browser_screenshot`

### 📊 Facebook Ads
```
> Crea una campaña de tráfico con presupuesto $5000 COP
> Analiza las métricas de mis campañas de los últimos 7 días
> Segmenta una audiencia para Colombia, 22-45 años, intereses en tecnología
> Crea 5 variaciones de campaña usando el template de e-commerce
```
Usa: `operator_fb_create_campaign`, `operator_fb_analyze_metrics`, `operator_fb_segment_audience`, `operator_fb_bulk_create`

### 🤖 Auto-Optimización
```
> Inicia el auto-optimizador de campañas
> Detén el auto-optimizador
> ¿Hay alertas activas?
```
Usa: `operator_start_auto_optimizer`, `operator_stop_auto_optimizer`, `operator_get_active_alerts`

### 📁 Archivos
```
> Lee el archivo config.json
> Crea un archivo nuevo con este contenido...
> Lista los archivos del directorio
> Busca archivos que contengan "operator"
```
Usa: `operator_read_file`, `operator_write_file`, `operator_list_dir`, `operator_search_files`

### 🖥️ Sistema
```
> ¿Cómo está el sistema? (CPU, RAM, disco)
> ¿Qué ventanas están abiertas?
> ¿Qué procesos están corriendo?
```
Usa: `operator_system_info`, `operator_list_windows`, `operator_list_processes`

### 🌍 HTTP / APIs
```
> Haz un GET a https://api.example.com/data
> Envía un POST con estos datos...
```
Usa: `operator_http_get`, `operator_http_post`

## Ejemplos de workflows completos

### Crear campaña completa desde OpenCode:
```
> Analiza mis métricas de Facebook Ads de los últimos 30 días y basándote en los resultados, 
  crea una nueva campaña optimizada para el objetivo que mejor rendimiento tuvo.
  Nómbrala "Campaña Optimizada [fecha]" con presupuesto 20% mayor al promedio.
```

### Investigar y reportar:
```
> Investiga en la web las tendencias de marketing digital 2026, 
  guarda un resumen en research.md y crea una campaña de Facebook Ads 
  basada en las tendencias encontradas.
```

### Deploy completo:
```
> Ejecuta los tests del proyecto, si pasan haz un build de producción, 
  crea un tag en git con la versión actual, y despliega a producción.
```

## Troubleshooting

### "Tool not found"
- Verifica que la ruta en `args` sea la ruta absoluta correcta
- Asegúrate de que Node.js >= 18 esté instalado

### "Connection refused"
- Verifica que el MCP server se está ejecutando
- Revisa los logs de OpenCode

### "Permission denied"
- Asegúrate de que el archivo mcp-server.mjs tenga permisos de ejecución:
  ```bash
  chmod +x operator/mcp-server.mjs
  ```

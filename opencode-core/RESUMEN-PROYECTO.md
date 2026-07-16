# Resumen del Proyecto OpenCode Evolved

## Arquitectura actual

```
OpenCode Evolved (Docker/EasyPanel)
├── OpenCode Engine      :21294   → modelos locales / zen go
├── Agent Server         :21291   → PC Agents (WebSocket)
├── Bridge Server        :21295   → MiMoCode ↔ PC Agent
├── Web Operator API     :3001    → Playwright + CUA engine
├── Proxy Web UI         :3000    → UI pública expuesta por EasyPanel
├── VNC/noVNC            :5900/6080 → pantalla virtual para debug
└── Skills/
    ├── claro-agent             → órdenes de Claro
    └── preoperacional-nova     → preoperacional diario automático
```

## Puertos

| Servicio | Puerto | Expuesto público |
|----------|--------|------------------|
| Proxy Web UI | 3000 | Sí (dominio principal) |
| Web Operator API | 3001 | No (interno) |
| Agent Server | 21291 | Sí (subdominio `agent-...`) |
| Bridge Server | 21295 | No (interno) |
| OpenCode Engine | 21294 | No (interno) |
| VNC | 5900 | No (interno) |
| noVNC | 6080 | Opcional |

## Cambios recientes (infraestructura)

- `docker-start.sh` refactorizado con puertos fijos, limpieza de procesos,
  supervisor ligero y healthcheck.
- `proxy.mjs` ahora se conecta al agent-server local (`ws://localhost:21291/agent`)
  y no crashea si el agente no está.
- `agent-server.mjs` soporta token opcional (`AGENT_SERVER_TOKEN`) y distingue
  entre agents reales y controllers.
- `easypanel.yml` actualizado con variables de entorno correctas y dominio del
  agent server.
- `pc-agent.mjs` creado: agente de Windows para conectar el PC al agent-server.

## Web Operator / CUA Engine

- `operator-engine.js` ahora usa `ai-client.js` (modelos OpenCode / Copilot / FreeModel).
- Loop autónomo con screenshots anotados, verificación heurística y manejo de errores.
- Nuevo endpoint `/api/run/cua` en `api-server.js` para tareas autónomas.
- Soporte para `headless` en Docker.

## Skills

### claro-agent

- Wrapper en `skills/claro-agent/skill.js`.
- Endpoints:
  - `POST /api/skills/claro/order`
  - `POST /api/skills/claro/run-pending`
  - `GET /api/skills/claro/status`
- Requiere montar el proyecto original en `/app/skills/claro-agent/src`.
- Credenciales por variables de entorno (ver `skills/claro-agent/README.md`).

### preoperacional-nova

- Wrapper en `skills/preoperacional-nova/skill.js`.
- Scheduler diario en `skills/preoperacional-nova/scheduler.js` (6:30 AM Bogotá).
- Endpoints:
  - `POST /api/skills/preoperacional/run`
  - `GET /api/skills/preoperacional/status`
- Requiere montar el proyecto original en `/app/skills/preoperacional-nova/src`.
- Credenciales por variables de entorno (ver `skills/preoperacional-nova/README.md`).

## Configuración (.env)

Ver `.env.example` para todas las variables disponibles. En EasyPanel se
configuran como Environment Variables del servicio. No subas el archivo `.env`
real al repositorio.

## PC Agent (Windows)

Ejecutar en la PC que se quiere controlar:

```bash
set AGENT_SERVER_URL=wss://agent-tudominio.easypanel.host/agent
set AGENT_NAME=PC-Trabajo
set AGENT_TOKEN=tu-token-si-aplica
node pc-agent.mjs
```

Comandos soportados: `screenshot`, `powershell`, `cmd`, `open_url`, `open_file`,
`read_file`, `write_file`, `list_dir`, `mouse_click`, `mouse_move`, `keyboard_type`,
`keyboard_press`, `sysinfo`, `notify`.

## Próximos pasos / mejoras

1. Adaptar los proyectos originales de Claro y Preoperacional a Docker
   (`headless: true`, Chromium del sistema, env vars).
2. Probar el build de Docker localmente.
3. Configurar límites de recursos en EasyPanel.
4. Agregar autenticación de agentes por token si es necesario.

#!/bin/bash
set -o pipefail
set +e

# ============================================================
# OpenCode Evolved — Docker Startup Orchestrator
# Inicia todos los subsistemas en orden con supervisión ligera
# ============================================================

# --- Configuración de puertos (NO cambiar sin actualizar Dockerfile/easypanel.yml) ---
export PORT="${PORT:-21294}"                   # Web UI (proxy EasyPanel apunta aquí)
export OPENCODE_PORT="${OPENCODE_PORT:-21293}" # OpenCode Engine interno
export OPENCODE_INTERNAL_PORT="${OPENCODE_PORT}"
export OPERATOR_API_PORT="${OPERATOR_API_PORT:-3001}"   # Web Operator API interna
export WEB_OPERATOR_PORT="${OPERATOR_API_PORT}"
export AGENT_WS_PORT="${AGENT_WS_PORT:-21291}"          # Agent Server (PC agents)
export BRIDGE_PORT="${BRIDGE_PORT:-21295}"              # MiMoCode Bridge
export MIMO_MCP_PORT="${MIMO_MCP_PORT:-21296}"         # MiMoCode MCP Server
export VNC_PORT="${VNC_PORT:-5900}"
export NOVNC_PORT="${NOVNC_PORT:-6080}"
export DOCKER_ENV="true"

# El proxy se conecta al agent-server DENTRO del mismo contenedor
export AGENT_SERVER_URL="${AGENT_SERVER_URL:-ws://localhost:${AGENT_WS_PORT}/agent}"

# Password de OpenCode para proxy / autenticación
export OPENCODE_SERVER_PASSWORD="${OPENCODE_SERVER_PASSWORD:-}"

# Directorio de trabajo
APP_DIR="/app"
cd "$APP_DIR" || exit 1

# Helper logs (definir antes de usar)
log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

banner() {
  echo ""
  echo "  ╔══════════════════════════════════════════════╗"
  echo "  ║     OpenCode Evolved — Iniciando en Docker   ║"
  echo "  ╚══════════════════════════════════════════════╝"
  echo ""
}

cleanup() {
  log "Recibiendo señal de terminación, limpiando procesos..."
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -TERM "$pid" 2>/dev/null || true
    fi
  done
  sleep 2
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -KILL "$pid" 2>/dev/null || true
    fi
  done
  # Asegurar que no queden procesos huérfanos de playwright/chrome
  pkill -f 'chrome' 2>/dev/null || true
  pkill -f 'Xvfb' 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

wait_for_port() {
  local host="$1" port="$2" label="$3" max_wait="${4:-60}"
  log "Esperando $label en $host:$port (max ${max_wait}s)..."
  for i in $(seq 1 "$max_wait"); do
    if nc -z "$host" "$port" 2>/dev/null; then
      log "  → $label listo"
      return 0
    fi
    sleep 1
  done
  log "  ⚠  $label NO respondió en $host:$port"
  return 1
}

# Registro de PIDs para limpieza
PIDS=()

# Instalar dependencias de skills si hay proyectos montados
if [ -x /app/skills/setup-skills.sh ]; then
  log "Instalando dependencias de skills..."
  bash /app/skills/setup-skills.sh >/tmp/setup-skills.log 2>&1 || true
fi

# Matar cualquier proceso previo que pudiera ocupar puertos
log "Limpiando procesos previos..."
pkill -f 'Xvfb :99' 2>/dev/null || true
pkill -f 'x11vnc' 2>/dev/null || true
pkill -f 'websockify' 2>/dev/null || true
pkill -f 'opencode serve' 2>/dev/null || true
pkill -f 'node agent-server.mjs' 2>/dev/null || true
pkill -f 'node bridge-server.mjs' 2>/dev/null || true
pkill -f 'node api-server.js' 2>/dev/null || true
pkill -f 'node proxy.mjs' 2>/dev/null || true
pkill -f 'node serve.js' 2>/dev/null || true
sleep 2

banner

# ============================================================
# 1. Pantalla virtual
# ============================================================
log "[1/9] Iniciando pantalla virtual (Xvfb)..."
Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp >/tmp/xvfb.log 2>&1 &
PID=$!
PIDS+=("$PID")
sleep 2
if ! kill -0 "$PID" 2>/dev/null; then
  log "  ✗ Xvfb falló al iniciar"; cat /tmp/xvfb.log; exit 1
fi
log "  → Xvfb listo en DISPLAY :99"

# ============================================================
# 2. VNC + noVNC
# ============================================================
log "[2/9] Iniciando VNC + noVNC..."
x11vnc -display :99 -nopw -listen localhost -xkb -forever -quiet >/tmp/x11vnc.log 2>&1 &
PID=$!
PIDS+=("$PID")
sleep 1

websockify --web=/usr/share/novnc/ 0.0.0.0:"$NOVNC_PORT" localhost:"$VNC_PORT" >/tmp/websockify.log 2>&1 &
PID=$!
PIDS+=("$PID")
sleep 1
log "  → VNC listo en :$VNC_PORT, noVNC en :$NOVNC_PORT"

# ============================================================
# 3. Web UI (serve.js) — Interfaz web principal (arranca PRIMERO
#    para evitar conflicto de puerto con opencode engine)
# ============================================================
log "[3/9] Iniciando Web UI en puerto $PORT..."
node "$APP_DIR/serve.js" >/tmp/serve.log 2>&1 &
PID=$!
PIDS+=("$PID")
sleep 2
if kill -0 "$PID" 2>/dev/null; then
  if wait_for_port localhost "$PORT" "Web UI" 30; then
    log "  → Web UI listo en :$PORT"
  else
    log "  ⚠  Web UI no responde (ver /tmp/serve.log)"
    tail -n 20 /tmp/serve.log
  fi
else
  log "  ✗ Web UI falló al iniciar (ver /tmp/serve.log)"
  tail -n 20 /tmp/serve.log
  # No salimos — el supervisor reintentará
fi

# ============================================================
# 4. OpenCode Engine (API interna, sin UI — solo backend)
# ============================================================
log "[4/9] Configurando providers de OpenCode..."
OPENCODE_CONFIG_DIR="/root/.config/opencode"
mkdir -p "$OPENCODE_CONFIG_DIR"
CONFIG_FILE="$OPENCODE_CONFIG_DIR/opencode.jsonc"
PROVIDERS="{"
SEP=""
if [ -n "$OPENAI_API_KEY" ]; then
  PROVIDERS="${PROVIDERS}${SEP}\"openai\":{\"apiKey\":\"$OPENAI_API_KEY\"}"
  SEP=","
fi
if [ -n "$GITHUB_COPILOT_TOKEN" ]; then
  PROVIDERS="${PROVIDERS}${SEP}\"github-copilot\":{\"token\":\"$GITHUB_COPILOT_TOKEN\"}"
  SEP=","
  log "  → GitHub Copilot configurado"
fi
PROVIDERS="${PROVIDERS}}"
if [ "$PROVIDERS" != "{}" ]; then
  cat > "$CONFIG_FILE" << EOF
{
  "\$schema": "https://opencode.ai/config.json",
  "model": "opencode-go/deepseek-v4-flash",
  "provider": $PROVIDERS,
  "permission": { "bash": { "/**": "allow" }, "read": { "/**": "allow" }, "write": { "/**": "allow" }, "edit": { "/**": "allow" } }
}
EOF
  log "  → Config creada con providers disponibles"
else
  log "  ⚠  Sin API keys — OpenCode no tendrá modelos"
fi
if command -v opencode >/dev/null 2>&1; then
  log "[4/9] Iniciando OpenCode Engine (API interna) en puerto $OPENCODE_PORT..."
  opencode serve --port "$OPENCODE_PORT" >/tmp/opencode.log 2>&1 &
  PID=$!
  PIDS+=("$PID")
  if wait_for_port localhost "$OPENCODE_PORT" "OpenCode Engine" 60; then
    log "  → OpenCode Engine listo en :$OPENCODE_PORT (solo backend)"
  else
    log "  ⚠  OpenCode Engine no respondió (ver /tmp/opencode.log)"
    tail -n 20 /tmp/opencode.log
  fi
else
  log "  ⚠  Comando 'opencode' no encontrado — engine omitido"
fi

# ============================================================
# 5. Agent Server (WebSocket hub para PC Agents)
# ============================================================
log "[5/9] Iniciando Agent Server en puerto $AGENT_WS_PORT..."
node "$APP_DIR/agent-server.mjs" >/tmp/agent-server.log 2>&1 &
PID=$!
PIDS+=("$PID")
if wait_for_port localhost "$AGENT_WS_PORT" "Agent Server" 30; then
  log "  → Agent Server listo en :$AGENT_WS_PORT"
else
  log "  ⚠  Agent Server no respondió (ver /tmp/agent-server.log)"
  tail -n 20 /tmp/agent-server.log
fi

# ============================================================
# 6. Bridge Server (MiMoCode ↔ PC Agent)
# ============================================================
log "[6/9] Iniciando Bridge Server en puerto $BRIDGE_PORT..."
node "$APP_DIR/bridge-server.mjs" >/tmp/bridge-server.log 2>&1 &
PID=$!
PIDS+=("$PID")
if wait_for_port localhost "$BRIDGE_PORT" "Bridge Server" 30; then
  log "  → Bridge Server listo en :$BRIDGE_PORT"
else
  log "  ⚠  Bridge Server no respondió (ver /tmp/bridge-server.log)"
  tail -n 20 /tmp/bridge-server.log
fi

# ============================================================
# 7. Web Operator API
# ============================================================
log "[7/9] Iniciando Web Operator API en puerto $OPERATOR_API_PORT..."
cd "$APP_DIR/web-operator" || exit 1
export OPERATOR_API_PORT
export WEB_OPERATOR_PORT
node api-server.js >/tmp/web-operator.log 2>&1 &
PID=$!
PIDS+=("$PID")
cd "$APP_DIR" || exit 1
if wait_for_port localhost "$OPERATOR_API_PORT" "Web Operator API" 30; then
  log "  → Web Operator API listo en :$OPERATOR_API_PORT"
else
  log "  ⚠  Web Operator API no respondió (ver /tmp/web-operator.log)"
  tail -n 20 /tmp/web-operator.log
fi

# ============================================================
# 8. Scheduler de skills (preoperacional diario)
# ============================================================
log "[8/9] Iniciando Scheduler de skills..."
node "$APP_DIR/skills/preoperacional-nova/scheduler.js" >/tmp/skills-scheduler.log 2>&1 &
PID=$!
PIDS+=("$PID")
if kill -0 "$PID" 2>/dev/null; then
  log "  → Scheduler de skills iniciado"
else
  log "  ⚠  Scheduler de skills falló al iniciar"
fi

# ============================================================
# 9. MiMoCode MCP Server
# ============================================================
log "[9/9] Iniciando MiMoCode MCP Server en puerto $MIMO_MCP_PORT..."
node "$APP_DIR/mimo-mcp-server.mjs" >/tmp/mimo-mcp.log 2>&1 &
PID=$!
PIDS+=("$PID")
if wait_for_port localhost "$MIMO_MCP_PORT" "MiMoCode MCP" 30; then
  log "  → MiMoCode MCP Server listo en :$MIMO_MCP_PORT"
else
  log "  ⚠  MiMoCode MCP Server no respondió (ver /tmp/mimo-mcp.log)"
  tail -n 20 /tmp/mimo-mcp.log
fi

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║          TODO LISTO EN EASYPANEL             ║"
echo "  ╠══════════════════════════════════════════════╣"
echo "  ║  Web UI:       http://0.0.0.0:$PORT          ║"
echo "  ║  OpenCode:     http://localhost:$OPENCODE_PORT          ║"
echo "  ║  Web Operator: http://localhost:$OPERATOR_API_PORT          ║"
echo "  ║  Agent Server: ws://localhost:$AGENT_WS_PORT/agent      ║"
echo "  ║  Bridge:       ws://localhost:$BRIDGE_PORT/mimo         ║"
echo "  ║  MCP Server:   http://0.0.0.0:$MIMO_MCP_PORT             ║"
echo "  ║  Skills:       /app/skills                   ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""

# ============================================================
# Supervisor ligero: reinicia procesos muertos y loguea estado
# ============================================================
log "Supervisor activo. Presiona Ctrl+C para detener."
HEALTH_FILE="/tmp/opencode-health.json"
echo '{"status":"starting","started":"'"$(date -Iseconds)"'"}' > "$HEALTH_FILE"

LAST_HEALTH_EPOCH=0
while true; do
  sleep 10
  ALIVE=0
  DEAD=0
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      ALIVE=$((ALIVE + 1))
    else
      DEAD=$((DEAD + 1))
    fi
  done

  # Health check de la Web UI (serve.js) — es el servicio más crítico
  UI_UP=false
  if curl -sf "http://localhost:$PORT/health" >/dev/null 2>&1; then
    UI_UP=true
  fi

  # Health check del OpenCode engine (no crítico, puede fallar sin reiniciar)
  ENGINE_UP=false
  if curl -sf "http://localhost:$OPENCODE_PORT/" >/dev/null 2>&1; then
    ENGINE_UP=true
  fi

  echo "{\"status\":\"running\",\"alive\":$ALIVE,\"dead\":$DEAD,\"engine_up\":$ENGINE_UP,\"ui_up\":$UI_UP,\"checked\":\"$(date -Iseconds)\"}" > "$HEALTH_FILE"

  if [ "$DEAD" -gt 0 ]; then
    log "Aviso: $DEAD proceso(s) han terminado ($ALIVE vivos). UI_UP=$UI_UP Engine_UP=$ENGINE_UP"
  fi

  # Solo salir si la Web UI está caída Y hay menos de 2 servicios vivos
  if [ "$UI_UP" = false ] && [ "$ALIVE" -lt 2 ]; then
    log "CRÍTICO: Web UI caída y servicios mínimos. Solicitando reinicio..."
    exit 1
  fi
done

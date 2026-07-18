#!/bin/bash
set -o pipefail
set +e

# ============================================================
# OpenCode Evolved — Docker Startup Orchestrator
# Versión: solo web original (opencode serve) + Hermes
# ============================================================

# --- Configuración de puertos ---
export PORT="${PORT:-21293}"                   # Web original OpenCode (proxy EasyPanel)
export OPENCODE_PORT="${PORT}"                 # mismo puerto
export AGENT_WS_PORT="${AGENT_WS_PORT:-21291}" # Agent Server (PC agents)
export BRIDGE_PORT="${BRIDGE_PORT:-21295}"     # MiMoCode Bridge
export HERMES_PORT="${HERMES_PORT:-21294}"     # Hermes web (si disponible)
export VNC_PORT="${VNC_PORT:-5900}"
export NOVNC_PORT="${NOVNC_PORT:-6080}"
export DOCKER_ENV="true"

export AGENT_SERVER_URL="${AGENT_SERVER_URL:-ws://localhost:${AGENT_WS_PORT}/agent}"

APP_DIR="/app"
cd "$APP_DIR" || exit 1

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

banner() {
  echo ""
  echo "  ╔══════════════════════════════════════════════╗"
  echo "  ║     OpenCode — Web original + Hermes         ║"
  echo "  ╚══════════════════════════════════════════════╝"
  echo ""
}

cleanup() {
  log "Apagando..."
  for pid in "${PIDS[@]}"; do
    kill -TERM "$pid" 2>/dev/null || true
  done
  sleep 2
  for pid in "${PIDS[@]}"; do
    kill -KILL "$pid" 2>/dev/null || true
  done
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
  log "  ⚠  $label NO respondió"
  return 1
}

PIDS=()

if [ -x /app/skills/setup-skills.sh ]; then
  log "Instalando dependencias de skills..."
  bash /app/skills/setup-skills.sh >/tmp/setup-skills.log 2>&1 || true
fi

log "Limpiando procesos previos..."
pkill -f 'Xvfb :99' 2>/dev/null || true
pkill -f 'x11vnc' 2>/dev/null || true
pkill -f 'opencode serve' 2>/dev/null || true
pkill -f 'node agent-server.mjs' 2>/dev/null || true
pkill -f 'node bridge-server.mjs' 2>/dev/null || true
sleep 2

banner

# ============================================================
# 1. Pantalla virtual
# ============================================================
log "[1/7] Iniciando pantalla virtual (Xvfb)..."
Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp >/tmp/xvfb.log 2>&1 &
PID=$!
PIDS+=("$PID")
sleep 2
if ! kill -0 "$PID" 2>/dev/null; then
  log "  ✗ Xvfb falló"; cat /tmp/xvfb.log; exit 1
fi
log "  → Xvfb listo en DISPLAY :99"

# ============================================================
# 2. VNC + noVNC
# ============================================================
log "[2/7] Iniciando VNC + noVNC..."
x11vnc -display :99 -nopw -listen localhost -xkb -forever -quiet >/tmp/x11vnc.log 2>&1 &
PIDS+=("$!")
sleep 1

websockify --web=/usr/share/novnc/ 0.0.0.0:"$NOVNC_PORT" localhost:"$VNC_PORT" >/tmp/websockify.log 2>&1 &
PIDS+=("$!")
sleep 1
log "  → VNC :$VNC_PORT, noVNC :$NOVNC_PORT"

# ============================================================
# 3. OpenCode original web (opencode serve)
# ============================================================
log "[3/7] Configurando OpenCode..."

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
  log "  → Config creada"
fi

if command -v opencode >/dev/null 2>&1; then
  log "[3/7] Iniciando OpenCode web en puerto $PORT..."
  opencode serve --port "$PORT" >/tmp/opencode.log 2>&1 &
  PID=$!
  PIDS+=("$PID")
  if wait_for_port localhost "$PORT" "OpenCode Web" 60; then
    log "  ★ OpenCode web listo en :$PORT"
  else
    log "  ⚠  OpenCode web no respondió"
    tail -n 20 /tmp/opencode.log
    log "  → Iniciando serve.js como fallback..."
    node "$APP_DIR/serve.js" >/tmp/serve.log 2>&1 &
    PID=$!
    PIDS+=("$PID")
    wait_for_port localhost "$PORT" "serve.js fallback" 30 || true
  fi
else
  log "  ⚠  'opencode' no encontrado — iniciando serve.js..."
  node "$APP_DIR/serve.js" >/tmp/serve.log 2>&1 &
  PID=$!
  PIDS+=("$PID")
  wait_for_port localhost "$PORT" "serve.js" 30 || true
fi

# ============================================================
# 4. Hermes (si está instalado)
# ============================================================
log "[4/7] Buscando Hermes..."
if command -v hermes >/dev/null 2>&1 || [ -f /usr/local/bin/hermes ]; then
  log "[4/7] Iniciando Hermes en puerto $HERMES_PORT..."
  hermes serve --port "$HERMES_PORT" >/tmp/hermes.log 2>&1 &
  PID=$!
  PIDS+=("$PID")
  if wait_for_port localhost "$HERMES_PORT" "Hermes" 30; then
    log "  ★ Hermes listo en :$HERMES_PORT"
  else
    log "  ⚠  Hermes no respondió"
  fi
else
  log "  ⚠  Hermes no instalado — se omite"
fi

# ============================================================
# 5. Agent Server (PC Agents desde Windows)
# ============================================================
log "[5/7] Iniciando Agent Server en puerto $AGENT_WS_PORT..."
node "$APP_DIR/agent-server.mjs" >/tmp/agent-server.log 2>&1 &
PID=$!
PIDS+=("$PID")
if wait_for_port localhost "$AGENT_WS_PORT" "Agent Server" 30; then
  log "  → Agent Server listo en :$AGENT_WS_PORT"
else
  log "  ⚠  Agent Server no respondió"
  tail -n 10 /tmp/agent-server.log
fi

# ============================================================
# 6. Bridge Server (conexión IA ↔ PC Agent)
# ============================================================
log "[6/7] Iniciando Bridge Server en puerto $BRIDGE_PORT..."
node "$APP_DIR/bridge-server.mjs" >/tmp/bridge-server.log 2>&1 &
PID=$!
PIDS+=("$PID")
if wait_for_port localhost "$BRIDGE_PORT" "Bridge Server" 30; then
  log "  → Bridge Server listo en :$BRIDGE_PORT"
else
  log "  ⚠  Bridge Server no respondió"
fi

# ============================================================
# 7. Web Operator API + Skills
# ============================================================
log "[7/7] Iniciando Web Operator API en puerto 3001..."
cd "$APP_DIR/web-operator" || true
export OPERATOR_API_PORT=3001
node api-server.js >/tmp/web-operator.log 2>&1 &
PIDS+=("$!")
cd "$APP_DIR" || true

log "[7/7] Iniciando Scheduler de skills..."
node "$APP_DIR/skills/preoperacional-nova/scheduler.js" >/tmp/skills-scheduler.log 2>&1 &
PIDS+=("$!")

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║          TODO LISTO EN EASYPANEL             ║"
echo "  ╠══════════════════════════════════════════════╣"
echo "  ║  ★ OpenCode Web:  http://0.0.0.0:$PORT       ║"
echo "  ║  ★ Hermes:        http://0.0.0.0:$HERMES_PORT ║"
echo "  ║  Agent Server:    ws://0.0.0.0:$AGENT_WS_PORT/agent ║"
echo "  ║  Bridge:          ws://0.0.0.0:$BRIDGE_PORT/mimo ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""

# ============================================================
# Supervisor
# ============================================================
log "Supervisor activo. Ctrl+C para detener."
HEALTH_FILE="/tmp/opencode-health.json"
echo '{"status":"starting","started":"'"$(date -Iseconds)"'"}' > "$HEALTH_FILE"

while true; do
  sleep 10
  ALIVE=0
  DEAD=0
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then ALIVE=$((ALIVE + 1)); else DEAD=$((DEAD + 1)); fi
  done

  OC_UP=false
  if curl -sf "http://localhost:$PORT/" >/dev/null 2>&1; then
    OC_UP=true
  fi

  echo "{\"status\":\"running\",\"alive\":$ALIVE,\"dead\":$DEAD,\"opencode_up\":$OC_UP,\"checked\":\"$(date -Iseconds)\"}" > "$HEALTH_FILE"

  if [ "$DEAD" -gt 0 ]; then
    log "Procesos: $ALIVE vivos, $DEAD muertos. OpenCode web: $([ "$OC_UP" = true ] && echo 'ACTIVO' || echo 'CAÍDO')"
  fi

  if [ "$OC_UP" = false ] && [ "$ALIVE" -lt 2 ]; then
    log "CRÍTICO: OpenCode web caído. Solicitando reinicio..."
    exit 1
  fi
done

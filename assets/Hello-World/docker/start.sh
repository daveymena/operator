#!/bin/bash
# ============================================================
# OpenCode Evolved — Script de inicio Docker/EasyPanel
# Soporta: FreeModel, OpenAI, Anthropic, Groq, Puter, GitHub
#          + PostgreSQL Easypanel + Proxy Dark Glassmorphism
# ============================================================
# NO usar set -e: algunos servicios opcionales pueden fallar

APP_DIR="/app"
WORKSPACE="${OPENCODE_WORKSPACE:-/workspace}"

echo "╔══════════════════════════════════════════╗"
echo "║        OpenCode  E V O L V E D           ║"
echo "╚══════════════════════════════════════════╝"
echo "  Version: $(opencode --version 2>/dev/null || echo '1.2.27')"

# ---- Guardar PORT original de EasyPanel antes de cargar .env ---- #
EASYPANEL_PORT="${PORT:-}"
EASYPANEL_OPERATOR_PORT="${OPERATOR_PORT:-}"

# ---- Cargar .env si existe (sin sobreescribir PORT) ---- #
if [ -f "$WORKSPACE/.env" ]; then
  echo "  Loading .env..."
  set -o allexport
  source "$WORKSPACE/.env"
  set +o allexport
  
  # Restaurar PORTs de EasyPanel (tienen prioridad)
  if [ -n "$EASYPANEL_PORT" ]; then
    export PORT="$EASYPANEL_PORT"
    echo "  Using PORT from EasyPanel: $PORT"
  fi
  if [ -n "$EASYPANEL_OPERATOR_PORT" ]; then
    export OPERATOR_PORT="$EASYPANEL_OPERATOR_PORT"
    echo "  Using OPERATOR_PORT from EasyPanel: $OPERATOR_PORT"
  fi
fi

# ──────────────────────────────────────────────────────────
#  PROVEEDORES DE IA
# ──────────────────────────────────────────────────────────
echo ""
echo "  AI Providers detected:"

if [ -n "$FREEMODEL_API_KEY" ]; then
  echo "     FreeModel GPT-4o (free)"
  export FREEMODEL_BASE_URL="${FREEMODEL_BASE_URL:-https://api.freemodel.dev/v1}"
  export FREEMODEL_MODEL="${FREEMODEL_MODEL:-gpt-4o}"
fi

if [ -n "$ANTHROPIC_API_KEY" ]; then
  echo "     Anthropic Claude"
fi

if [ -n "$OPENAI_API_KEY" ]; then
  echo "     OpenAI GPT-4o"
fi

if [ -n "$GOOGLE_GENERATIVE_AI_API_KEY" ]; then
  echo "     Google Gemini"
fi

if [ -n "$GROQ_API_KEY" ]; then
  echo "     Groq (Llama, Mixtral - free)"
fi

if [ -n "$OPENROUTER_API_KEY" ]; then
  echo "     OpenRouter (60+ models)"
fi

if [ -n "$CEREBRAS_API_KEY" ]; then
  echo "     Cerebras (ultrafast - free)"
fi

if [ -n "$MISTRAL_API_KEY" ]; then
  echo "     Mistral AI"
fi

if [ -n "$XAI_API_KEY" ]; then
  echo "     xAI Grok"
fi

if [ -n "$PUTER_AUTH_TOKEN" ]; then
  echo "     Puter.js (free text)"
fi

if [ -n "$GITHUB_TOKEN" ]; then
  echo "     GitHub Token"
fi

# ── Ollama local ────────────────────────────────────────────
if [ -n "$OLLAMA_HOST" ]; then
  export OLLAMA_BASE_URL="$OLLAMA_HOST"
  echo "     Ollama at $OLLAMA_HOST"
elif curl -s --connect-timeout 2 http://ollama:11434 >/dev/null 2>&1; then
  export OLLAMA_BASE_URL="http://ollama:11434"
  echo "     Ollama detected automatically"
fi

# ──────────────────────────────────────────────────────────
#  BASE DE DATOS (Easypanel PostgreSQL)
# ──────────────────────────────────────────────────────────
echo ""
if [ -n "$EASYPANEL_DATABASE_URL" ]; then
  echo "  DB: ${DB_HOST:-?}:${DB_PORT:-5432}/${DB_NAME:-?}"
  if command -v psql >/dev/null 2>&1 && [ -f "$APP_DIR/artifacts/opencode-ui/db/schema.sql" ]; then
    echo "  Applying DB schema..."
    psql "$EASYPANEL_DATABASE_URL" -f "$APP_DIR/artifacts/opencode-ui/db/schema.sql" 2>/dev/null \
      && echo "  Schema applied" \
      || echo "  Schema already exists or minor error (normal)"
  fi
elif [ -n "$DATABASE_URL" ]; then
  export EASYPANEL_DATABASE_URL="$DATABASE_URL"
  echo "  DB: $DATABASE_URL"
fi

# ──────────────────────────────────────────────────────────
#  VARIABLES DE ENTORNO
# ──────────────────────────────────────────────────────────
export DISPLAY="${DISPLAY:-:99}"
export TZ="${TZ:-America/Bogota}"

# ──────────────────────────────────────────────────────────
#  PANTALLA VIRTUAL (Xvfb + VNC)
# ──────────────────────────────────────────────────────────
echo ""
echo "  Starting virtual display..."
Xvfb :99 -screen 0 1920x1080x24 -nolisten tcp 2>/dev/null &
sleep 2

x11vnc -display :99 -nopw -listen localhost -xkb -forever -quiet 2>/dev/null &
sleep 1
websockify --web=/usr/share/novnc/ 0.0.0.0:6080 localhost:5900 >/dev/null 2>&1 &
echo "  VNC ready at :6080"

# ──────────────────────────────────────────────────────────
#  INSTALAR MCP SERVERS (si no existen)
# ──────────────────────────────────────────────────────────
mkdir -p "$WORKSPACE"

if [ ! -d "$WORKSPACE/node_modules/@modelcontextprotocol" ]; then
  echo ""
  echo "  Installing MCP servers..."
  cd "$WORKSPACE"
  npm install --save \
    @modelcontextprotocol/server-filesystem \
    @modelcontextprotocol/server-memory \
    @modelcontextprotocol/server-sequential-thinking \
    @playwright/mcp \
    2>/dev/null || echo "  Some MCP servers failed (non-critical)"
fi

# ──────────────────────────────────────────────────────────
#  COPIAR SCRIPTS BIN AL WORKSPACE (para MCP)
# ──────────────────────────────────────────────────────────
mkdir -p "$WORKSPACE/artifacts/bin"
if [ -f "$APP_DIR/artifacts/mcp-computer.mjs" ]; then
  cp "$APP_DIR/artifacts/mcp-computer.mjs" "$WORKSPACE/artifacts/bin/" 2>/dev/null || true
fi
if [ -f "$APP_DIR/artifacts/mcp-body.mjs" ]; then
  cp "$APP_DIR/artifacts/mcp-body.mjs" "$WORKSPACE/artifacts/bin/" 2>/dev/null || true
fi

# ──────────────────────────────────────────────────────────
#  ARRANQUE DE MOTORES
# ──────────────────────────────────────────────────────────
# Usar variables de entorno o valores por defecto
PROXY_PORT="${PORT:-3000}"
MIMO_PROXY_PORT="4000"

OC_PORT="$(( PROXY_PORT + 1 ))"
MIMO_PORT="$(( MIMO_PROXY_PORT + 1 ))"

echo ""
echo "  📊 Configuración de puertos:"
echo "     PORT env var: ${PORT:-no definido}"
echo "     PROXY_PORT: $PROXY_PORT"
echo "     OC_PORT (OpenCode): $OC_PORT"
echo "     OPERATOR_PORT: ${OPERATOR_PORT:-no definido}"

mkdir -p "$WORKSPACE/proyectos"

echo ""
echo "  Starting OpenCode engine on port $OC_PORT..."
echo "  Command: PORT=$OC_PORT opencode serve --port $OC_PORT --hostname 0.0.0.0"

# Verificar que opencode existe antes de intentar ejecutarlo
if ! command -v opencode &>/dev/null; then
  echo "  ❌ ERROR: opencode command not found!"
  echo "  Buscando en ubicaciones comunes..."
  find /usr -name "opencode" 2>/dev/null || echo "  No encontrado en /usr"
  echo "  Listando paquetes npm globales:"
  npm list -g --depth=0 2>/dev/null || echo "  npm list falló"
  echo "  Continuando de todas formas..."
fi

PORT=$OC_PORT opencode serve \
  --port "$OC_PORT" \
  --hostname 0.0.0.0 2>&1 | tee /tmp/opencode.log &
OC_PID=$!

if command -v mimo &>/dev/null; then
  echo "  Starting MiMo Code engine on port $MIMO_PORT..."
  PORT=$MIMO_PORT mimo serve \
    --port "$MIMO_PORT" \
    --no-auth \
    --hostname 0.0.0.0 &
  MIMO_PID=$!
else
  echo "  MiMo not installed, skipping..."
fi

# ── ESPERAR a que OpenCode esté listo ANTES de iniciar el proxy ──
echo ""
echo "  ⏳ Esperando a que OpenCode esté listo (máximo 120s)..."
echo "  Probando conexión cada segundo en puerto $OC_PORT..."
echo ""

OPENCODE_READY=false

for i in $(seq 1 120); do
  # Mostrar progreso cada 5 segundos
  if [ $((i % 5)) -eq 0 ]; then
    echo "  ... esperando ${i}s (verificando http://127.0.0.1:$OC_PORT/)"
  fi
  
  # Probar ambas direcciones: localhost y 127.0.0.1
  if curl -s --connect-timeout 2 "http://127.0.0.1:$OC_PORT/" >/dev/null 2>&1; then
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$OC_PORT/" 2>&1 || echo "000")
    echo ""
    echo "  ✅ OpenCode DETECTADO en 127.0.0.1 (después de ${i}s)"
    echo "  📡 HTTP Status Code: $HTTP_STATUS"
    
    if [ "$HTTP_STATUS" != "000" ] && [ "$HTTP_STATUS" != "502" ] && [ "$HTTP_STATUS" != "503" ]; then
      echo "  ✅ OpenCode está LISTO y respondiendo correctamente!"
      OPENCODE_READY=true
      break
    else
      echo "  ⚠️  OpenCode responde pero con código $HTTP_STATUS (aún iniciando...)"
    fi
  elif curl -s --connect-timeout 2 "http://localhost:$OC_PORT/" >/dev/null 2>&1; then
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:$OC_PORT/" 2>&1 || echo "000")
    echo ""
    echo "  ✅ OpenCode DETECTADO en localhost (después de ${i}s)"
    echo "  📡 HTTP Status Code: $HTTP_STATUS"
    
    if [ "$HTTP_STATUS" != "000" ] && [ "$HTTP_STATUS" != "502" ] && [ "$HTTP_STATUS" != "503" ]; then
      echo "  ✅ OpenCode está LISTO y respondiendo correctamente!"
      OPENCODE_READY=true
      break
    else
      echo "  ⚠️  OpenCode responde pero con código $HTTP_STATUS (aún iniciando...)"
    fi
  fi
  
  # Timeout - diagnóstico detallado
  if [ $i -eq 120 ]; then
    echo ""
    echo "  ❌❌❌ ERROR CRÍTICO: OpenCode NO respondió después de 120 segundos ❌❌❌"
    echo ""
    echo "  🔍 DIAGNÓSTICO:"
    echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "  1️⃣ Verificando si el proceso OpenCode existe..."
    if ps aux | grep "opencode serve" | grep -v grep; then
      echo "     ✅ Proceso OpenCode está corriendo"
    else
      echo "     ❌ Proceso OpenCode NO encontrado"
    fi
    echo ""
    echo "  2️⃣ Revisando los logs de OpenCode..."
    if [ -f /tmp/opencode.log ]; then
      echo "     📄 Últimas 30 líneas del log:"
      tail -30 /tmp/opencode.log
    else
      echo "     ❌ No hay archivo de log en /tmp/opencode.log"
    fi
    echo ""
    echo "  3️⃣ Intentando conexión verbose a 127.0.0.1:$OC_PORT..."
    curl -v --connect-timeout 5 "http://127.0.0.1:$OC_PORT/" 2>&1 | head -30
    echo ""
    echo "  4️⃣ Intentando conexión verbose a localhost:$OC_PORT..."
    curl -v --connect-timeout 5 "http://localhost:$OC_PORT/" 2>&1 | head -30
    echo ""
    echo "  5️⃣ Verificando puertos abiertos..."
    netstat -tlnp 2>/dev/null | grep ":$OC_PORT" || echo "     ⚠️  Puerto $OC_PORT no está escuchando"
    echo ""
    echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  fi
  
  sleep 1
done

if [ "$OPENCODE_READY" != "true" ]; then
  echo ""
  echo "  ⚠️⚠️⚠️ ADVERTENCIA: OpenCode no está listo, pero continuando de todas formas..."
  echo "  El proxy puede fallar con errores 502"
  echo ""
fi

# ── AHORA SÍ iniciamos el proxy, sabiendo que OpenCode está listo ──
echo ""
echo "  Starting OpenCode proxy on port $PROXY_PORT..."
cd "$APP_DIR/artifacts/opencode-ui"

PORT="$PROXY_PORT" \
OPENCODE_INTERNAL_PORT="$OC_PORT" \
OPERATOR_PORT="${OPERATOR_PORT:-3001}" \
API_SERVER_PORT="${OPERATOR_PORT:-3001}" \
DOCKER="true" \
EASYPANEL="true" \
node proxy.mjs &
PROXY_PID=$!

sleep 3
echo "  ✅ Proxy iniciado (PID: $PROXY_PID)"

# ── Web Operator ────────────────────────────────────────
OPERATOR_PORT="${OPERATOR_PORT:-3001}"
if [ -f "$APP_DIR/web-operator/api-server.js" ]; then
  echo "  Starting Web Operator on port $OPERATOR_PORT..."
  cd "$APP_DIR/web-operator"
  OPERATOR_PORT=$OPERATOR_PORT PORT=$OPERATOR_PORT \
    FREEMODEL_API_KEY="${FREEMODEL_API_KEY}" \
    FREEMODEL_BASE_URL="${FREEMODEL_BASE_URL}" \
    FREEMODEL_MODEL="${FREEMODEL_MODEL}" \
    node api-server.js &
  WEB_PID=$!
  sleep 2
  echo "  Web Operator ready"
fi

# ── Proxy secundario (MiMo Code - opcional) ─────────────
if [ -n "$MIMO_PID" ]; then
  echo "  Starting MiMo Code proxy on port $MIMO_PROXY_PORT..."
  cd "$APP_DIR/artifacts/opencode-ui"
  PORT="$MIMO_PROXY_PORT" \
  OPENCODE_INTERNAL_PORT="$MIMO_PORT" \
  OPERATOR_PORT="$OPERATOR_PORT" \
  API_SERVER_PORT="$OPERATOR_PORT" \
  node proxy.mjs &
  MIMO_PROXY_PID=$!
fi

echo ""
echo "  ════════════════════════════════════════════════════════"
echo "  🚀 OpenCode Bridge at http://0.0.0.0:$PROXY_PORT"
echo "  🖥️  VNC remote at http://0.0.0.0:6080/vnc.html"
echo "  🤖 Web Operator at http://0.0.0.0:$OPERATOR_PORT"
echo "  ════════════════════════════════════════════════════════"
echo ""
echo "  📊 Estado de servicios:"
echo "     OpenCode PID: $OC_PID ($(ps -p $OC_PID >/dev/null 2>&1 && echo '✅ corriendo' || echo '❌ detenido'))"
echo "     Proxy PID: $PROXY_PID ($(ps -p $PROXY_PID >/dev/null 2>&1 && echo '✅ corriendo' || echo '❌ detenido'))"
[ -n "$WEB_PID" ] && echo "     Web Operator PID: $WEB_PID ($(ps -p $WEB_PID >/dev/null 2>&1 && echo '✅ corriendo' || echo '❌ detenido'))"
echo ""
echo "  💡 Si ves 'Bad Gateway', revisa los logs arriba para ver si OpenCode inició correctamente"
echo ""

# Mantener vivo
wait $PROXY_PID
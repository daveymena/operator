#!/bin/sh
set -e

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║    🚀 Operator Pro v3.0 — Easypanel Container                   ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "📍 Node: $(node --version)"
echo "📍 Chromium: $(chromium --version 2>/dev/null || echo 'not found')"
echo "📍 Platform: $(uname -s) $(uname -m)"
echo ""

cd /app

# ─── Load environment ────────────────────────────────────────────────────────
if [ -f "config/.env" ]; then
  echo "✅ Loading config/.env"
  set -a
  . config/.env
  set +a
fi

# ─── Create directories ──────────────────────────────────────────────────────
mkdir -p screenshots logs config operator/memory operator/knowledge

# ─── Start Operator Pro API Server (port 3000) ───────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 Starting Operator Pro API Server (port ${OPERATOR_PORT:-3000})"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

node operator.mjs --server --port=${OPERATOR_PORT:-3000} &
API_PID=$!
echo "✅ API Server started (PID: $API_PID)"

# ─── Start Bridge (port 20100) ──────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔌 Starting Bridge (port ${BRIDGE_PORT:-20100})"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

node bridge/bridge.mjs &
BRIDGE_PID=$!
echo "✅ Bridge started (PID: $BRIDGE_PID)"

# ─── Start OpenCode Web (if available) ──────────────────────────────────────
if command -v opencode &> /dev/null; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🧠 Starting OpenCode Web (port ${OPENCODE_PORT:-21293})"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  opencode web --hostname 0.0.0.0 --port ${OPENCODE_PORT:-21293} &
  OPENCODE_PID=$!
  echo "✅ OpenCode Web started (PID: $OPENCODE_PID)"
fi

# ─── Start Agent Server (if exists) ─────────────────────────────────────────
if [ -f "opencode-core/agent-server.mjs" ]; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "🤖 Starting Agent Server"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  cd opencode-core
  node agent-server.mjs &
  AGENT_PID=$!
  cd /app
  echo "✅ Agent Server started (PID: $AGENT_PID)"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║    ✅ ALL SERVICES RUNNING                                       ║"
echo "╠══════════════════════════════════════════════════════════════════╣"
echo "║                                                                  ║"
echo "║  📊 Dashboard:    http://0.0.0.0:${OPERATOR_PORT:-3000}/dashboard  ║"
echo "║  🔌 API:          http://0.0.0.0:${OPERATOR_PORT:-3000}/api        ║"
echo "║  🌐 Bridge:       ws://0.0.0.0:${BRIDGE_PORT:-20100}              ║"
echo "║  🧠 OpenCode:     http://0.0.0.0:${OPENCODE_PORT:-21293}          ║"
echo "║                                                                  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# ─── Cleanup on exit ────────────────────────────────────────────────────────
cleanup() {
  echo "🛑 Stopping services..."
  kill $API_PID 2>/dev/null || true
  kill $BRIDGE_PID 2>/dev/null || true
  kill $OPENCODE_PID 2>/dev/null || true
  kill $AGENT_PID 2>/dev/null || true
  echo "✅ All services stopped"
  exit 0
}

trap cleanup SIGINT SIGTERM

# ─── Keep container running ─────────────────────────────────────────────────
wait

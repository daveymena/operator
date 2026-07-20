#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║    Operator Pro — Start Script (Todo en Uno)                    ║
# ╚══════════════════════════════════════════════════════════════════╝

set -e

echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║    🚀 OPERATOR PRO v3.0 — Iniciando...                          ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""

# Detectar SO
OS="$(uname -s)"
case "${OS}" in
    Linux*)     PLATFORM=linux;;
    Darwin*)    PLATFORM=mac;;
    CYGWIN*)    PLATFORM=windows;;
    MINGW*)     PLATFORM=windows;;
    *)          PLATFORM=unknown;;
esac

echo "📍 Plataforma: $PLATFORM"
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js no está instalado. Instálalo desde https://nodejs.org"
    exit 1
fi

NODE_VERSION=$(node --version)
echo "✅ Node.js: $NODE_VERSION"

# Verificar dependencias
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependencias..."
    npm install
fi

# Cargar .env si existe
if [ -f "config/.env" ]; then
    echo "✅ Configuración cargada desde config/.env"
    export $(grep -v '^#' config/.env | xargs)
fi

# Crear directorios necesarios
mkdir -p screenshots logs

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🌐 INICIANDO API SERVER (Puerto 3000)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Iniciar API server en background
node operator.mjs --server --port=3000 > logs/api-server.log 2>&1 &
API_PID=$!
echo $API_PID > logs/api-server.pid
echo "✅ API Server iniciado (PID: $API_PID)"
echo "   Dashboard: http://localhost:3000/dashboard"
echo "   API: http://localhost:3000/api"

# Esperar a que el servidor esté listo
sleep 2

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔌 INICIANDO BRIDGE (Puerto 20100)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Iniciar bridge en background
node bridge/bridge.mjs > logs/bridge.log 2>&1 &
BRIDGE_PID=$!
echo $BRIDGE_PID > logs/bridge.pid
echo "✅ Bridge iniciado (PID: $BRIDGE_PID)"
echo "   WebSocket: ws://localhost:20100"

sleep 1

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧠 MCP SERVER (Para OpenCode)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ MCP Server listo"
echo "   Archivo: ./operator/mcp-server.mjs"
echo "   Config: ./opencode.json"
echo ""
echo "   Para usar con OpenCode, agrega a tu opencode.json:"
echo '   {'
echo '     "mcpServers": {'
echo '       "operator": {'
echo '         "command": "node",'
echo "         \"args\": [\"$(pwd)/operator/mcp-server.mjs\"]"
echo '       }'
echo '     }'
echo '   }'

echo ""
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║    ✅ OPERATOR PRO LISTO                                         ║"
echo "╠══════════════════════════════════════════════════════════════════╣"
echo "║                                                                  ║"
echo "║  📊 Dashboard:    http://localhost:3000/dashboard               ║"
echo "║  🔌 API:          http://localhost:3000/api                     ║"
echo "║  🌐 WebSocket:    ws://localhost:20100                          ║"
echo "║  🧠 MCP:          ./operator/mcp-server.mjs                     ║"
echo "║                                                                  ║"
echo "║  📝 Logs:         ./logs/                                       ║"
echo "║  🛑 Detener:      ./stop.sh                                     ║"
echo "║                                                                  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo ""
echo "💡 Ahora puedes:"
echo "   • Abrir http://localhost:3000/dashboard en tu navegador"
echo "   • Usar OpenCode web con MCP server configurado"
echo "   • Conectar vía ngrok para acceso remoto"
echo ""
echo "Presiona Ctrl+C para detener todos los servicios"

# Trap para limpieza
cleanup() {
    echo ""
    echo "🛑 Deteniendo servicios..."
    kill $API_PID 2>/dev/null || true
    kill $BRIDGE_PID 2>/dev/null || true
    rm -f logs/api-server.pid logs/bridge.pid
    echo "✅ Servicios detenidos"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Mantener el script corriendo
wait

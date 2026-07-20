#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║    Operator Pro — Stop Script                                   ║
# ╚══════════════════════════════════════════════════════════════════╝

echo "🛑 Deteniendo Operator Pro..."

# Detener API server
if [ -f "logs/api-server.pid" ]; then
    PID=$(cat logs/api-server.pid)
    if kill -0 $PID 2>/dev/null; then
        kill $PID
        echo "✅ API Server detenido (PID: $PID)"
    fi
    rm -f logs/api-server.pid
fi

# Detener Bridge
if [ -f "logs/bridge.pid" ]; then
    PID=$(cat logs/bridge.pid)
    if kill -0 $PID 2>/dev/null; then
        kill $PID
        echo "✅ Bridge detenido (PID: $PID)"
    fi
    rm -f logs/bridge.pid
fi

# Matar cualquier proceso node relacionado
pkill -f "operator.mjs --server" 2>/dev/null || true
pkill -f "bridge/bridge.mjs" 2>/dev/null || true

echo "✅ Todos los servicios detenidos"

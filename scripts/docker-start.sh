#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# 🤖 Operator Pro v4.1 — Docker Start Script
# Starts Xvfb (virtual display) + Operator Pro server
# Auto-restarts on token exhaustion (Docker restart: always)
# ═══════════════════════════════════════════════════════════════

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          🤖 OPERATOR PRO v4.1 — Starting Up                  ║"
echo "╚══════════════════════════════════════════════════════════════╝"

# Start virtual display (for headless browser)
if command -v Xvfb &> /dev/null; then
    Xvfb :99 -screen 0 1280x720x24 -ac &
    echo "✅ Xvfb started on :99"
    sleep 1
fi

# Check for API keys
if [ -z "$OPENCODE_ZEN_API_KEY" ] && [ -z "$GMI_API_KEY" ] && [ -z "$OPENAI_API_KEY" ] && [ -z "$ANTHROPIC_API_KEY" ]; then
    echo "⚠️  WARNING: No AI provider API keys detected!"
    echo "   Set at least OPENCODE_ZEN_API_KEY in your environment."
    echo "   Free keys available at https://opencode.ai/auth"
fi

# Ensure data directory exists
mkdir -p /app/data /app/screenshots /app/logs

echo ""
echo "📡 Starting Operator Pro server..."
echo "   Port: ${OPERATOR_PORT:-3000}"
echo "   Dashboard: http://localhost:${OPERATOR_PORT:-3000}/dashboard"
echo ""

# Start the server
# If it crashes (exit 1), Docker will auto-restart (restart: always)
exec node operator/server/start.mjs --server --headless

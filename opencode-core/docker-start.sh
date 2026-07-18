#!/bin/bash
export PORT="${PORT:-21293}"

if command -v opencode >/dev/null 2>&1; then
  echo "[start] OpenCode CLI encontrado, iniciando opencode serve en puerto $PORT..."
  opencode serve --port "$PORT"
else
  echo "[start] opencode no disponible, usando serve.js como fallback en puerto $PORT..."
  node /app/serve.js
fi

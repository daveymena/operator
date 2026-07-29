#!/bin/bash
export OPENCODE_PORT="${OPENCODE_PORT:-${OPENCODE_INTERNAL_PORT:-${PORT:-21294}}}"

# `command -v opencode` solo confirma que el archivo existe: si opencode-ai se
# instaló con --ignore-scripts (o pnpm), el binario es un stub que siempre
# imprime un error y sale con código 1. Por eso verificamos que --version
# realmente funcione antes de confiar en él.
if command -v opencode >/dev/null 2>&1 && opencode --version >/dev/null 2>&1; then
  echo "[start] OpenCode CLI funcional, iniciando la UI oficial (opencode web) en puerto $OPENCODE_PORT..."
  exec opencode web --hostname 0.0.0.0 --port "$OPENCODE_PORT"
else
  echo "[start] opencode no disponible o no funcional, usando serve.js como fallback en puerto $OPENCODE_PORT..."
  export PORT="$OPENCODE_PORT"
  exec node /app/serve.js
fi

#!/bin/bash
set -e
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WORKSPACE="$SCRIPT_DIR/.."
export OPENCODE_WORKSPACE="$WORKSPACE"

if [ -f "$WORKSPACE/.env" ]; then
  set -o allexport
  source "$WORKSPACE/.env"
  set +o allexport
fi

FREEMODEL_API_KEY="${FREEMODEL_API_KEY}"
PROXY_PORT="${PORT:-21293}"
OC_PORT=$(( PROXY_PORT + 1 ))
mkdir -p "$WORKSPACE/proyectos"

echo "Starting OpenCode on port $OC_PORT..."
PORT=$OC_PORT "$WORKSPACE/bin/opencode" serve --port $OC_PORT --hostname 0.0.0.0 &
OC_PID=$!

echo "Waiting for OpenCode..."
for i in $(seq 1 30); do
  if curl -s --connect-timeout 1 "http://localhost:$OC_PORT/" >/dev/null 2>&1; then
    echo "OpenCode ready"
    break
  fi
  sleep 1
done

echo "Starting proxy on port $PROXY_PORT..."
PORT="$PROXY_PORT" OPENCODE_INTERNAL_PORT="$OC_PORT" node "$WORKSPACE/artifacts/opencode-ui/proxy.mjs" &
PROXY_PID=$!

echo "OpenCode Evolved at http://0.0.0.0:$PROXY_PORT"
wait $PROXY_PID

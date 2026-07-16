#!/bin/bash
set -e
cd /home/kenneth/Hello-World

# Source env
if [ -f .env ]; then
  set -o allexport
  source .env
  set +o allexport
fi

echo "Starting OpenCode serve on port 21294..."
setsid /home/kenneth/Hello-World/bin/opencode serve \
  --port 21294 \
  --hostname 0.0.0.0 \
  > /tmp/oc-serve.log 2>&1 &

sleep 5

echo "Starting proxy on port 21293..."
setsid node /home/kenneth/Hello-World/artifacts/opencode-ui/proxy.mjs \
  > /tmp/oc-proxy.log 2>&1 &

echo "Done. Check: http://172.28.94.124:21293"

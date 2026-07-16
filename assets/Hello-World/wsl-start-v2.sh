#!/bin/bash
cd /home/kenneth/Hello-World
source .env

echo "Iniciando OpenCode serve..."
nohup ./bin/opencode serve -p 21294 --mcp --hostname 0.0.0.0 > /tmp/oc-serve.log 2>&1 &
OC_PID=$!
echo "OC PID: $OC_PID"

sleep 5

echo "Iniciando proxy..."
nohup node /home/kenneth/Hello-World/artifacts/opencode-ui/proxy.mjs > /tmp/oc-proxy.log 2>&1 &
PX_PID=$!
echo "Proxy PID: $PX_PID"

echo "OC PID=$OC_PID" > /tmp/oc-pids.txt
echo "PX PID=$PX_PID" >> /tmp/oc-pids.txt
echo "Listo"
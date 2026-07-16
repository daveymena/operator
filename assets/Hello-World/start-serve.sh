#!/bin/bash
cd /home/kenneth/Hello-World
source .env 2>/dev/null || true
nohup ./bin/opencode serve --port 21294 --hostname 0.0.0.0 > /tmp/oc-serve.log 2>&1 &
echo $! > /tmp/oc-serve.pid
echo "Serve PID: $(cat /tmp/oc-serve.pid)"

# Wait for it to start
sleep 5
curl -s --connect-timeout 3 http://localhost:21294/ > /dev/null 2>&1 && echo "OK" || echo "FAIL"
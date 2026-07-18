#!/bin/sh
unset OPENCODE_SERVER_PASSWORD
cd /app

# Start OpenCode web
opencode web --hostname 0.0.0.0 --port 21293 &
sleep 3

# Agent Server (PC Agents desde Windows)
node agent-server.mjs &
sleep 1

# Bridge Server
node bridge-server.mjs &

wait

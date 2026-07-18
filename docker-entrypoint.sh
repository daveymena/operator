#!/bin/sh
cd /app

# Start OpenCode web with a clean environment (no OPENCODE_SERVER_PASSWORD)
env -u OPENCODE_SERVER_PASSWORD opencode web --hostname 0.0.0.0 --port 21293 &

sleep 3

# Agent Server (PC Agents desde Windows)
node agent-server.mjs &

sleep 1

# Bridge Server
node bridge-server.mjs &

wait

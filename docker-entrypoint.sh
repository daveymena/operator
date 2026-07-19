#!/bin/sh
# Strip all env vars and start with clean environment
cd /app
exec env -i PATH="$PATH" HOME="$HOME" NODE_ENV=production opencode web --hostname 0.0.0.0 --port 21293

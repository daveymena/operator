#!/bin/sh
# Clear the env var that Easypanel injects
unset OPENCODE_SERVER_PASSWORD
exec opencode web --hostname 0.0.0.0 --port 21293

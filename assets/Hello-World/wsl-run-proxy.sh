#!/bin/bash
cd /mnt/c/Users/ADMIN/Music/Hello-World
export PORT=21293
export OPENCODE_INTERNAL_PORT=21294
exec node artifacts/opencode-ui/proxy.mjs

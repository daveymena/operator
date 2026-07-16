#!/bin/bash
SRC="/mnt/c/Users/ADMIN/Downloads/Hello-World"
DST="/mnt/c/Users/ADMIN/Music/Hello-World"

rm -f "$DST/node_modules"
ln -sf "$SRC/node_modules" "$DST/node_modules"
echo "linked root node_modules"

for dir in artifacts/opencode-ui/node_modules artifacts/api-server/node_modules lib/db/node_modules lib/api-zod/node_modules lib/api-client-react/node_modules lib/integrations-anthropic-ai/node_modules; do
  if [ -d "$SRC/$dir" ]; then
    rm -f "$DST/$dir"
    ln -sf "$SRC/$dir" "$DST/$dir"
    echo "linked $dir"
  else
    echo "src missing: $SRC/$dir"
  fi
done

#!/bin/bash
# ============================================================
# Instala dependencias de los skills cuando sus proyectos
# fuente están montados en el contenedor.
# ============================================================
set -e

log() {
  echo "[setup-skills] $*"
}

# Claro Agent
if [ -d "/app/skills/claro-agent/src" ] && [ -f "/app/skills/claro-agent/src/package.json" ]; then
  log "Instalando dependencias Node de claro-agent..."
  cd /app/skills/claro-agent/src
  npm install 2>/dev/null || log "  ⚠  npm install falló en claro-agent/src"
  cd /app
fi

if [ -d "/app/skills/claro-agent/src" ] && [ -f "/app/skills/claro-agent/requirements.txt" ]; then
  log "Instalando dependencias Python de claro-agent..."
  pip3 install -r /app/skills/claro-agent/requirements.txt 2>/dev/null || log "  ⚠  pip install falló en claro-agent"
fi

# Preoperacional Nova
if [ -d "/app/skills/preoperacional-nova/src" ] && [ -f "/app/skills/preoperacional-nova/src/package.json" ]; then
  log "Instalando dependencias Node de preoperacional-nova..."
  cd /app/skills/preoperacional-nova/src
  npm install 2>/dev/null || log "  ⚠  npm install falló en preoperacional-nova/src"
  cd /app
fi

log "Setup de skills finalizado"

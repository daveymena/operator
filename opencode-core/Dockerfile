FROM node:22-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=America/Bogota
ENV NODE_ENV=production
ENV DISPLAY=:99
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV CHROMIUM_FLAGS="--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage --disable-gpu --disable-software-rasterizer"

# Chromium + system deps para Playwright + Xvfb/VNC
RUN apt-get update && apt-get install -y \
    ca-certificates curl wget gnupg \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libgbm1 libasound2 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libpango-1.0-0 libcairo2 libx11-6 libx11-xcb1 \
    libxcb1 libxext6 libxss1 libxtst6 libxcb-dri3-0 \
    fonts-liberation fonts-freefont-ttf \
    xvfb x11vnc novnc python3-netifaces \
    procps netcat-openbsd tzdata python3 python3-pip ffmpeg \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar e instalar dependencias raíz (ws para agent-server/bridge, dotenv para serve.js)
COPY package.json ./
RUN npm install && npm install dotenv

# Instalar opencode-ai CLI globalmente (OpenCode engine + UI)
RUN npm install -g opencode-ai --ignore-scripts 2>/dev/null || true

# Instalar MiMoCode CLI globalmente (MCP server + agent capabilities)
# NOTA: Si tienes acceso al binario oficial de MiMoCode, reemplaza esta línea con:
#   COPY mimo /usr/local/bin/mimo && chmod +x /usr/local/bin/mimo
# Por ahora intentamos instalar via npm:
RUN npm install -g @anthropic-ai/claude-code 2>/dev/null || \
    echo "[docker] MiMoCode CLI no disponible via npm — el servidor MCP usará su propia implementación"

# Ejecutar postinstall de opencode-ai (instala Playwright + Chromium)
RUN node -e "const p=['/usr/lib/node_modules/opencode-ai','/usr/local/lib/node_modules/opencode-ai'].find(p=>require('fs').existsSync(p+'/postinstall.mjs'));if(p)require('child_process').execSync('node postinstall.mjs',{cwd:p,stdio:'inherit',env:{...process.env,PLAYWRIGHT_BROWSERS_PATH:'/ms-playwright'}})" 2>/dev/null || true

# Instalar Chromium explícitamente si postinstall falló
RUN npx playwright install chromium --with-deps 2>/dev/null || true

COPY web-operator/package.json web-operator/
RUN cd web-operator && npm install

COPY artifacts/opencode-ui/package.json artifacts/opencode-ui/
RUN cd artifacts/opencode-ui && npm install

COPY . .
# Copiar configuración de MiMoCode (MCP servers, skills, permisos)
COPY .mimocode /app/.mimocode/

# REMOVIDO: No copiar UI standalone para permitir el uso de la UI original de OpenCode
# RUN mkdir -p /app/ui && cp /app/artifacts/opencode-ui/ui/index.html /app/ui/index.html 2>/dev/null || true

RUN rm -f /app/pnpm-workspace.yaml /app/pnpm-lock.yaml /app/bun.lock

RUN mkdir -p /app/skills-data /app/skills/claro-agent/src /app/skills/preoperacional-nova/src

COPY skills/claro-agent/requirements.txt /app/skills/claro-agent/requirements.txt
RUN pip3 install -r /app/skills/claro-agent/requirements.txt --break-system-packages 2>/dev/null || pip3 install -r /app/skills/claro-agent/requirements.txt || true

COPY skills/setup-skills.sh /app/skills/setup-skills.sh
RUN chmod +x /app/docker-start.sh /app/skills/setup-skills.sh

EXPOSE 3000 3001 21291 21294 21295 21296 6080 5900

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -sf http://localhost:21294/health || exit 1

CMD ["/app/docker-start.sh"]

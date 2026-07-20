FROM node:22-bookworm-slim

# ─── System dependencies ───────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl git wget gnupg procps \
    # Chromium dependencies for Playwright/Puppeteer
    libnss3 libatk-bridge2.0-0 libdrm2 libxcomposite1 libxdamage1 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 \
    libatspi2.0-0 libcups2 libxshmfence1 fonts-liberation \
    xdg-utils \
    # Python for opencode
    python3 python3-pip python3-venv \
    # Utilities
    jq xclip \
    && rm -rf /var/lib/apt/lists/*

# ─── Install Chromium ──────────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends chromium && \
    ln -sf /usr/bin/chromium /usr/bin/chromium-browser && \
    rm -rf /var/lib/apt/lists/*

# ─── Install OpenCode CLI ──────────────────────────────────────────────────────
RUN npm install -g opencode-ai@1.18.3 || echo "OpenCode install skipped"

# ─── App directory ─────────────────────────────────────────────────────────────
WORKDIR /app

# ─── Copy package files and install dependencies ──────────────────────────────
COPY package.json package-lock.json* ./
RUN npm install --production --ignore-scripts=false 2>/dev/null || npm install --production

# ─── Copy Operator Pro v3.0 (new architecture) ───────────────────────────────
COPY operator/ ./operator/
COPY bridge/ ./bridge/
COPY dashboard/ ./dashboard/
COPY operator.mjs ./operator.mjs
COPY opencode.json ./opencode.json

# ─── Copy legacy opencode-core (backward compatibility) ──────────────────────
COPY opencode-core/ ./opencode-core/

# ─── Copy startup scripts ─────────────────────────────────────────────────────
COPY docker-entrypoint.sh /docker-entrypoint.sh
COPY start.sh ./start.sh
COPY stop.sh ./stop.sh
RUN chmod +x /docker-entrypoint.sh start.sh stop.sh

# ─── Create required directories ──────────────────────────────────────────────
RUN mkdir -p screenshots logs config /workspace \
    /root/.local/share/opencode \
    /root/.config/opencode

# ─── Environment variables ────────────────────────────────────────────────────
ENV NODE_ENV=production \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    CHROME_BIN=/usr/bin/chromium \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    DISPLAY=:99 \
    OPERATOR_PORT=3000 \
    BRIDGE_PORT=20100

# ─── Expose ports ─────────────────────────────────────────────────────────────
# 3000  = Operator Pro API + Dashboard
# 20100 = Bridge WebSocket
# 21291 = Agent Server
# 21293 = OpenCode Web
# 21295 = Hermes Bridge
EXPOSE 3000 20100 21291 21293 21295

ENTRYPOINT ["/docker-entrypoint.sh"]

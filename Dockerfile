# ═══════════════════════════════════════════════════════════════
# 🤖 Operator Pro v4.1 — Dockerfile
# DB-backed, Auto-restart, Token rotation
# ═══════════════════════════════════════════════════════════════

FROM node:22-slim

# Install system deps + Chromium for browser automation
RUN apt-get update && apt-get install -y \
    chromium \
    curl \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    xvfb \
    x11vnc \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Chromium path
ENV CHROME_PATH=/usr/bin/chromium
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV DISPLAY=:99

WORKDIR /app

# Copy package files first (layer caching)
COPY package*.json ./
RUN npm ci --omit=dev 2>/dev/null || npm install --production 2>/dev/null || true

# Copy source
COPY . .

# Create required directories
RUN mkdir -p /app/data /app/screenshots /app/logs /workspace

# Expose ports
EXPOSE 3000 21291 21294

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start script
COPY scripts/docker-start.sh /docker-start.sh
RUN chmod +x /docker-start.sh

CMD ["/docker-start.sh"]

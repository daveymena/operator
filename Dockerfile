FROM node:22-slim

ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=America/Bogota
ENV NODE_ENV=production
ENV DISPLAY=:99

RUN apt-get update && apt-get install -y \
    ca-certificates curl wget gnupg \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libgbm1 libasound2 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libpango-1.0-0 libcairo2 libx11-6 libx11-xcb1 \
    libxcb1 libxext6 libxss1 libxtst6 libxcb-dri3-0 \
    fonts-liberation fonts-freefont-ttf \
    xvfb x11vnc novnc python3-netifaces \
    procps netcat-openbsd tzdata python3 python3-pip ffmpeg git \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY opencode-core/package.json ./
RUN npm install

COPY opencode-core/ .

RUN mkdir -p /app/skills-data /app/skills/claro-agent/src /app/skills/preoperacional-nova/src

RUN npm install -g opencode-ai 2>/dev/null || echo "[docker] opencode-ai no disponible"

RUN npm install -g @anthropic-ai/claude-code 2>/dev/null || true

RUN if command -v opencode >/dev/null 2>&1; then \
      npx playwright install chromium --with-deps 2>/dev/null || true; \
    fi

RUN if [ -f /app/skills/claro-agent/requirements.txt ]; then \
      pip3 install -r /app/skills/claro-agent/requirements.txt --break-system-packages 2>/dev/null || \
      pip3 install -r /app/skills/claro-agent/requirements.txt || true; \
    fi

RUN pip3 install hermes-core 2>/dev/null || echo "[docker] hermes-core no disponible en pip"

RUN chmod +x /app/docker-start.sh /app/skills/setup-skills.sh 2>/dev/null || true

EXPOSE 21293 21291 21295 5900 6080

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -sf http://localhost:21293/ || exit 1

CMD ["/app/docker-start.sh"]

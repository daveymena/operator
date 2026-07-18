FROM node:22-slim

ENV NODE_ENV=production
ENV PORT=21293

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN npm install -g opencode-ai --ignore-scripts 2>&1 || echo "[docker] opencode-ai no instalado"

COPY opencode-core/package.json ./
RUN npm install

COPY opencode-core/ .

EXPOSE 21293

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -sf http://localhost:21293/ || exit 1

CMD ["node", "serve.js"]

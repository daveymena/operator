FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl git \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g opencode-ai

RUN npx playwright install chromium --with-deps 2>/dev/null || true

EXPOSE 21293

CMD ["opencode", "web", "--hostname", "0.0.0.0", "--port", "21293"]

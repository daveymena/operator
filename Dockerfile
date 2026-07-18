FROM node:22-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl git \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g opencode-ai@1.18.3

COPY opencode-core/package.json /app/package.json
RUN cd /app && npm install

COPY opencode-core/agent-server.mjs /app/agent-server.mjs
COPY opencode-core/bridge-server.mjs /app/bridge-server.mjs
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 21293 21291 21295

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD []

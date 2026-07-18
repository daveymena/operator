FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl git \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g opencode-ai@1.18.3

EXPOSE 21293

CMD sh -c 'unset OPENCODE_SERVER_PASSWORD && exec opencode web --hostname 0.0.0.0 --port 21293'

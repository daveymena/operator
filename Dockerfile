FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g opencode-ai

EXPOSE 21293

ENV OPENCODE_SERVER_PASSWORD=${OPENCODE_SERVER_PASSWORD:-opencode}
ENV OPENCODE_SERVER_USERNAME=opencode

CMD ["opencode", "web", "--hostname", "0.0.0.0", "--port", "21293"]

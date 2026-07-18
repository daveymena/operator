FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates curl git \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g opencode-ai

# Force cache invalidation - rebuild 1
RUN echo "build-$(date +%s)" > /dev/null

ENV OPENCODE_SERVER_PASSWORD=""

EXPOSE 21293

CMD ["opencode", "web", "--hostname", "0.0.0.0", "--port", "21293"]

FROM node:22-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates gnupg \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000
EXPOSE 21291
EXPOSE 20100

ENV NODE_ENV=production
ENV BRAIN_BACKEND=nvidia
ENV NVIDIA_API_KEY=${NVIDIA_API_KEY}

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode===200?0:1))" || exit 1

CMD ["node", "server-easypanel.mjs"]

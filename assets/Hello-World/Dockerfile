FROM node:20-bullseye

# FORCE REBUILD - 2026-07-11-17:15 - Fix startup sequence
# Instalar dependencias del sistema requeridas para Playwright
RUN npx playwright install-deps

# Establecer directorio de trabajo
WORKDIR /app

# Copiar el código fuente al contenedor
COPY . /app

# Instalar OpenCode y MiMo globalmente
RUN npm install -g opencode-ai @mimo-ai/cli pm2

# Instalar dependencias del proxy (opencode-ui)
RUN cd artifacts/opencode-ui && npm install

# NOTA: No construimos el frontend React porque OpenCode usa interfaz nativa.
# El proxy solo sirve archivos estáticos de /public (shell.css, shell.js)

# Instalar dependencias del web operator
RUN cd web-operator && npm install

# Instalar los navegadores de Playwright para el Web Operator
RUN cd web-operator && npx playwright install chromium

# Exponer el puerto principal (proxy OpenCode)
EXPOSE 3000

# Variables de entorno por defecto
ENV PORT=3000
ENV DOCKER=true
ENV EASYPANEL=true

# Healthcheck mejorado que verifica el endpoint de salud primero
HEALTHCHECK --interval=30s --timeout=10s --start-period=90s --retries=5 \
  CMD curl -f http://127.0.0.1:3000/__health || curl -f http://localhost:3000/__health || exit 1

# Script de arranque
CMD ["bash", "docker/start.sh"]

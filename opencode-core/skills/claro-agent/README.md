# Skill: Claro Agent

Integra el proyecto `claro_agente_final` dentro de OpenCode Evolved.

## Cómo funciona

El wrapper (`skill.js`) ejecuta los scripts originales del proyecto de Claro
montados como volumen en el contenedor Docker.

## Montaje del proyecto original

Copia o monta el proyecto original en:

```
/app/skills/claro-agent/src
```

Desde EasyPanel puedes usar un bind-mount apuntando a la ruta del proyecto
en el host, o subir el contenido vía Dockerfile.

## Variables de entorno

| Variable | Descripción |
|----------|-------------|
| `CLARO_SKILL_SRC` | Ruta al proyecto original (default `/app/skills/claro-agent/src`) |
| `CLARO_SKILL_DATA` | Ruta para datos persistentes del skill |
| `CLARO_FORM_URL` | URL del Google Form |
| `GOOGLE_EMAIL` / `GOOGLE_PASSWORD` | Credenciales Google |
| `GOOGLE_IMAP_PASSWORD` | App password de Gmail para verificación |
| `TECH_CEDULA`, `TECH_NOMBRE`, `TECH_TELEFONO`, `TECH_CIUDAD` | Datos del técnico |
| `FREEMODEL_API_KEY`, `GROQ_API_KEY` | APIs de IA |
| `PUPPETEER_EXECUTABLE_PATH` | Ruta a Chromium en Docker (default `/usr/bin/chromium`) |

## Endpoints expuestos por Web Operator

- `POST /api/skills/claro/order` — procesar una orden
  Body: `{ "order": "texto de la orden", "options": {...} }`
- `POST /api/skills/claro/run-pending` — ejecutar órdenes pendientes
- `GET /api/skills/claro/status` — estado del skill

## Nota importante

El proyecto original está hardcodeado para Windows/Chrome visible.
Para que funcione en Docker se recomienda:

1. Usar `headless: true` en los scripts de Puppeteer.
2. Leer credenciales desde variables de entorno.
3. Usar `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium`.
4. Evitar rutas fijas de Windows.

Si no puedes modificar el original, crea una copia adaptada en `src/`
dentro de este skill.

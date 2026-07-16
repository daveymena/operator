# Memoria del Workspace - OpenCode en Replit

## Entorno
- **Sistema**: Replit — Linux NixOS
- **Directorio raíz del workspace**: `/home/runner/workspace`
- **Directorio de proyectos**: `/home/runner/workspace/proyectos/`
- **Node.js 24** disponible, **pnpm** como gestor de paquetes
- **Bun** disponible para JavaScript/TypeScript
- **Python 3** disponible

## Proveedores de IA Disponibles (sin API key propia)
Todos los modelos usan las integraciones internas de Replit — no necesitas poner tu propia API key.

### Gratuitos
- `opencode/big-pickle` — modelo gratuito de OpenCode
- `opencode/gpt-5-nano` — GPT-5 nano gratuito
- `opencode/mimo-v2-omni-free` — MiMo V2 gratuito
- `opencode/mimo-v2-pro-free` — MiMo V2 Pro gratuito
- `opencode/minimax-m2.5-free` — MiniMax gratuito
- `opencode/nemotron-3-super-free` — Nemotron gratuito

### Anthropic Claude
- `anthropic/claude-sonnet-4-6` ← **Recomendado** — Balance rendimiento/velocidad
- `anthropic/claude-opus-4-6` — Más capaz, tareas complejas
- `anthropic/claude-haiku-4-5` — Más rápido

### OpenAI GPT
- `openai/gpt-5` — GPT-5 completo
- `openai/gpt-5-mini` — GPT-5 mini (eficiente)
- `openai/gpt-5-nano` — GPT-5 nano (rápido)
- `openai/gpt-4o` — GPT-4o

### Google Gemini
- `google/gemini-2.5-pro` — Gemini 2.5 Pro
- `google/gemini-2.5-flash` — Gemini 2.5 Flash (rápido)
- `google/gemini-2.5-flash-lite` — Gemini 2.5 Flash Lite

## Cómo crear y ejecutar proyectos
Para crear un nuevo proyecto dentro del ecosistema:
1. Crea una carpeta en `/home/runner/workspace/proyectos/nombre-proyecto`
2. Usa las herramientas de bash para inicializar: `cd proyectos/nombre && npm init` o `pnpm create vite`
3. Ejecuta el proyecto directamente con bash: el puerto estará disponible en el entorno

## Estructura del Workspace
```
/home/runner/workspace/
├── proyectos/          ← Tus proyectos personales
├── artifacts/          ← Apps del ecosistema (opencode, api, etc.)
├── lib/                ← Librerías compartidas
├── bin/opencode        ← Binario de OpenCode
└── .opencode/
    └── memory.md       ← Este archivo (memoria persistente)
```

## Notas importantes
- Los archivos en `/home/runner/workspace/` persisten entre sesiones
- Las sesiones de OpenCode se guardan en SQLite y no se pierden
- Puedes cambiar el modelo en cualquier momento desde el selector de modelo en la UI

# Facebook Ads API — Guía para el Operator

## Configuración actual del proyecto
- **Business Manager ID:** 4482432028697067
- **Page ID (VentasPro):** 1278583508663384 (antes 61591838792522)
- **Ad Account ID:** 1545022093928422
- **Token:** En `facebook-automation/tokens/fb_tokens_output.json`
- **Catálogo digital:** `facebook-automation/tokens/megapack-82-productos.json` (82 cursos, 20,000 COP)
- **Catálogo físico:** `facebook-automation/tokens/catalogo-completo-importar.json` (productos tecnológicos)
- **Ad creatives:** `facebook-automation/ads/ad-creatives.mjs` (8 categorías con hooks, body, image prompts)
- **Campaign package:** `facebook-automation/ads/campaign-package/` (JSON, DALL-E prompts, copy templates)
- **Drafts generados:** `facebook-automation/tokens/ad-drafts.json`

## Endpoints Graph API v21.0
```
BASE: https://graph.facebook.com/v21.0

POST /act_{AD_ACCOUNT}/campaigns   → Crear campaña
POST /act_{AD_ACCOUNT}/adsets       → Crear conjunto de anuncios
POST /act_{AD_ACCOUNT}/adcreatives  → Crear creativo
POST /act_{AD_ACCOUNT}/ads          → Crear anuncio
GET  /act_{AD_ACCOUNT}/campaigns    → Listar campañas
GET  /act_{AD_ACCOUNT}/insights     → Obtener métricas
```

## Categorías de productos digitales
1. Diseño Gráfico (Photoshop, Illustrator, Canva, Filmora, Lettering)
2. Programación (Web, Videojuegos, Animación 3D, Cinema 4D)
3. Marketing (SEO, Ecommerce, Branding, Redes)
4. Idiomas y Desarrollo (Inglés, Locución, Psicología, Memoria)
5. Oficina (Excel, Office, WordPress)
6. Ingeniería (Revit, AutoCAD, Planos, Drywall)
7. Ciberseguridad (Hacking Ético)
8. MegaPack Completo (81 cursos en 1)
9. Piano (Curso completo de piano)

## Estrategia de campañas
- Presupuesto: 5,000-15,000 COP/día por categoría
- Objetivo: OUTCOME_SALES
- Estado: PAUSED (borradores)
- Targeting: Colombia, 18-65 años, Online Learning interés
- CTA: LEARN_MORE → WhatsApp link
- Formato: 1080×1350 (4:5) para Facebook Feed

## Para crear campañas
Usa el script: `node facebook-automation/scripts/ads/crear-campanias-catalogo.mjs`
O usa puppeteer: `node facebook-automation/scripts/ads/crear-borradores-adsmanager.mjs`

## Token
El token está en `fb_tokens_output.json`. Si expira, regenerar desde Facebook System Users o Graph API Explorer.

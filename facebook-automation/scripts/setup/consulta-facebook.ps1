Write-Host "╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   CONSULTA: FACEBOOK BUSINESS + SALES BOT                ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# CATALOGO DE PRODUCTOS
Write-Host "=== 📦 CATÁLOGO DE PRODUCTOS (102 items) ===" -ForegroundColor Yellow
$prods = Get-Content "C:\Users\ADMIN\Music\catalogo-completo-importar.json" -Raw | ConvertFrom-Json
$cats = $prods | Group-Object category
foreach ($c in $cats) { Write-Host "  $($c.Name): $($c.Count) productos" }
Write-Host ""

# FACEBOOK BUSINESS MANAGER
Write-Host "=== 📊 FACEBOOK BUSINESS MANAGER ===" -ForegroundColor Yellow
Write-Host "  Business Manager ID: 4482432028697067"
Write-Host "  Page ID: 1278583508663384"
Write-Host "  Access Token: ❌ VACÍO (configurar en dashboard)"
Write-Host ""

# AGENTE DE VENTAS (SOFÍA)
Write-Host "=== 🤖 AGENTE DE VENTAS (SOFÍA) ===" -ForegroundColor Yellow
Write-Host "  Nombre: Sofía 2.1 (Edición Elite)"
Write-Host "  Modelo IA: Kimi 2.6 (NVIDIA NIM) + FreeModel (deepseek-v4-flash-free)"
Write-Host "  Canales: WhatsApp | Facebook Messenger | Marketplace | Comments"
Write-Host "  Pagos: Nequi (3136174267) | Mercado Pago | PayPal"
Write-Host "  Admin: 573042748687"
Write-Host "  Dashboard: http://localhost:3002"
Write-Host ""

# RESUMEN
Write-Host "=== 🎯 LO QUE PROMOCIONA ===" -ForegroundColor Green
Write-Host "  1. Laptops y Portátiles (Acer, Asus, MacBook Pro M4)"
Write-Host "  2. Monitores (LG curvo, ultrawide, 4K)"
Write-Host "  3. Periféricos (teclados Logitech, mouse, combos)"
Write-Host "  4. Audífonos/Diademas (Logitech G, Astro)"
Write-Host "  5. Impresoras/Escáneres (Brother, Epson)"
Write-Host "  6. Accesorios tecnológicos varios"
Write-Host ""

Write-Host "=== ⚠️ LO QUE FALTA PARA ACTIVAR TODO ===" -ForegroundColor Red
Write-Host "  1. FB_ACCESS_TOKEN en .env (dashboard TecnoVariedades)"
Write-Host "  2. FB_AD_ACCOUNT_ID para crear anuncios"
Write-Host "  3. FB_MESSENGER_PAGE_TOKEN para Messenger Bot"
Write-Host "  4. FB_PIXEL_ID para tracking de conversiones"
Write-Host ""

Write-Host "Para obtener tokens:"
Write-Host "  node C:\Users\ADMIN\Videos\Agent-Sales-Bot\extract_fb_tokens.js"
Write-Host "  (necesita Chrome abierto con --remote-debugging-port=9222)"

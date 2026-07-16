# ============================================================
#  OpenCode Evolved — Instalador para Windows
#  Ejecutar en PowerShell como Administrador:
#  Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
#  .\deploy-windows.ps1
# ============================================================

$ErrorActionPreference = "Stop"

Write-Host "╔══════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     OpenCode Evolved — Windows Setup     ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ── Verificar Docker Desktop ─────────────────────────────────
Write-Host "1. Verificando Docker Desktop..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version
    Write-Host "   ✅ Docker instalado: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Docker no encontrado." -ForegroundColor Red
    Write-Host "   Descarga Docker Desktop desde: https://www.docker.com/products/docker-desktop" -ForegroundColor White
    Write-Host "   Instálalo, reinicia y vuelve a ejecutar este script." -ForegroundColor White
    Read-Host "Presiona Enter para salir"
    exit 1
}

# ── Verificar Git ─────────────────────────────────────────────
Write-Host "2. Verificando Git..." -ForegroundColor Yellow
try {
    $gitVersion = git --version
    Write-Host "   ✅ Git instalado: $gitVersion" -ForegroundColor Green
} catch {
    Write-Host "   ⚠️  Git no encontrado. Instalando via winget..." -ForegroundColor Yellow
    winget install --id Git.Git -e --source winget
}

# ── Crear .env desde .env.example ────────────────────────────
Write-Host "3. Configurando variables de entorno..." -ForegroundColor Yellow
if (-not (Test-Path ".env")) {
    if (Test-Path ".env.example") {
        Copy-Item ".env.example" ".env"
        Write-Host "   ✅ Archivo .env creado desde .env.example" -ForegroundColor Green
        Write-Host "   ⚠️  IMPORTANTE: Edita el archivo .env con tus API keys antes de continuar" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "   Abre .env con:" -ForegroundColor White
        Write-Host "   notepad .env" -ForegroundColor Cyan
        Write-Host ""
        $confirm = Read-Host "¿Ya editaste el .env con tus API keys? (s/n)"
        if ($confirm -ne "s") {
            Write-Host "Edita .env y vuelve a ejecutar el script." -ForegroundColor Yellow
            exit 0
        }
    } else {
        Write-Host "   ⚠️  No se encontró .env.example. Creando .env básico..." -ForegroundColor Yellow
        @"
# OpenCode Evolved — Variables de entorno
PORT=3000
TZ=America/Bogota

# FreeModel (GPT-4o GRATIS)
FREEMODEL_API_KEY=
FREEMODEL_BASE_URL=https://api.freemodel.dev/v1
FREEMODEL_MODEL=gpt-4o

# OpenAI
OPENAI_API_KEY=

# Anthropic
ANTHROPIC_API_KEY=

# Groq (gratis)
GROQ_API_KEY=

# Base de datos (dejar vacío para usar PostgreSQL local del compose)
DB_PASSWORD=opencode123
"@ | Out-File -FilePath ".env" -Encoding UTF8
        Write-Host "   ✅ .env básico creado. Edítalo con tus API keys." -ForegroundColor Green
        notepad .env
        $confirm = Read-Host "¿Listo? (s/n)"
        if ($confirm -ne "s") { exit 0 }
    }
} else {
    Write-Host "   ✅ .env ya existe" -ForegroundColor Green
}

# ── Construir imagen Docker ───────────────────────────────────
Write-Host "4. Construyendo imagen Docker (puede tomar 5-10 min la primera vez)..." -ForegroundColor Yellow
docker compose build --no-cache
Write-Host "   ✅ Imagen construida" -ForegroundColor Green

# ── Iniciar servicios ─────────────────────────────────────────
Write-Host "5. Iniciando OpenCode Evolved..." -ForegroundColor Yellow
docker compose up -d
Write-Host "   ✅ Servicios iniciados" -ForegroundColor Green

# ── Esperar a que esté listo ──────────────────────────────────
Write-Host "6. Esperando a que OpenCode esté listo..." -ForegroundColor Yellow
$maxRetries = 40
$retries = 0
$ready = $false
while ($retries -lt $maxRetries -and -not $ready) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000" -TimeoutSec 2 -UseBasicParsing
        if ($response.StatusCode -eq 200) { $ready = $true }
    } catch {}
    if (-not $ready) {
        Start-Sleep -Seconds 2
        $retries++
        Write-Host "   ... ($retries/$maxRetries)" -ForegroundColor Gray
    }
}

if ($ready) {
    Write-Host "   ✅ OpenCode Evolved está listo!" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Tomando más tiempo de lo esperado. Revisa: docker compose logs" -ForegroundColor Yellow
}

# ── Resultado final ───────────────────────────────────────────
Write-Host ""
Write-Host "════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  ✅ OpenCode Evolved corriendo en Windows" -ForegroundColor Green
Write-Host ""
Write-Host "  🌐 Abrir en el navegador:" -ForegroundColor White
Write-Host "     http://localhost:3000" -ForegroundColor Cyan
Write-Host ""
Write-Host "  📋 Comandos útiles:" -ForegroundColor White
Write-Host "     docker compose logs -f    → Ver logs en tiempo real" -ForegroundColor Gray
Write-Host "     docker compose stop       → Detener" -ForegroundColor Gray
Write-Host "     docker compose up -d      → Iniciar de nuevo" -ForegroundColor Gray
Write-Host "     docker compose down       → Detener y eliminar" -ForegroundColor Gray
Write-Host "════════════════════════════════════════════" -ForegroundColor Cyan

# Abrir navegador automáticamente
Start-Sleep -Seconds 2
Start-Process "http://localhost:3000"

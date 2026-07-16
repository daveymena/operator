# Diagnóstico usando plink (PuTTY)
# Si no tienes plink, descarga desde: https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html

$server = "144.91.112.79"
$usuario = "root"
$password = "6715320Dvd."

Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  DIAGNÓSTICO CON PLINK" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Comando completo de diagnóstico
$comando = "echo '🔍 1. CONTENEDORES:' && docker ps --format 'table {{.Names}}\t{{.Ports}}' && echo '' && echo '🔍 2. PUERTO 3000:' && netstat -tlnp | grep :3000 && echo '' && echo '🔍 3. FIREWALL:' && ufw status && echo '' && echo '🔍 4. PRUEBA LOCAL:' && curl -I http://127.0.0.1:3000 2>&1 | head -10 && echo '' && echo '🔍 5. LOGS OPENCODE:' && docker logs --tail=20 `$(docker ps | grep -i opencode | awk '{print `$1}' | head -1) 2>&1"

# Verificar si plink está disponible
if (Get-Command plink -ErrorAction SilentlyContinue) {
    Write-Host "✅ Ejecutando con plink..." -ForegroundColor Green
    Write-Host ""
    
    # Ejecutar con plink
    echo y | plink -ssh -batch -pw $password "$usuario@$server" $comando
    
} else {
    Write-Host "❌ plink no está instalado." -ForegroundColor Red
    Write-Host ""
    Write-Host "OPCIÓN 1: Instalar plink" -ForegroundColor Yellow
    Write-Host "  Descarga: https://www.chiark.greenend.org.uk/~sgtatham/putty/latest.html" -ForegroundColor Gray
    Write-Host "  O ejecuta: winget install PuTTY.PuTTY" -ForegroundColor Gray
    Write-Host ""
    Write-Host "OPCIÓN 2: Ejecutar manualmente" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  1. Abre PowerShell y ejecuta:" -ForegroundColor Gray
    Write-Host "     ssh root@144.91.112.79" -ForegroundColor Green
    Write-Host ""
    Write-Host "  2. Ingresa la contraseña: $password" -ForegroundColor Green
    Write-Host ""
    Write-Host "  3. Copia y pega:" -ForegroundColor Gray
    Write-Host ""
    Write-Host $comando -ForegroundColor Green
}

Write-Host ""
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan

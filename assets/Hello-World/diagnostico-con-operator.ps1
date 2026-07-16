# Script para usar Web Operator local y diagnosticar EasyPanel
# Asegúrate de tener Web Operator corriendo localmente primero

Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  DIAGNÓSTICO EASYPANEL CON WEB OPERATOR" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$operatorUrl = "http://localhost:3002"
$easypanelUrl = "http://144.91.112.79:3000"

Write-Host "1️⃣ Verificando que Web Operator esté corriendo..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "$operatorUrl/api/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   ✅ Web Operator está activo" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Web Operator NO está corriendo" -ForegroundColor Red
    Write-Host "   Inicia Web Operator primero:" -ForegroundColor Yellow
    Write-Host "   cd web-operator" -ForegroundColor Gray
    Write-Host "   node api-server.js" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "2️⃣ Enviando tarea al Web Operator para diagnosticar EasyPanel..." -ForegroundColor Yellow
Write-Host ""

$task = @{
    goal = "Navega a $easypanelUrl, inicia sesión con email daveymena16@gmail.com y contraseña 6715320D. (prueba con y sin el punto final). Luego navega al proyecto 'tecnoia' -> app 'opencode'. Verifica la configuración del puerto (debe ser 3000), revisa los logs más recientes, y verifica si hay algún error o problema de configuración. Reporta todo lo que encuentres."
    url = $easypanelUrl
} | ConvertTo-Json

try {
    Write-Host "   📤 Enviando tarea..." -ForegroundColor Gray
    $result = Invoke-RestMethod -Uri "$operatorUrl/api/execute" -Method POST -Body $task -ContentType "application/json" -TimeoutSec 300
    
    Write-Host ""
    Write-Host "════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "  RESULTADO DEL DIAGNÓSTICO" -ForegroundColor Green
    Write-Host "════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host ""
    Write-Host $result.result -ForegroundColor White
    Write-Host ""
    
    if ($result.screenshots) {
        Write-Host "📸 Capturas guardadas:" -ForegroundColor Cyan
        foreach ($screenshot in $result.screenshots) {
            Write-Host "   $screenshot" -ForegroundColor Gray
        }
    }
    
} catch {
    Write-Host "   ❌ Error al ejecutar: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan

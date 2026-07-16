# Script para usar Web Operator para conectarse al servidor y diagnosticar
# Web Operator puede ejecutar comandos de terminal

Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  DIAGNÓSTICO SERVIDOR VIA WEB OPERATOR" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$operatorUrl = "http://localhost:3002"
$server = "144.91.112.79"
$usuario = "root"
$password = "6715320Dvd."

Write-Host "1️⃣ Verificando Web Operator..." -ForegroundColor Yellow

try {
    $health = Invoke-RestMethod -Uri "$operatorUrl/api/health" -Method GET -TimeoutSec 5 -ErrorAction Stop
    Write-Host "   ✅ Web Operator activo" -ForegroundColor Green
} catch {
    Write-Host "   ❌ Web Operator NO está corriendo" -ForegroundColor Red
    Write-Host ""
    Write-Host "   Inicia Web Operator:" -ForegroundColor Yellow
    Write-Host "   cd web-operator" -ForegroundColor Gray
    Write-Host "   node api-server.js" -ForegroundColor Gray
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "2️⃣ Conectando al servidor $server..." -ForegroundColor Yellow
Write-Host ""

# Tarea para Web Operator: conectarse por SSH y ejecutar diagnóstico
$task = @{
    action = "execute_terminal_command"
    commands = @(
        "ssh-keygen -R $server 2>&1",
        "sshpass -p '$password' ssh -o StrictHostKeyChecking=no $usuario@$server 'echo ""════════════════════════════════════════"""'",
        "sshpass -p '$password' ssh -o StrictHostKeyChecking=no $usuario@$server 'echo ""🔍 1. CONTENEDORES DOCKER:""'",
        "sshpass -p '$password' ssh -o StrictHostKeyChecking=no $usuario@$server 'docker ps --format ""table {{.Names}}\t{{.Ports}}""'",
        "sshpass -p '$password' ssh -o StrictHostKeyChecking=no $usuario@$server 'echo """" && echo ""🔍 2. OPENCODE ESPECÍFICO:""'",
        "sshpass -p '$password' ssh -o StrictHostKeyChecking=no $usuario@$server 'docker ps | grep -i opencode'",
        "sshpass -p '$password' ssh -o StrictHostKeyChecking=no $usuario@$server 'echo """" && echo ""🔍 3. PUERTO 3000:""'",
        "sshpass -p '$password' ssh -o StrictHostKeyChecking=no $usuario@$server 'netstat -tlnp | grep :3000'",
        "sshpass -p '$password' ssh -o StrictHostKeyChecking=no $usuario@$server 'echo """" && echo ""🔍 4. FIREWALL:""'",
        "sshpass -p '$password' ssh -o StrictHostKeyChecking=no $usuario@$server 'ufw status'",
        "sshpass -p '$password' ssh -o StrictHostKeyChecking=no $usuario@$server 'echo """" && echo ""🔍 5. PRUEBA LOCAL:""'",
        "sshpass -p '$password' ssh -o StrictHostKeyChecking=no $usuario@$server 'curl -I http://127.0.0.1:3000 2>&1 | head -10'",
        "sshpass -p '$password' ssh -o StrictHostKeyChecking=no $usuario@$server 'echo """" && echo ""🔍 6. LOGS OPENCODE (últimas 20):""'",
        "sshpass -p '$password' ssh -o StrictHostKeyChecking=no $usuario@$server 'docker logs --tail=20 `$(docker ps | grep -i opencode | awk ""{print `$1}"" | head -1) 2>&1'",
        "sshpass -p '$password' ssh -o StrictHostKeyChecking=no $usuario@$server 'echo ""════════════════════════════════════════"""'"
    )
} | ConvertTo-Json -Depth 10

Write-Host "   📤 Ejecutando comandos en el servidor..." -ForegroundColor Gray
Write-Host ""

try {
    $result = Invoke-RestMethod -Uri "$operatorUrl/api/terminal" -Method POST -Body $task -ContentType "application/json" -TimeoutSec 180
    
    Write-Host "════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "  RESULTADO DEL SERVIDOR" -ForegroundColor Green
    Write-Host "════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host ""
    
    if ($result.output) {
        Write-Host $result.output -ForegroundColor White
    } elseif ($result.result) {
        Write-Host $result.result -ForegroundColor White
    } else {
        Write-Host ($result | ConvertTo-Json -Depth 10) -ForegroundColor Gray
    }
    
} catch {
    Write-Host "   ❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "   Probando método alternativo (comando directo)..." -ForegroundColor Yellow
    
    # Método alternativo: usar plink si está disponible
    if (Get-Command plink -ErrorAction SilentlyContinue) {
        Write-Host "   Usando plink..." -ForegroundColor Gray
        echo y | plink -ssh -batch -pw $password "$usuario@$server" "docker ps && netstat -tlnp | grep :3000 && ufw status"
    } else {
        Write-Host "   ⚠️  Instala plink o ejecuta manualmente:" -ForegroundColor Yellow
        Write-Host "   ssh root@$server" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan

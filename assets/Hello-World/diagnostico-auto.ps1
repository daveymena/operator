# Script automático con contraseña incluida
# ADVERTENCIA: Este script contiene la contraseña en texto plano

$server = "144.91.112.79"
$usuario = "root"
$password = "6715320Dvd."

Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  DIAGNÓSTICO AUTOMÁTICO - EASYPANEL" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Crear script temporal con la contraseña
$tempScript = @"
#!/usr/bin/expect -f
set timeout 20
spawn ssh -o StrictHostKeyChecking=no $usuario@$server "echo '🔍 1. CONTENEDORES:' && docker ps --format 'table {{.Names}}\t{{.Ports}}' && echo '' && echo '🔍 2. PUERTO 3000:' && netstat -tlnp | grep :3000 && echo '' && echo '🔍 3. FIREWALL:' && ufw status && echo '' && echo '🔍 4. PRUEBA LOCAL:' && curl -I http://127.0.0.1:3000 2>&1 | head -10 && echo '' && echo '🔍 5. LOGS OPENCODE:' && docker logs --tail=20 \`$(docker ps | grep -i opencode | awk '{print \`$1}' | head -1)\` 2>&1"
expect "password:"
send "$password\r"
expect eof
"@

$tempFile = "$env:TEMP\ssh_diag.exp"
$tempScript | Out-File -FilePath $tempFile -Encoding ASCII

# Ejecutar con expect (si está instalado)
if (Get-Command wsl -ErrorAction SilentlyContinue) {
    Write-Host "Usando WSL para ejecutar expect..." -ForegroundColor Yellow
    wsl bash -c "expect $tempFile"
} else {
    Write-Host "❌ WSL no está disponible. Usando método alternativo..." -ForegroundColor Red
    Write-Host ""
    Write-Host "COPIA Y PEGA ESTE COMANDO EN TU POWERSHELL:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "ssh root@144.91.112.79" -ForegroundColor Green
    Write-Host ""
    Write-Host "Cuando pida password, ingresa: $password" -ForegroundColor Green
    Write-Host ""
    Write-Host "Luego ejecuta:" -ForegroundColor Yellow
    Write-Host ""
    $comando = "echo '🔍 1. CONTENEDORES:' && docker ps --format 'table {{.Names}}\t{{.Ports}}' && echo '' && echo '🔍 2. PUERTO 3000:' && netstat -tlnp | grep :3000 && echo '' && echo '🔍 3. FIREWALL:' && ufw status && echo '' && echo '🔍 4. PRUEBA LOCAL:' && curl -I http://127.0.0.1:3000 && echo '' && echo '🔍 5. LOGS:' && docker logs --tail=20 `$(docker ps | grep -i opencode | awk '{print `$1}' | head -1)"
    Write-Host $comando -ForegroundColor Green
}

# Limpiar
Remove-Item $tempFile -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan

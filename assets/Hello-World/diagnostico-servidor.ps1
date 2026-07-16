# Script de diagnóstico automático para servidor Contabo
# Ejecutar: .\diagnostico-servidor.ps1

Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  DIAGNÓSTICO EASYPANEL - SERVIDOR CONTABO" -ForegroundColor Cyan
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$server = "144.91.112.79"
$usuario = "root"

Write-Host "🔐 Conectando a $server como $usuario..." -ForegroundColor Yellow
Write-Host "   (Se te pedirá la contraseña)" -ForegroundColor Yellow
Write-Host ""

# Comando de diagnóstico completo
$comando = @"
echo '════════════════════════════════════════' && \
echo '🔍 1. CONTENEDORES DOCKER' && \
echo '════════════════════════════════════════' && \
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' && \
echo '' && \
echo '🔍 2. OPENCODE ESPECÍFICAMENTE' && \
echo '════════════════════════════════════════' && \
docker ps | grep -i opencode && \
echo '' && \
echo '🔍 3. PUERTO 3000 ESCUCHANDO' && \
echo '════════════════════════════════════════' && \
netstat -tlnp | grep :3000 && \
echo '' && \
echo '🔍 4. FIREWALL UFW' && \
echo '════════════════════════════════════════' && \
ufw status && \
echo '' && \
echo '🔍 5. PRUEBA CONEXIÓN LOCAL' && \
echo '════════════════════════════════════════' && \
curl -I http://127.0.0.1:3000 2>&1 | head -10 && \
echo '' && \
echo '🔍 6. LOGS OPENCODE (últimas 20 líneas)' && \
echo '════════════════════════════════════════' && \
docker logs --tail=20 `$(docker ps | grep -i opencode | awk '{print `$1}' | head -1)` 2>&1 && \
echo '' && \
echo '════════════════════════════════════════' && \
echo '  FIN DEL DIAGNÓSTICO' && \
echo '════════════════════════════════════════'
"@

# Ejecutar SSH
ssh "$usuario@$server" $comando

Write-Host ""
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  DIAGNÓSTICO COMPLETADO" -ForegroundColor Green
Write-Host "════════════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "Guarda esta salida y compártela con Kiro" -ForegroundColor Yellow

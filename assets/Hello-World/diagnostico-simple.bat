@echo off
echo ════════════════════════════════════════════════════
echo   DIAGNOSTICO EASYPANEL - EJECUTANDO...
echo ════════════════════════════════════════════════════
echo.

plink -ssh -batch -pw 6715320Dvd. root@144.91.112.79 "echo '1. CONTENEDORES:' && docker ps --format 'table {{.Names}}\t{{.Ports}}' && echo '' && echo '2. PUERTO 3000:' && netstat -tlnp | grep :3000 && echo '' && echo '3. FIREWALL:' && ufw status && echo '' && echo '4. PRUEBA LOCAL:' && curl -I http://127.0.0.1:3000 2>&1 | head -10 && echo '' && echo '5. LOGS OPENCODE:' && docker logs --tail=20 $(docker ps | grep -i opencode | awk '{print $1}' | head -1) 2>&1"

echo.
echo ════════════════════════════════════════════════════
echo   DIAGNOSTICO COMPLETADO
echo ════════════════════════════════════════════════════
pause

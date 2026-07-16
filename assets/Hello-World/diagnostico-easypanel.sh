#!/bin/bash
# Script de diagnóstico para EasyPanel en Contabo

echo "════════════════════════════════════════════════════════"
echo "  DIAGNÓSTICO COMPLETO - EASYPANEL OPENCODE"
echo "════════════════════════════════════════════════════════"
echo ""

echo "🔍 1. CONTENEDORES DOCKER"
echo "─────────────────────────────────────────────────────────"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

echo "🔍 2. CONTENEDORES OPENCODE ESPECÍFICAMENTE"
echo "─────────────────────────────────────────────────────────"
docker ps | grep -i opencode || echo "⚠️  No hay contenedores con 'opencode' en el nombre"
echo ""

echo "🔍 3. PUERTO 3000 ESCUCHANDO"
echo "─────────────────────────────────────────────────────────"
netstat -tlnp | grep :3000 || echo "❌ Puerto 3000 NO está escuchando"
echo ""

echo "🔍 4. FIREWALL UFW"
echo "─────────────────────────────────────────────────────────"
if command -v ufw &> /dev/null; then
    echo "Estado de UFW:"
    ufw status
    echo ""
    echo "Reglas para puerto 3000:"
    ufw status | grep 3000 || echo "⚠️  Puerto 3000 NO permitido en UFW"
else
    echo "⚠️  UFW no instalado"
fi
echo ""

echo "🔍 5. IPTABLES"
echo "─────────────────────────────────────────────────────────"
iptables -L INPUT -n | grep 3000 || echo "⚠️  No hay reglas para 3000 en iptables"
echo ""

echo "🔍 6. PRUEBA LOCAL AL PUERTO 3000"
echo "─────────────────────────────────────────────────────────"
curl -I -m 5 http://127.0.0.1:3000 2>&1 || echo "❌ No se puede conectar a puerto 3000 localmente"
echo ""

echo "🔍 7. LOGS DEL CONTENEDOR OPENCODE (últimas 30 líneas)"
echo "─────────────────────────────────────────────────────────"
OPENCODE_CONTAINER=$(docker ps | grep -i opencode | awk '{print $1}' | head -1)
if [ ! -z "$OPENCODE_CONTAINER" ]; then
    docker logs --tail=30 $OPENCODE_CONTAINER
else
    echo "⚠️  No se encontró contenedor de OpenCode"
fi
echo ""

echo "🔍 8. TRAEFIK/NGINX (Proxy de EasyPanel)"
echo "─────────────────────────────────────────────────────────"
TRAEFIK_CONTAINER=$(docker ps | grep -i traefik | awk '{print $1}' | head -1)
if [ ! -z "$TRAEFIK_CONTAINER" ]; then
    echo "Logs de Traefik (últimas 20 líneas):"
    docker logs --tail=20 $TRAEFIK_CONTAINER
else
    echo "⚠️  No se encontró contenedor de Traefik"
fi
echo ""

echo "🔍 9. TODOS LOS PUERTOS ABIERTOS EN EL SISTEMA"
echo "─────────────────────────────────────────────────────────"
ss -tlnp | grep LISTEN
echo ""

echo "════════════════════════════════════════════════════════"
echo "  FIN DEL DIAGNÓSTICO"
echo "════════════════════════════════════════════════════════"

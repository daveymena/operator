#!/bin/bash
# Script de diagnóstico para problemas de Bad Gateway

echo "═══════════════════════════════════════════════"
echo "  🔍 DIAGNÓSTICO DE OPENCODE"
echo "═══════════════════════════════════════════════"
echo ""

# 1. Verificar que opencode existe
echo "1️⃣ Verificando instalación de opencode..."
if command -v opencode &>/dev/null; then
  echo "   ✅ opencode encontrado: $(which opencode)"
  echo "   Versión: $(opencode --version 2>&1 | head -1)"
else
  echo "   ❌ opencode NO encontrado"
  echo "   Buscando en el sistema..."
  find /usr -name "opencode" 2>/dev/null | head -5
fi
echo ""

# 2. Verificar paquetes npm globales
echo "2️⃣ Verificando paquetes npm globales..."
npm list -g --depth=0 2>/dev/null | grep -E "(opencode|mimo|pm2)" || echo "   ⚠️  Ninguno encontrado"
echo ""

# 3. Verificar procesos corriendo
echo "3️⃣ Verificando procesos..."
ps aux | grep -E "(opencode|node.*proxy|node.*api-server)" | grep -v grep || echo "   ⚠️  No hay procesos relacionados corriendo"
echo ""

# 4. Verificar puertos
echo "4️⃣ Verificando puertos..."
for port in 3000 3001 4000; do
  if nc -z localhost $port 2>/dev/null; then
    echo "   ✅ Puerto $port: ABIERTO"
  else
    echo "   ❌ Puerto $port: CERRADO"
  fi
done
echo ""

# 5. Test de conectividad
echo "5️⃣ Test de conectividad..."
for port in 3000 3001; do
  echo -n "   Puerto $port: "
  if curl -s --connect-timeout 2 http://localhost:$port/ >/dev/null 2>&1; then
    echo "✅ RESPONDE"
  else
    echo "❌ NO RESPONDE"
  fi
done
echo ""

# 6. Ver logs recientes
echo "6️⃣ Logs recientes de OpenCode..."
if [ -f /tmp/opencode.log ]; then
  echo "   Últimas 10 líneas:"
  tail -10 /tmp/opencode.log | sed 's/^/   /'
else
  echo "   ⚠️  Log no encontrado en /tmp/opencode.log"
fi
echo ""

# 7. Variables de entorno relevantes
echo "7️⃣ Variables de entorno..."
echo "   PORT: ${PORT:-no configurado}"
echo "   OPENCODE_WORKSPACE: ${OPENCODE_WORKSPACE:-no configurado}"
echo "   OPENCODE_INTERNAL_PORT: ${OPENCODE_INTERNAL_PORT:-no configurado}"
echo "   NODE_ENV: ${NODE_ENV:-no configurado}"
echo ""

echo "═══════════════════════════════════════════════"
echo "  FIN DEL DIAGNÓSTICO"
echo "═══════════════════════════════════════════════"

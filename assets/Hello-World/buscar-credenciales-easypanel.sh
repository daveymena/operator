#!/bin/bash
# Script para buscar credenciales de EasyPanel en el servidor

echo "════════════════════════════════════════════════════════"
echo "  BUSCANDO CREDENCIALES DE EASYPANEL"
echo "════════════════════════════════════════════════════════"
echo ""

echo "🔍 Buscando archivos con 'davey' o 'duvier'..."
echo ""

# Buscar en home del usuario root
echo "📁 1. Buscando en /root..."
find /root -type f -name "*davey*" -o -name "*duvier*" 2>/dev/null | head -20
echo ""

# Buscar en directorio de EasyPanel
echo "📁 2. Buscando en directorios de EasyPanel..."
find /var/lib/docker/volumes -type f -name "*davey*" -o -name "*duvier*" 2>/dev/null | head -20
find /etc/easypanel -type f 2>/dev/null
echo ""

# Buscar contenido de archivos con estas palabras
echo "📄 3. Buscando contenido en archivos de configuración..."
echo ""

# Buscar en archivos de EasyPanel
if [ -d "/etc/easypanel" ]; then
    echo "   → Buscando en /etc/easypanel..."
    grep -r -i "davey\|duvier\|password\|passwd" /etc/easypanel 2>/dev/null
fi
echo ""

# Buscar en variables de entorno de contenedores de EasyPanel
echo "📦 4. Verificando variables de entorno de contenedores EasyPanel..."
for container in $(docker ps -a | grep easypanel | awk '{print $1}'); do
    CONTAINER_NAME=$(docker inspect --format='{{.Name}}' $container | sed 's/\///')
    echo "   Container: $CONTAINER_NAME"
    docker inspect $container | grep -i -A5 "Env" | grep -i "user\|password\|davey\|duvier" 2>/dev/null
    echo ""
done

# Buscar en volúmenes de Docker
echo "💾 5. Buscando en volúmenes de Docker..."
EASYPANEL_VOLUMES=$(docker volume ls | grep easypanel | awk '{print $2}')
for vol in $EASYPANEL_VOLUMES; do
    echo "   Volumen: $vol"
    VOL_PATH=$(docker volume inspect $vol | grep Mountpoint | cut -d'"' -f4)
    if [ -d "$VOL_PATH" ]; then
        find "$VOL_PATH" -type f -name "*.json" -o -name "*.yml" -o -name "*.yaml" -o -name "*.env" 2>/dev/null | head -10
        echo ""
    fi
done

# Buscar archivos .env
echo "📝 6. Buscando archivos .env..."
find /root -name ".env" -type f 2>/dev/null -exec echo "   Archivo: {}" \; -exec cat {} \; 2>/dev/null
echo ""

# Buscar en configuración de Docker Compose de EasyPanel
echo "🐳 7. Buscando docker-compose.yml de EasyPanel..."
find /var/lib/docker -name "docker-compose.yml" -type f 2>/dev/null | xargs grep -l "easypanel" 2>/dev/null | head -5
echo ""

# Buscar credenciales en base de datos de EasyPanel
echo "🗄️  8. Intentando acceder a la base de datos de EasyPanel..."
EASYPANEL_DB=$(docker ps | grep -E "easypanel.*postgres|easypanel.*mysql" | awk '{print $1}')
if [ ! -z "$EASYPANEL_DB" ]; then
    echo "   Base de datos encontrada: $EASYPANEL_DB"
    # Intentar listar tablas (si es PostgreSQL)
    docker exec $EASYPANEL_DB psql -U easypanel -c "\dt" 2>/dev/null || echo "   No se pudo conectar a PostgreSQL"
    docker exec $EASYPANEL_DB psql -U easypanel -c "SELECT email FROM users LIMIT 5;" 2>/dev/null || echo "   No se pudo consultar usuarios"
else
    echo "   No se encontró contenedor de base de datos"
fi
echo ""

# Buscar en logs de EasyPanel
echo "📋 9. Buscando en logs de contenedores..."
for container in $(docker ps -a | grep easypanel | awk '{print $1}'); do
    CONTAINER_NAME=$(docker inspect --format='{{.Name}}' $container | sed 's/\///')
    echo "   Logs de $CONTAINER_NAME (buscando credenciales):"
    docker logs $container 2>&1 | grep -i "user\|email\|password\|davey\|duvier" | head -10
    echo ""
done

# Buscar archivos de configuración de EasyPanel
echo "⚙️  10. Archivos de configuración de EasyPanel..."
ls -la /var/lib/easypanel 2>/dev/null || echo "   /var/lib/easypanel no existe"
ls -la /opt/easypanel 2>/dev/null || echo "   /opt/easypanel no existe"
ls -la ~/.easypanel 2>/dev/null || echo "   ~/.easypanel no existe"
echo ""

# Verificar si hay archivo de instalación inicial
echo "📦 11. Buscando script de instalación..."
if [ -f "/root/easypanel-install.sh" ]; then
    echo "   Encontrado: /root/easypanel-install.sh"
    grep -i "password\|user\|davey\|duvier" /root/easypanel-install.sh
fi
echo ""

# Intentar obtener credenciales desde la API de EasyPanel
echo "🌐 12. Intentando acceder a API local de EasyPanel..."
ADMIN_TOKEN=$(find /var/lib/docker/volumes -name "*token*" 2>/dev/null -exec cat {} \; 2>/dev/null | head -1)
if [ ! -z "$ADMIN_TOKEN" ]; then
    echo "   Token encontrado, intentando API..."
    curl -s -H "Authorization: Bearer $ADMIN_TOKEN" http://localhost:3000/api/users 2>/dev/null | head -20
fi
echo ""

echo "════════════════════════════════════════════════════════"
echo "  BÚSQUEDA COMPLETADA"
echo "════════════════════════════════════════════════════════"
echo ""
echo "💡 TIPS:"
echo "   - Revisa los archivos .env encontrados"
echo "   - Busca en las variables de entorno de contenedores"
echo "   - Consulta los logs para ver credenciales de instalación"
echo ""
echo "🔐 ALTERNATIVA: Resetear contraseña de EasyPanel"
echo "   docker exec -it \$(docker ps | grep easypanel-api | awk '{print \$1}') easypanel user:password <email> <nueva-contraseña>"
echo ""

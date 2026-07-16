#!/bin/bash
# Script para diagnosticar y reparar EasyPanel en servidor Contabo
# Ejecutar en el servidor: bash reparar-easypanel.sh

echo "════════════════════════════════════════════════════════"
echo "  DIAGNÓSTICO Y REPARACIÓN DE EASYPANEL"
echo "════════════════════════════════════════════════════════"
echo ""

# ═══════════════════════════════════════════════════════════
# FASE 1: DIAGNÓSTICO
# ═══════════════════════════════════════════════════════════

echo "🔍 FASE 1: DIAGNÓSTICO"
echo "─────────────────────────────────────────────────────────"
echo ""

echo "1️⃣ Verificando contenedores de EasyPanel..."
EASYPANEL_CONTAINERS=$(docker ps -a | grep easypanel)
if [ -z "$EASYPANEL_CONTAINERS" ]; then
    echo "❌ No hay contenedores de EasyPanel"
    EASYPANEL_INSTALADO=false
else
    echo "✅ Contenedores de EasyPanel encontrados:"
    docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep easypanel
    EASYPANEL_INSTALADO=true
fi
echo ""

echo "2️⃣ Verificando estado de contenedores..."
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "easypanel|traefik"
echo ""

echo "3️⃣ Verificando puertos de EasyPanel..."
netstat -tlnp | grep -E ":3000|:80|:443" | head -10
echo ""

echo "4️⃣ Verificando permisos de Docker..."
ls -la /var/run/docker.sock
echo ""

echo "5️⃣ Verificando logs de Traefik (proxy)..."
TRAEFIK_ID=$(docker ps | grep traefik | awk '{print $1}' | head -1)
if [ ! -z "$TRAEFIK_ID" ]; then
    echo "Últimas 20 líneas de logs:"
    docker logs --tail=20 $TRAEFIK_ID 2>&1
else
    echo "⚠️  Traefik no está corriendo"
fi
echo ""

echo "6️⃣ Verificando configuración de red de Docker..."
docker network ls | grep easypanel
echo ""

# ═══════════════════════════════════════════════════════════
# FASE 2: DECISIÓN
# ═══════════════════════════════════════════════════════════

echo ""
echo "════════════════════════════════════════════════════════"
echo "  OPCIONES DE REPARACIÓN"
echo "════════════════════════════════════════════════════════"
echo ""
echo "1. Reiniciar contenedores de EasyPanel"
echo "2. Reparar permisos de Docker"
echo "3. Reinstalar EasyPanel completamente (DESTRUCTIVO)"
echo "4. Solo abrir puertos del firewall"
echo "5. Ver logs detallados"
echo "6. Salir"
echo ""
read -p "Selecciona una opción (1-6): " OPCION

case $OPCION in
    1)
        echo ""
        echo "♻️  Reiniciando contenedores de EasyPanel..."
        docker restart $(docker ps -a | grep easypanel | awk '{print $1}')
        docker restart $(docker ps -a | grep traefik | awk '{print $1}')
        echo "✅ Contenedores reiniciados"
        echo ""
        echo "Verificando estado..."
        sleep 5
        docker ps | grep -E "easypanel|traefik"
        ;;
        
    2)
        echo ""
        echo "🔧 Reparando permisos de Docker..."
        
        # Agregar usuario actual al grupo docker
        usermod -aG docker $USER
        
        # Ajustar permisos del socket
        chmod 666 /var/run/docker.sock
        
        # Reiniciar Docker
        systemctl restart docker
        
        echo "✅ Permisos reparados"
        echo ""
        echo "⚠️  Puede que necesites cerrar sesión y volver a entrar para que los cambios surtan efecto"
        ;;
        
    3)
        echo ""
        echo "⚠️  ADVERTENCIA: Esto eliminará TODA la configuración de EasyPanel"
        echo "⚠️  Se perderán todos los proyectos y configuraciones"
        echo ""
        read -p "¿Estás SEGURO? Escribe 'SI' para continuar: " CONFIRMAR
        
        if [ "$CONFIRMAR" == "SI" ]; then
            echo ""
            echo "🗑️  Eliminando EasyPanel..."
            
            # Detener todos los contenedores de EasyPanel
            docker stop $(docker ps -a | grep easypanel | awk '{print $1}') 2>/dev/null
            
            # Eliminar contenedores
            docker rm $(docker ps -a | grep easypanel | awk '{print $1}') 2>/dev/null
            
            # Eliminar volúmenes
            docker volume rm $(docker volume ls | grep easypanel | awk '{print $2}') 2>/dev/null
            
            # Eliminar redes
            docker network rm $(docker network ls | grep easypanel | awk '{print $1}') 2>/dev/null
            
            echo "✅ EasyPanel eliminado"
            echo ""
            echo "📥 Reinstalando EasyPanel..."
            echo ""
            
            # Instalar EasyPanel desde cero
            curl -sSL https://get.easypanel.io | sh
            
            echo ""
            echo "✅ EasyPanel reinstalado"
            echo ""
            echo "🔐 Accede a EasyPanel en: http://$(curl -s ifconfig.me):3000"
            echo ""
            
        else
            echo "❌ Reinstalación cancelada"
        fi
        ;;
        
    4)
        echo ""
        echo "🔥 Abriendo puertos en el firewall..."
        
        # Abrir puerto 3000 (EasyPanel UI)
        ufw allow 3000/tcp
        
        # Abrir puerto 80 (HTTP)
        ufw allow 80/tcp
        
        # Abrir puerto 443 (HTTPS)
        ufw allow 443/tcp
        
        # Recargar firewall
        ufw reload
        
        echo "✅ Puertos abiertos"
        echo ""
        ufw status | grep -E "3000|80|443"
        ;;
        
    5)
        echo ""
        echo "📄 Logs detallados de EasyPanel..."
        echo ""
        
        # Logs de todos los contenedores de EasyPanel
        for container in $(docker ps -a | grep easypanel | awk '{print $1}'); do
            CONTAINER_NAME=$(docker inspect --format='{{.Name}}' $container | sed 's/\///')
            echo "─────────────────────────────────────────────────"
            echo "📦 Contenedor: $CONTAINER_NAME"
            echo "─────────────────────────────────────────────────"
            docker logs --tail=30 $container 2>&1
            echo ""
        done
        
        # Logs de Traefik
        TRAEFIK_ID=$(docker ps -a | grep traefik | awk '{print $1}' | head -1)
        if [ ! -z "$TRAEFIK_ID" ]; then
            echo "─────────────────────────────────────────────────"
            echo "📦 Traefik (Proxy Inverso)"
            echo "─────────────────────────────────────────────────"
            docker logs --tail=50 $TRAEFIK_ID 2>&1
        fi
        ;;
        
    6)
        echo "👋 Saliendo..."
        exit 0
        ;;
        
    *)
        echo "❌ Opción inválida"
        exit 1
        ;;
esac

echo ""
echo "════════════════════════════════════════════════════════"
echo "  PROCESO COMPLETADO"
echo "════════════════════════════════════════════════════════"
echo ""
echo "📊 Estado actual de contenedores:"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "NAME|easypanel|traefik"
echo ""

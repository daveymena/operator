# 🔧 INSTRUCCIONES PARA REPARAR EASYPANEL EN SERVIDOR CONTABO

## PASO 1: Conectarse al Servidor

Abre PowerShell y ejecuta:

```powershell
ssh root@144.91.112.79
```

Contraseña: `6715320Dvd.`

---

## PASO 2: Descargar el Script de Reparación

Una vez conectado al servidor, ejecuta:

```bash
curl -o reparar-easypanel.sh https://raw.githubusercontent.com/daveymena/open2/main/reparar-easypanel.sh

# O copia el script manualmente
```

**O COPIA Y PEGA DIRECTAMENTE ESTE COMANDO:**

```bash
cat > reparar-easypanel.sh << 'EOF'
# [Aquí pegarías todo el contenido del script]
EOF

chmod +x reparar-easypanel.sh
```

---

## PASO 3: Ejecutar el Script

```bash
bash reparar-easypanel.sh
```

El script te mostrará:
1. ✅ Estado actual de EasyPanel
2. 📊 Diagnóstico completo
3. 🛠️ Opciones de reparación

---

## OPCIONES DEL MENÚ:

### Opción 1: Reiniciar Contenedores (RECOMENDADO - PROBAR PRIMERO)
- Reinicia todos los servicios de EasyPanel
- No pierde configuración
- Soluciona problemas temporales

### Opción 2: Reparar Permisos
- Arregla permisos de Docker
- Soluciona errores de "permission denied"

### Opción 3: Reinstalar EasyPanel (⚠️ DESTRUCTIVO)
- **ELIMINA TODO**: proyectos, configuraciones, volúmenes
- Solo usar si nada más funciona
- Deberás reconfigurar desde cero

### Opción 4: Abrir Puertos del Firewall
- Abre puertos 3000, 80, 443
- Soluciona bloqueos de firewall

### Opción 5: Ver Logs Detallados
- Muestra logs de todos los contenedores
- Útil para diagnosticar problemas específicos

---

## PASO 4: Verificar que Funcione

Después de ejecutar la reparación, prueba:

```bash
# Ver estado de contenedores
docker ps

# Probar conexión local
curl -I http://127.0.0.1:3000

# Ver logs de tu app OpenCode
docker logs $(docker ps | grep opencode | awk '{print $1}' | head -1)
```

---

## PASO 5: Acceder a EasyPanel

Abre tu navegador en:

```
http://144.91.112.79:3000
```

O tu dominio:
```
https://tecnoia-app-opencode.2xs2bu.easypanel.host
```

---

## 🚨 SI TODO FALLA - REINSTALACIÓN LIMPIA:

```bash
# 1. Eliminar EasyPanel completamente
docker stop $(docker ps -a | grep easypanel | awk '{print $1}')
docker rm $(docker ps -a | grep easypanel | awk '{print $1}')
docker volume prune -f
docker network prune -f

# 2. Reinstalar EasyPanel
curl -sSL https://get.easypanel.io | sh

# 3. Abrir puertos
ufw allow 3000/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw reload

# 4. Acceder a EasyPanel
# http://[IP-SERVIDOR]:3000
```

---

## 📝 NOTAS IMPORTANTES:

- **NO uses la Opción 3** a menos que hayas respaldado todo
- Primero prueba Opción 1 (Reiniciar)
- Luego Opción 4 (Abrir puertos)
- La Opción 3 (Reinstalar) es el ÚLTIMO recurso

---

## 🆘 SI NECESITAS AYUDA:

Comparte conmigo:
1. La salida del diagnóstico (FASE 1)
2. Los logs que muestre la Opción 5
3. El error específico que veas


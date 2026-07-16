# 🎯 SOLUCIÓN DEFINITIVA: Error 502 Bad Gateway

## 🔍 Problema Identificado

Tus logs muestran que la aplicación corre en el **puerto 21293**:
```
✅ OpenCode Evolved shell corriendo en http://0.0.0.0:21293
```

Pero EasyPanel está configurado para el **puerto 3000** (en `easypanel.yml`).

### ¿Por qué pasó esto?

El archivo `.env` local tiene `PORT=21293`, y cuando se copia al contenedor, **sobreescribe** la variable `PORT=3000` que EasyPanel configura.

```
EasyPanel configura: PORT=3000
↓
start.sh carga .env
↓
.env sobreescribe con: PORT=21293
↓
App corre en 21293, pero dominio apunta a 3000
↓
❌ 502 Bad Gateway
```

## ✅ Solución Aplicada

He hecho 2 cambios para resolver esto:

### 1. Actualizado `.env`
Removí `PORT` del `.env` para que no sobreescriba la configuración de EasyPanel.

```bash
# Antes (causaba conflicto):
PORT=21293

# Ahora (deja que EasyPanel controle):
# PORT se configura en easypanel.yml
```

### 2. Actualizado `docker/start.sh`
Ahora el script **preserva** las variables de EasyPanel aunque cargue `.env`:

```bash
# Guarda PORT de EasyPanel antes de cargar .env
EASYPANEL_PORT="${PORT:-}"

# Carga .env
source "$WORKSPACE/.env"

# Restaura PORT de EasyPanel (tiene prioridad)
export PORT="$EASYPANEL_PORT"
```

## 🚀 Pasos para Aplicar la Solución

```bash
# 1. Commit de los cambios
git add .env docker/start.sh
git commit -m "fix: Respetar PORT de EasyPanel y evitar 502 Bad Gateway"
git push origin main

# 2. En EasyPanel:
#    - Ve a tu servicio
#    - Click en "Rebuild"
#    - Espera 2-3 minutos

# 3. Verifica los logs (deberías ver):
#    ✅ Using PORT from EasyPanel: 3000
#    ✅ OpenCode Evolved shell corriendo en http://0.0.0.0:3000
#    ✅ opencode server listening on http://0.0.0.0:3001

# 4. Accede a tu URL:
#    https://opencode.tudominio.com
#    ✅ Debe mostrar la interfaz (sin 502)
```

## 🎯 Resultado Esperado

Después del rebuild:

### En los logs verás:
```
✅ Using PORT from EasyPanel: 3000
✅ Using OPERATOR_PORT from EasyPanel: 3002
✅ Starting OpenCode engine on port 3001...
✅ OpenCode ready (4s)
✅ OpenCode Evolved shell corriendo en http://0.0.0.0:3000
```

### En tu navegador:
1. Ve a `https://opencode.tudominio.com`
2. Deberías ver:
   - 🔐 Pantalla de login (usuario: `opencode`, password: `6715320Dvd.`)
   - O directamente la interfaz de OpenCode

## 📊 Configuración Final de Puertos

| Servicio | Puerto Interno | Puerto Externo (Dominio) |
|----------|---------------|--------------------------|
| Proxy OpenCode | 3000 | 3000 |
| OpenCode | 3001 | N/A (interno) |
| Web Operator | 3002 | N/A (opcional) |
| MiMo Code | 3003 | 3003 |

## 🔧 Verificación

Para confirmar que funciona:

### 1. En los logs de EasyPanel busca:
```
✅ "Using PORT from EasyPanel: 3000"
✅ "OpenCode Evolved shell corriendo en http://0.0.0.0:3000"
```

### 2. En tu navegador (DevTools F12 → Network):
```
✅ Status 200 o 302 (redirect a login)
❌ NO debe aparecer 502
```

### 3. Si ves la interfaz:
```
✅ Explorador de archivos a la izquierda
✅ Editor de código en el centro
✅ Terminal abajo
```

## ⚠️ Si Sigue Mostrando 502

Si después del rebuild sigue el error 502:

1. **Verifica el dominio en EasyPanel:**
   - Ve a: Servicios → opencode → Domains
   - Confirma que dice: `port: 3000`

2. **Copia los logs completos** y envíalos

3. **Prueba acceder directamente:**
   - Encuentra la IP de tu servicio en EasyPanel
   - Intenta: `http://tu-ip:3000`
   - Si funciona por IP pero no por dominio → problema de DNS/proxy

## 📝 Resumen

**Causa:** `.env` local sobreescribía PORT de EasyPanel  
**Solución:** Dar prioridad a variables de EasyPanel  
**Archivos cambiados:** `.env`, `docker/start.sh`  
**Tiempo:** 2-3 minutos de rebuild  
**Resultado:** ✅ Interfaz de OpenCode funcionando

---

## ⚡ Comando Rápido

```bash
git add .env docker/start.sh
git commit -m "fix: Respetar PORT de EasyPanel y evitar 502"
git push origin main
# Luego: EasyPanel → Rebuild
```

# 🔧 Solución: Bad Gateway en EasyPanel

## ✅ Diagnóstico de tus logs

Según los logs que compartiste, **todo está funcionando correctamente**:

```
✅ OpenCode ready (4s)
✅ opencode server listening on http://0.0.0.0:21294
✅ Web Operator ready
✅ OpenCode Evolved shell corriendo en http://0.0.0.0:21293
```

## ❌ El problema

El "Bad Gateway" aparece porque **el dominio en EasyPanel está configurado con el puerto incorrecto**.

### Lo que está pasando:
- Tu aplicación corre en el puerto **21293**
- El dominio en EasyPanel probablemente apunta al puerto **3000**
- Por eso el proxy de EasyPanel no encuentra tu aplicación → Bad Gateway

## ✅ Solución (2 opciones)

### Opción 1: Cambiar puerto del dominio en EasyPanel (rápido)

1. Ve a EasyPanel → Tu servicio → **Domains**
2. Edita el dominio `opencode.$(PRIMARY_DOMAIN)`
3. Cambia el puerto de **3000** a **21293**
4. Guarda y espera 30 segundos
5. Refresca tu navegador

### Opción 2: Usar puertos estándar (recomendado) ✨

He actualizado los archivos para usar puertos estándar:

**Cambios realizados:**
- `.env`: PORT=3000 (en vez de 21293)
- `easypanel.yml`: Dominios apuntan a 3000 y 3003

**Pasos:**
```bash
# 1. Commit de los cambios
git add .env easypanel.yml
git commit -m "fix: Usar puertos estándar 3000 y 3003 para EasyPanel"
git push origin main

# 2. En EasyPanel → Rebuild (tardará 2 min)

# 3. Después del rebuild, los puertos coincidirán:
#    - App corre en puerto 3000
#    - Dominio apunta a puerto 3000
#    - ✅ Funciona!
```

## 🌐 Configuración correcta de dominios

Después de aplicar la Opción 2, deberías tener:

| Dominio | Puerto | Servicio |
|---------|--------|----------|
| `opencode.tudominio.com` | 3000 | OpenCode (proxy) |
| `mimo.tudominio.com` | 3003 | MiMo Code |

## 🎯 Resultado esperado

Después de cualquiera de las dos opciones:

1. Ve a `https://opencode.tudominio.com`
2. Deberías ver:
   - 🔐 Pantalla de login (usuario: `opencode`, password: `6715320Dvd.`)
   - O directamente la interfaz de OpenCode si no hay autenticación

## 📊 Verificación

Para confirmar que funciona:

```bash
# En tu navegador, abre DevTools (F12) → Network
# Refresca la página
# Deberías ver:
✅ Status 200 (o 302 redirect a login)
❌ NO debe ver 502 Bad Gateway
```

## 🚀 Recomendación

**Usa la Opción 2** (puertos estándar) porque:
- ✅ Es más fácil de mantener
- ✅ Los puertos son predecibles (3000, 3001, 3002, 3003)
- ✅ Coincide con la convención de la mayoría de servicios
- ✅ Ya actualicé los archivos por ti

---

## ⚡ Resumen Ejecutivo

**Problema:** Dominio apunta al puerto equivocado  
**Solución:** Hacer commit y rebuild (2 minutos)  
**Resultado:** Interfaz de OpenCode visible

```bash
git add .env easypanel.yml
git commit -m "fix: Usar puertos estándar para EasyPanel"
git push origin main
# En EasyPanel → Rebuild
```

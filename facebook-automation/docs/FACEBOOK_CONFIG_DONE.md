# ✅ CONFIGURACIÓN DE FACEBOOK - PENDIENTE TOKEN

## Información obtenida:
- **Business Manager ID:** 4482432028697067
- **Page ID:** 1278583508663384 
- **Page Name:** VentasPro - Cursos Digitales
- **Sesión Facebook:** Activa ✅
- **System Users:** No hay (necesitas crear uno)

## Para generar el access token:

### Opción 1 (Recomendada) - System User:
1. Ve a https://business.facebook.com/latest/settings/system_users?business_id=4482432028697067
2. Click "Añadir" (Add) 
3. Crea un usuario del sistema con nombre "SalesBot"
4. Dale permisos a la página "VentasPro" y a la cuenta publicitaria
5. Click "Generar token" con estos permisos:
   - `pages_read_engagement`
   - `pages_manage_metadata`  
   - `business_management`
   - `ads_management`
   - `pages_messaging`
6. COPIA el token y pásamelo

### Opción 2 - Graph API Explorer:
1. Ve a https://developers.facebook.com/tools/explorer/
2. Inicia sesión si te pide
3. Selecciona la app (o crea una)
4. En "User or Page": selecciona "Página" 
5. Selecciona "VentasPro - Cursos Digitales"
6. Permisos: pages_read_engagement, pages_manage_metadata, business_management, ads_management, pages_messaging
7. Click "Generar access token" 
8. COPIA el token y pásamelo

### Opción 3 - Token de página desde Meta Business Suite:
1. Ve a https://business.facebook.com/latest/settings/pages?business_id=4482432028697067
2. Click en "VentasPro"
3. En los ajustes de la página busca "Access Token" o "Token de acceso"
4. Copia el token

---

## Una vez tenga el token:
Ejecuto: `node C:\Users\ADMIN\Music\configurar-facebook-completo.mjs`
Y automáticamente configuro:
- ✅ FB_ACCESS_TOKEN
- ✅ Anuncios en borrador con estrategias ganadoras
- ✅ Marketplace listings
- ✅ Messenger Bot
- ✅ Comments auto-reply
- ✅ Channel Manager

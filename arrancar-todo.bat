@echo off
title OPERATOR - TODO EN UNO
cd /d "%~dp0"

mode con cols=100 lines=40
color 0A

echo.
echo   ╔═══════════════════════════════════════════════════════╗
echo   ║     🚀 OPERATOR - SISTEMA TODO EN UNO                ║
echo   ║     Bridge + NVIDIA + Facebook + Automatización      ║
echo   ╚═══════════════════════════════════════════════════════╝
echo.

:: Verificar que node existe
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [!] Node.js no encontrado. Instalalo desde https://nodejs.org
    pause
    exit /b 1
)

:: Verificar dependencias
if not exist "%~dp0node_modules" (
    echo [*] Instalando dependencias...
    cd /d "%~dp0"
    npm install axios ws 2>&1 | findstr /v "added"
    echo.
)

:: Matar procesos previos
echo [1/4] Limpiando procesos anteriores...
taskkill /f /im node.exe /fi "WINDOWTITLE eq BRIDGE*" >nul 2>&1
timeout /t 1 /nobreak >nul

:: Iniciar bridge
echo [2/4] Iniciando Bridge WebSocket (puerto 20100)...
start "BRIDGE" /B "" node "%~dp0bridge\bridge.mjs" > "%TEMP%\bridge-operator.log" 2>&1
if %errorlevel% neq 0 (
    echo [!] Error iniciando bridge
) else (
    echo   [OK] Bridge en ws://localhost:20100
)
timeout /t 2 /nobreak >nul

:: Mostrar estado del sistema
echo [3/4] Verificando sistema...
echo.
echo   ┌──────────────────────────────────────────────────────┐
echo   │  🧠 NVIDIA NIM - 118 modelos disponibles            │
echo   │  🌉 Bridge       - ws://localhost:20100             │
echo   │  📦 Catálogo     - 102 productos tecnológicos       │
echo   │  📄 Página       - VentasPro - Cursos Digitales    │
echo   │  💰 Ad Account   - 1545022093928422                 │
echo   └──────────────────────────────────────────────────────┘
echo.

:: Menú
echo [4/4] Listo. Selecciona modo:
echo.
echo   [1] Modo OPERATOR  - IA autónoma (NVIDIA)
echo   [2] Modo FACEBOOK  - Crear campañas en Ads Manager
echo   [3] Modo ESTADO    - Ver estado del sistema
echo   [4] Modo PUENTE    - Solo bridge (para desarrollo)
echo   [5] Salir
echo.

:menu
set /p opcion="   Opcion: "

if "%opcion%"=="1" goto operator
if "%opcion%"=="2" goto facebook
if "%opcion%"=="3" goto estado
if "%opcion%"=="4" goto bridge_only
if "%opcion%"=="5" goto end
echo Opcion invalida
goto menu

:operator
echo.
echo   Iniciando OPERATOR con NVIDIA...
echo   Escribe tu tarea (ej: "crea campañas en facebook"):
echo.
set /p tarea="   > "
if "%tarea%"=="" set tarea=analiza el sistema y dime que ves
node "%~dp0operator.mjs" "%tarea%"
echo.
pause
goto end

:facebook
echo.
echo   Creando campañas en Facebook Ads desde el catálogo...
node "%~dp0facebook-automation\scripts\ads\crear-campanias-catalogo.mjs"
echo.
pause
goto end

:estado
echo.
node -e "import('./operator/brain.mjs').then(m=>console.log('✅ Sistema listo')).catch(e=>console.log('❌',e.message))"
tasklist /fi "WINDOWTITLE eq BRIDGE*" 2>nul | findstr /i "node" >nul && echo Bridge: Activo || echo Bridge: Inactivo
echo.
echo   Documentacion:
echo     - docs/PROJECT_OVERVIEW.md
echo     - docs/ARCHITECTURE.md
echo     - docs/CHANGELOG.md
echo     - facebook-automation/docs/FACEBOOK_CONFIG_DONE.md
echo.
pause
goto menu

:bridge_only
echo.
echo   Bridge corriendo en ws://localhost:20100
echo   Deja esta ventana abierta y ejecuta en otra terminal:
echo     node operator.mjs "tu tarea"
echo.
echo   Presiona cualquier tecla para volver al menu...
pause >nul
goto menu

:end
echo.
echo Cerrando bridge...
taskkill /f /im node.exe /fi "WINDOWTITLE eq BRIDGE*" >nul 2>&1
echo Listo.
exit /b 0

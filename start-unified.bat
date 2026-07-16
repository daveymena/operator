@echo off
title UNIFIED - HERMES ^& OPENCODE
cd /d "%~dp0"

mode con cols=100 lines=40
color 0B

echo. 
echo   ╔═══════════════════════════════════════════════════════╗
echo   ║     HERMES + OPENCODE - SISTEMA UNIFICADO            ║
echo   ║        Modo Ultra Poderoso - Control Total           ║
echo   ╚═══════════════════════════════════════════════════════╝
echo.
echo   Sistemas acoplados:
echo     [HERMES]  >>> IA Avanzada, Modelos, Plugins, Gateway
echo     [OPENCODE] >>> Control de PC, Screenshots, Mouse, Teclado
echo.
echo   Comandos disponibles:
echo     hermes     - Inicia Hermes con superpoderes OpenCode
echo     opencode   - Inicia OpenCode con IA Hermes
echo     dashboard  - Abre el panel web unificado
echo.
echo ============================================================
echo.

:menu
echo.
echo   Selecciona modo:
echo   [1] Modo HERMES (controla OpenCode)
echo   [2] Modo OPENCODE (controla Hermes)
echo   [3] Abrir Dashboard Web
echo   [4] Salir
echo.

set /p mode="   Opcion: "

if "%mode%"=="1" goto hermes_mode
if "%mode%"=="2" goto opencode_mode
if "%mode%"=="3" goto dashboard
if "%mode%"=="4" goto end

echo Opcion invalida
goto menu

:hermes_mode
echo.
echo Iniciando HERMES + OPENCODE...
call hermes.bat
goto end

:opencode_mode
echo.
echo Iniciando OPENCODE + HERMES...
call opencode.bat
goto end

:dashboard
echo.
echo Abriendo http://localhost:3000...
start http://localhost:3000
timeout /t 2 > nul
goto menu

:end
echo.
echo Saliendo...
taskkill /f /im node.exe > nul 2>&1
exit /b 0

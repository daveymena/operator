@echo off
title HERMES + OPENCODE - MODO ULTRAPODEROSO
cd /d "%~dp0"

mode con cols=100 lines=30
color 0D

echo.
echo   ╔═══════════════════════════════════════════════════════╗
echo   ║     HERMES + OPENCODE — MODO ULTRAPODEROSO          ║
echo   ║         Control Total del PC desde Hermes            ║
echo   ╚═══════════════════════════════════════════════════════╝
echo.

:: Renovar token de Copilot automaticamente
echo [0/3] Renovando token de Copilot...
powershell -ExecutionPolicy Bypass -Command "& '%~dp0scripts\copilot-auto.ps1'" > nul 2>&1
if %errorlevel% equ 0 (
    echo [✓] Token Copilot renovado
) else (
    echo [⚠] No se pudo renovar token Copilot
)

:: Matar bridges previos
taskkill /f /im node.exe /fi "WINDOWTITLE eq HERMES*" > nul 2>&1
taskkill /f /im node.exe /fi "WINDOWTITLE eq BRIDGE*" > nul 2>&1

:: Iniciar puente (bridge) en segundo plano
echo [1/3] Iniciando puente Hermes-OpenCode (WebSocket: 20100)...
start "BRIDGE" /B "" node "%~dp0bridge\bridge.mjs" > "%TEMP%\hermes-bridge.log" 2>&1
if %errorlevel% neq 0 (
    echo [!] Error iniciando bridge
    pause
    exit /b 1
)
timeout /t 3 /nobreak > nul

:: Confirmar bridge activo
echo [2/3] Bridge activo. Inyectando herramientas OpenCode...
echo.

:: Variables de entorno para el plugin
set HERMES_BRIDGE_PORT=20100
set OPENCODE_CONTROL=1

:: Activar venv de Hermes si existe
if exist "%~dp0..\hermes-core\.venv\Scripts\activate.bat" (
    call "%~dp0..\hermes-core\.venv\Scripts\activate.bat"
) else if exist "%~dp0..\hermes-core\venv\Scripts\activate.bat" (
    call "%~dp0..\hermes-core\venv\Scripts\activate.bat"
)

:: Asegurar que el plugin se encuentra
if exist "%USERPROFILE%\.hermes\plugins\opencode-bridge" (
    echo [✓] Plugin OpenCode Bridge encontrado en ~/.hermes/plugins/
) else (
    echo [⚠] Plugin no encontrado, creando...
    mkdir "%USERPROFILE%\.hermes\plugins\opencode-bridge" 2>nul
    xcopy /E /I /Y "%~dp0bridge\*" "%USERPROFILE%\.hermes\plugins\opencode-bridge\" > nul
    echo [✓] Plugin creado
)

echo [3/3] LISTO. Hermes tiene control TOTAL del PC.
echo.
echo   Comandos rapidos: /help para ayuda, /tools para ver herramientas
echo   /opencode_screenshot para capturar pantalla
echo.

:: Ejecutar Hermes CLI
python "%~dp0..\hermes-core\cli.py" %*

:: Al salir, limpiar
echo.
echo Cerrando bridge...
taskkill /f /im node.exe /fi "WINDOWTITLE eq BRIDGE" > nul 2>&1
taskkill /f /im node.exe /fi "WINDOWTITLE eq HERMES*" > nul 2>&1
echo Listo.

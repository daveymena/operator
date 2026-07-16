@echo off
title BRIDGE HERMES + OPENCODE - INDEPENDIENTE
cd /d "%~dp0"

mode con cols=100 lines=25
color 0D

echo.
echo   ===================================================
echo     BRIDGE HERMES + OPENCODE - MODO INDEPENDIENTE
echo     Los puentes funcionan sin depender de Hermes CLI
echo   ===================================================
echo.

:: Matar procesos previos del bridge
echo [1/4] Limpiando procesos previos...
for /f "tokens=2" %%P in ('tasklist /fi "WINDOWTITLE eq BRIDGE*" /nh 2^>nul') do (
    taskkill /PID %%P /F >nul 2>&1
)
for /f "tokens=2" %%P in ('tasklist /fi "WINDOWTITLE eq AGENT-SERVER*" /nh 2^>nul') do (
    taskkill /PID %%P /F >nul 2>&1
)
echo    [OK]

:: Iniciar Agent Server (WebSocket para pc-agent)
echo [2/4] Iniciando Agent Server (puerto 21291)...
start "AGENT-SERVER" /B node "%~dp0..\opencode-core\agent-server.mjs" > "%TEMP%\agent-server.log" 2>&1
if errorlevel 1 (
    echo    [!] Error iniciando Agent Server
) else (
    echo    [OK] Agent Server en ws://localhost:21291/agent
)
timeout /t 2 /nobreak > nul

:: Iniciar pc-agent
echo [3/4] Iniciando PC Agent...
start "PC-AGENT" /B node "%~dp0..\opencode-core\pc-agent.mjs" > "%TEMP%\pc-agent.log" 2>&1
if errorlevel 1 (
    echo    [!] Error iniciando PC Agent
) else (
    echo    [OK] PC Agent conectado a Agent Server
)
timeout /t 2 /nobreak > nul

:: Iniciar el puente Hermes-OpenCode
echo [4/4] Iniciando Bridge Hermes-OpenCode (puerto 20100)...
set HERMES_BRIDGE_PORT=20100
set OPENCODE_CONTROL=1
start "BRIDGE" /B node "%~dp0bridge\bridge.mjs" > "%TEMP%\hermes-bridge.log" 2>&1
if errorlevel 1 (
    echo    [!] Error iniciando Bridge
) else (
    echo    [OK] Bridge en ws://localhost:20100
)

echo.
echo   ===================================================
echo   SISTEMA DE PUENTES ACTIVO
echo   ------------------------------------------------
echo   Agent Server: ws://localhost:21291/agent
echo   PC Agent:    Conectado
echo   Bridge:      ws://localhost:20100
echo   OpenCode WS: ws://localhost:20102
echo   ------------------------------------------------
echo   Ahora puedes ejecutar Hermes CLI en otra ventana
echo   y las 12 herramientas OpenCode estaran disponibles.
echo   ===================================================
echo.
echo   Para DETENER: cierra esta ventana o presiona Ctrl+C
echo.

:: Mantener ventana abierta
:loop
timeout /t 10 /nobreak > nul
:: Verificar que los procesos sigan vivos
tasklist /fi "WINDOWTITLE eq AGENT-SERVER*" 2>nul | findstr /i "node" >nul
if errorlevel 1 (
    echo [!] Agent Server se detuvo. Re iniciando...
    start "AGENT-SERVER" /B node "%~dp0..\opencode-core\agent-server.mjs" > "%TEMP%\agent-server.log" 2>&1
)
tasklist /fi "WINDOWTITLE eq BRIDGE*" 2>nul | findstr /i "node" >nul
if errorlevel 1 (
    echo [!] Bridge se detuvo. Re iniciando...
    set HERMES_BRIDGE_PORT=20100
    set OPENCODE_CONTROL=1
    start "BRIDGE" /B node "%~dp0bridge\bridge.mjs" > "%TEMP%\hermes-bridge.log" 2>&1
)
goto loop

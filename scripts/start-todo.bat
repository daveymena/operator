@echo off
title OPENCODE + HERMES - SISTEMA COMPLETO
cd /d "%~dp0"

echo ============================================
echo  Iniciando Sistema: OpenCode + Hermes
echo ============================================
echo.

:: 1. Matar procesos viejos
echo [1/6] Limpiando procesos anteriores...
taskkill /f /im node.exe /fi "WINDOWTITLE eq OPENCODE*" > nul 2>&1
taskkill /f /im node.exe /fi "WINDOWTITLE eq HERMES*" > nul 2>&1
timeout /t 2 /nobreak > nul

:: 2. Iniciar Agent Server (WebSocket para PC remota)
echo [2/6] Iniciando Agent Server (puerto 20102)...
start "OPENCODE Agent" /B "" cmd /c "set AGENT_WS_PORT=20102 && node "%~dp0opencode-core\agent-server.mjs" > "%TEMP%\agent-server.log" 2>&1"
timeout /t 2 /nobreak > nul

:: 3. Iniciar PC Agent
echo [3/6] Iniciando PC Agent...
start "OPENCODE PCAgent" /B "" node "%~dp0opencode-core\pc-agent.mjs" > "%TEMP%\pc-agent.log" 2>&1
timeout /t 2 /nobreak > nul

:: 4. Iniciar Bridge OpenCode-Hermes
echo [4/6] Iniciando Bridge (puerto 20100)...
start "OPENCODE Bridge" /B "" node "%~dp0bridge\bridge.mjs" > "%TEMP%\opencode-bridge.log" 2>&1
timeout /t 2 /nobreak > nul

:: 5. Iniciar Auto-Copilot (renovacion automatica)
echo [5/6] Iniciando Auto-Copilot Daemon...
start "OPENCODE Copilot" /B "" powershell -ExecutionPolicy Bypass -File "%~dp0auto-copilot.ps1" -Daemon
timeout /t 2 /nobreak > nul

:: 6. Iniciar OpenCode Web original
echo [6/6] Iniciando OpenCode Web original...
start "OPENCODE Web" cmd /c "opencode web --port 3000 --hostname 0.0.0.0 --print-logs"
timeout /t 5 /nobreak > nul

start http://localhost:3000

echo.
echo ============================================
echo  TODO LISTO
echo  OpenCode Web: http://localhost:3000
echo  Colmena API:  http://localhost:20102/agents
echo  Copilot:      Auto-renovacion activa
echo  PC Agent:     Conectado
echo ============================================
echo.

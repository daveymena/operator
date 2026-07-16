@echo off
title OpenCode Evolved - PC/WEB Master
color 0A
echo ========================================
echo   OpenCode Evolved - PC/WEB Master
echo   Modo: Alta velocidad
echo ========================================
echo.

:: Check Node.js
node -v >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js no esta instalado.
    pause
    exit /b
)

:: Set performance env vars
set SCREENSHOT_QUALITY=60
set SCREENSHOT_SCALE=0.75
set INSTRUCTION_TIMEOUT=20000
set TASK_TIMEOUT=120000
set MAX_TASK_STEPS=30

:: Install root dependencies if needed
echo Verificando dependencias...
IF NOT EXIST "node_modules\ws" (
    echo Instalando dependencias...
    call npm install
)

:: Kill any existing processes on our ports
echo Limpiando procesos anteriores...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :21291') do taskkill /f /pid %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :21294') do taskkill /f /pid %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :21295') do taskkill /f /pid %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :21296') do taskkill /f /pid %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do taskkill /f /pid %%a 2>nul
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3001') do taskkill /f /pid %%a 2>nul
timeout /t 2 /nobreak >nul

echo.
echo ========================================
echo   Iniciando servicios...
echo ========================================
echo.

echo [1/5] Iniciando Agent Server (21291) - Hub de PCs...
start "Agent Server" cmd /k "cd /d %~dp0 && node agent-server.mjs"
timeout /t 2 /nobreak >nul

echo [2/5] Iniciando Bridge Server (21295) - Cerebro ^<->^ Manos...
start "Bridge Server" cmd /k "cd /d %~dp0 && node bridge-server.mjs"
timeout /t 2 /nobreak >nul

echo [3/5] Iniciando MCP Server (21296) - Herramientas PC/WEB...
start "MCP Server" cmd /k "cd /d %~dp0 && node mimo-mcp-server.mjs"
timeout /t 2 /nobreak >nul

echo [4/5] Iniciando PC Agent - Control de esta PC...
start "PC Agent" cmd /k "cd /d %~dp0 && node pc-agent.mjs"

echo [5/5] Iniciando Web Operator (3001) - Automatizacion navegador...
IF EXIST "web-operator\api-server.js" (
    start "Web Operator" cmd /k "cd /d %~dp0web-operator && node api-server.js"
)

echo.
echo ========================================
echo   TODO INICIADO - RENDIMIENTO OPTIMIZADO
echo ========================================
echo.
echo   Agent Server:  http://localhost:21291/health
echo   Bridge Server: http://localhost:21295/status
echo   MCP Server:    http://localhost:21296/health
echo   PC Agent:      Conectado automaticamente
echo.
echo   Para probar el sistema completo:
echo     node test-system.mjs
echo.
echo   Para conectar otra PC:
echo     set AGENT_SERVER_URL=ws://localhost:21291/agent
echo     set AGENT_NAME=MiPC
echo     node pc-agent.mjs
echo.
echo   Presiona Ctrl+C en cualquier ventana para detener
echo.
pause

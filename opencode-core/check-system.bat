@echo off
title MiMoCode System Check
echo ========================================
echo   Verificando Sistema MiMoCode
echo ========================================
echo.

echo [1] Bridge Server (21295)...
curl -s http://localhost:21295/status 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo   OFFLINE - Ejecutar: node bridge-server.mjs
) else (
    echo   ONLINE
)
echo.

echo [2] Agent Server (21291)...
curl -s http://localhost:21291/health 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo   OFFLINE - Ejecutar: node agent-server.mjs
) else (
    echo   ONLINE
)
echo.

echo [3] PC Agent (21290)...
curl -s http://localhost:21290/status 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo   OFFLINE - Ejecutar: node pc-agent.mjs
) else (
    echo   ONLINE
)
echo.

echo [4] Proxy Web UI (3000)...
curl -s http://localhost:3000/__health 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo   OFFLINE - Ejecutar: node proxy.mjs
) else (
    echo   ONLINE
)
echo.

echo ========================================
echo   Verificacion completa
echo ========================================
pause

@echo off
title OpenCode PC Agent - EasyPanel
color 0A
echo ========================================
echo   OpenCode PC Agent
echo   Conectando a EasyPanel
echo ========================================
echo.

set AGENT_SERVER_URL=wss://agent-opencode1-operato.2xs2bu.easypanel.host/agent
set AGENT_NAME=PC-Davey
set SCREENSHOT_QUALITY=60
set SCREENSHOT_SCALE=0.75
REM Debe ser el MISMO valor que AGENT_SERVER_TOKEN en EasyPanel (variables
REM de entorno del servicio). Sin esto, cualquiera puede conectarse al
REM endpoint publico /agent y hacerse pasar por tu PC (o por un controlador).
set AGENT_TOKEN=6a9e0ee1b6362a0477029d529aa80f78b4fec77fb4352e7edac5bdc4c44f61a5

echo  Servidor: %AGENT_SERVER_URL%
echo  PC:       %AGENT_NAME%
echo.

cd /d "%~dp0"
node pc-agent.mjs

echo.
echo Desconectado. Presiona cualquier tecla para reintentar...
pause >nul
start "" "%~f0"
exit

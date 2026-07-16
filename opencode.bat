@echo off
title OPENCODE + HERMES - MODO ULTRAPODEROSO
cd /d "%~dp0"

echo ============================================
echo    OPENCODE + HERMES - MODO ULTRAPODEROSO
echo    OpenCode controla Hermes
echo ============================================
echo.

:: Iniciar bridge en segundo plano
echo [1/3] Iniciando puente OpenCode-Hermes...
start /B "" node "%~dp0bridge\bridge.mjs" > "%TEMP%\opencode-bridge.log" 2>&1
timeout /t 3 /nobreak > nul

:: Iniciar PC Agent en segundo plano
echo [2/3] Iniciando PC Agent...
start /B "" node "%~dp0..\opencode-core\pc-agent.mjs" > "%TEMP%\pc-agent.log" 2>&1

:: Iniciar OpenCode serve
echo [3/3] Iniciando OpenCode Serve con IA Hermes...
echo.
node "%~dp0..\opencode-core\serve.js"

:: Al salir, matar procesos
taskkill /f /im node.exe /fi "WINDOWTITLE eq OPENCODE + HERMES - MODO ULTRAPODEROSO" > nul 2>&1

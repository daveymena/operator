@echo off
title CUA Live View — OpenCode Operator
cd /d "%~dp0"

echo ============================================
echo  CUA Live View — OpenCode Operator
echo  Ve el navegador en tiempo real
echo ============================================
echo.

:: 1. Kill any previous web-operator instance
echo [1/4] Limpiando instancias anteriores...
taskkill /f /im node.exe 2>nul >nul
taskkill /f /im chrome.exe 2>nul >nul
timeout /t 2 /nobreak >nul

:: 2. Launch Chrome with remote debugging
echo [2/4] Abriendo Chrome con remote debugging...
set CHROME_PATH=
if exist "C:\Program Files\Google\Chrome\Application\chrome.exe" set CHROME_PATH="C:\Program Files\Google\Chrome\Application\chrome.exe"
if exist "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" set CHROME_PATH="C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set CHROME_PATH="%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"

if defined CHROME_PATH (
    echo  Chrome encontrado: %CHROME_PATH%
    start "" %CHROME_PATH% --remote-debugging-port=9222 --no-first-run --no-default-browser-check --new-window "https://www.google.com"
) else (
    echo  Chrome no encontrado. Abrelo manualmente con:
    echo  --remote-debugging-port=9222
    echo  Luego presiona cualquier tecla para continuar...
    pause >nul
)
timeout /t 3 /nobreak >nul

:: 3. Install dependencies if needed
echo [3/4] Verificando dependencias...
if not exist "node_modules" (
    call npm install
) else (
    echo  Dependencias OK
)

:: 4. Start the web-operator API server
echo [4/4] Iniciando Web Operator API en http://localhost:3001...
echo.
echo  ============================================
echo   LIVE VIEW: http://localhost:3001/live.html
echo  ============================================
echo.

start "" http://localhost:3001/live.html
node api-server.js

pause

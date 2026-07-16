@echo off
title OpenCode Evolved
echo.
echo  ========================================
echo   OpenCode Evolved
echo  ========================================
echo.
echo  Abre en tu navegador:
echo  http://localhost:3000
echo.
cd /d "%~dp0"

:: Instalar express localmente
if not exist "node_modules\express" (
    echo Instalando express...
    npm install express --no-package-lock --prefix . 2>nul
)

:: Iniciar servidor
echo Iniciando...
node serve.js
pause

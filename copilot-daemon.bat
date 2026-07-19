@echo off
title COPILOT TOKEN AUTO-RENEWAL
echo.
echo   ========================================
echo    COPILOT TOKEN AUTO-RENEWAL
echo    Renueva cada 25 minutos
echo   ========================================
echo.
powershell -ExecutionPolicy Bypass -File "%~dp0scripts\copilot-auto.ps1" -Daemon
pause

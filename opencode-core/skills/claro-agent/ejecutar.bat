@echo off
echo ========================================
echo  Ejecutando procesamiento de OTs Claro
echo ========================================
cd /d "%~dp0"
node fill_orders_final.js
pause

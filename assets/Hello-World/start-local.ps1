# Script para iniciar OpenCode localmente

Write-Host "OpenCode Local Startup" -ForegroundColor Cyan

# Definir variables directamente
$env:FREEMODEL_API_KEY = "fe_oa_db8434da9d092b657e26dba8e2cdbf5cc460848f7e3b490c"
$env:FREEMODEL_BASE_URL = "https://api.freemodel.dev/v1"
$env:FREEMODEL_MODEL = "gpt-4o"
$env:OPENAI_API_KEY = "sk-YWevx8mah8rJrsUHuGydWhSYL3tYEyohCYOReAafifhj2m6Kb0La07ywx9Kpbbl7"
$env:PUTER_AUTH_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0IjoiZ3VpIiwidiI6IjAuMC4wIiwidSI6ImRDdjMrQURQU1BldFk0Z09JLyt3Umc9PSIsInV1Ijoic0VDNE5SZi9Ra3FBYWlIZ1FsTWNWZz09IiwiaWF0IjoxNzc4ODYyMDk2fQ.OA-DQOWYxuE0tSxhR4Egl2x50KSgYyPeu-HjT-JqSrs"
$env:GITHUB_TOKEN = "TU_GITHUB_TOKEN_AQUI"

Write-Host "Iniciando OpenCode en puerto 3001..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; opencode serve --port 3001 --hostname 0.0.0.0"

Write-Host "Esperando 10 segundos..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host "Iniciando Proxy en puerto 3000..." -ForegroundColor Yellow  
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PWD'; `$env:PORT='3000'; `$env:OPENCODE_INTERNAL_PORT='3001'; node artifacts/opencode-ui/proxy.mjs"

Start-Sleep -Seconds 5
Write-Host "Abriendo navegador..." -ForegroundColor Green
Start-Process "http://localhost:3000"

Write-Host "Todo listo! Presiona Ctrl+C para salir" -ForegroundColor Green

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Instalando PC Agent como servicio" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ProjectPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$AgenteURL = "wss://agent-opencode1-opencox.2xs2bu.easypanel.host/agent"
$AgenteName = "PC-Davey"

Write-Host "[1/3] Creando acceso directo en Startup..." -ForegroundColor Yellow
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\OpenCode-PCAgent.lnk")
$Shortcut.TargetPath = "powershell.exe"
$Shortcut.Arguments = "-NoProfile -WindowStyle Hidden -Command `"cd '$ProjectPath'; `$env:AGENT_SERVER_URL='$AgenteURL'; `$env:AGENT_NAME='$AgenteName'; node pc-agent.mjs`""
$Shortcut.WorkingDirectory = $ProjectPath
$Shortcut.Description = "OpenCode PC Agent - Conexion EasyPanel"
$Shortcut.Save()
Write-Host "[OK] Acceso directo creado en Startup" -ForegroundColor Green

Write-Host "[2/3] Probando conexion..." -ForegroundColor Yellow
$env:AGENT_SERVER_URL = $AgenteURL
$env:AGENT_NAME = $AgenteName
Start-Process powershell -WindowStyle Hidden -ArgumentList "-NoProfile -Command `"cd '$ProjectPath'; node pc-agent.mjs`""
Start-Sleep -Seconds 3
Write-Host "[OK] PC Agent iniciado en segundo plano" -ForegroundColor Green

Write-Host "[3/3] Verificando..." -ForegroundColor Yellow
$process = Get-Process -Name node -ErrorAction SilentlyContinue
if ($process) {
    Write-Host "[OK] Node.js corriendo - PC Agent activo" -ForegroundColor Green
} else {
    Write-Host "[WARN] Node.js no detectado - puede tardar unos segundos" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PC Agent instalado!" -ForegroundColor Cyan
Write-Host "  Se conectara automaticamente al iniciar Windows" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Servidor: $AgenteURL"
Write-Host "  PC:       $AgenteName"
Write-Host ""
Write-Host "  Para desconectar:"
Write-Host "    taskkill /f /im node.exe"
Write-Host ""
pause

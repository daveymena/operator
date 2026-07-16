Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  OpenCode - Autenticacion GitHub Copilot" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$clientId = "Iv1.b507a08c87ecfe98"
$scope = "read:user"

Write-Host "[1/5] Solicitando codigo de dispositivo..." -ForegroundColor Yellow
$deviceCodeResp = curl.exe -s -X POST "https://github.com/login/device/code" -H "Accept: application/json" -d "client_id=$clientId&scope=$scope" 2>&1
$deviceData = $deviceCodeResp | ConvertFrom-Json
$deviceCode = $deviceData.device_code
$userCode = $deviceData.user_code
$interval = $deviceData.interval
Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  Ve a https://github.com/login/device" -ForegroundColor Green
Write-Host "  Ingresa el codigo: $userCode" -ForegroundColor Yellow
Write-Host "  Autoriza 'Visual Studio Code'" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

Write-Host "[2/5] Esperando autorizacion..." -ForegroundColor Yellow
$accessToken = $null
$elapsed = 0
while (-not $accessToken) {
    Start-Sleep -Seconds $interval
    $elapsed += $interval
    Write-Host "  Esperando... ($elapsed s)" -ForegroundColor DarkYellow
    $tokenResp = curl.exe -s -X POST "https://github.com/login/oauth/access_token" -H "Accept: application/json" -d "client_id=$clientId&device_code=$deviceCode&grant_type=urn:ietf:params:oauth:grant-type:device_code" 2>&1
    $tokenData = $tokenResp | ConvertFrom-Json
    if ($tokenData.access_token) { $accessToken = $tokenData.access_token }
    if ($tokenData.error -eq "authorization_pending") { continue }
    if ($tokenData.error -eq "slow_down") { $interval += 5; continue }
    if ($tokenData.error) { Write-Host "Error: $($tokenData.error)" -ForegroundColor Red; exit 1 }
}

Write-Host "[OK] Autorizado! Token OAuth obtenido." -ForegroundColor Green

Write-Host "[3/5] Obteniendo token de sesion Copilot..." -ForegroundColor Yellow
$sessionResp = curl.exe -s -H "Authorization: token $accessToken" -H "Accept: application/json" "https://api.github.com/copilot_internal/v2/token" 2>&1
$sessionData = $sessionResp | ConvertFrom-Json
$copilotToken = $sessionData.token
Write-Host "[OK] Token de sesion obtenido!" -ForegroundColor Green

Write-Host "[4/5] Probando Copilot API..." -ForegroundColor Yellow
$testBody = '{"model":"gpt-4o","max_tokens":50,"messages":[{"role":"user","content":"Responde solo: SI"}]}'
[System.IO.File]::WriteAllText("$env:TEMP\copilot_test.json", $testBody)
$testResp = curl.exe -s -X POST "https://api.githubcopilot.com/chat/completions" -H "Authorization: Bearer $copilotToken" -H "Content-Type: application/json" -H "Editor-Version: vscode/1.96.0" -H "Editor-Plugin-Version: copilot/1.250.0" -H "Openai-Organization: github-copilot" -H "Copilot-Integration-Id: vscode-chat" -d "@$env:TEMP\copilot_test.json" 2>&1
$testData = $testResp | ConvertFrom-Json -ErrorAction SilentlyContinue
if ($testData.choices[0].message.content -eq "SI") {
    Write-Host "[OK] Copilot funciona!" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Copilot fallo: $testResp" -ForegroundColor Red
}

Write-Host "[5/5] Guardando token..." -ForegroundColor Yellow
$envContent = @"
GITHUB_COPILOT_TOKEN=$copilotToken
GITHUB_TOKEN=$accessToken
GITHUB_MODEL=gpt-4o
"@
Set-Content -Path "$PSScriptRoot\.env.copilot" -Value $envContent -Force
Write-Host "[OK] Token guardado en .env.copilot" -ForegroundColor Green
Write-Host "[OK] Token: $($copilotToken.Substring(0, 30))..." -ForegroundColor Gray
Write-Host "[OK] Ahora el Web Operator usara Copilot!" -ForegroundColor Green

param([switch]$Daemon)
$LOG = "$env:TEMP\auto-copilot.log"
$HERMES_CONFIG = "$env:USERPROFILE\.hermes\config.yaml"
$OPENCODE_ENV = "C:\Users\ADMIN\Music\opencode-core\.env"
$HERMES_ENV = "$env:USERPROFILE\.hermes\.env"

function Log { $msg = "[$(Get-Date -Format HH:mm:ss)] $args"; Write-Host $msg -ForegroundColor Cyan; Add-Content $LOG $msg }

function Update-CopilotToken {
  try {
    $ghToken = gh auth token 2>&1
    if (-not $ghToken) { throw "No gh auth token" }
    $r = Invoke-RestMethod -Uri "https://api.github.com/copilot_internal/v2/token" -Headers @{"Authorization"="token $ghToken"} -Method Get -TimeoutSec 15
    $ct = $r.token
    $exp = $r.expires_at
    $expDate = (Get-Date -Date "1970-01-01").AddSeconds($exp)
    Log "Token renovado, expira: $expDate, quota: $($r.limited_user_quotas.chat) chats"
    @(
      @($OPENCODE_ENV, $ct),
      @($HERMES_ENV, $ct)
    ) | ForEach-Object {
      $file = $_[0]; $token = $_[1]
      if (Test-Path $file) {
        $content = Get-Content $file -Raw
        $content = $content -replace 'GITHUB_COPILOT_TOKEN=.*', "GITHUB_COPILOT_TOKEN=$token"
        Set-Content $file -Value $content -NoNewline
      }
    }
    if (Test-Path $HERMES_CONFIG) {
      $yaml = Get-Content $HERMES_CONFIG -Raw
      $escaped = $token -replace '\\', '\\' -replace '"', '\"'
      $yaml = $yaml -replace 'api_key: tid=.*', "api_key: $escaped"
      Set-Content $HERMES_CONFIG -Value $yaml -NoNewline
    }
    Log "Token actualizado en configs"
    return $true
  } catch { Log "Error: $_"; return $false }
}

if ($Daemon) {
  Log "=== AUTO-COPILOT DAEMON INICIADO ==="
  while ($true) {
    $ok = Update-CopilotToken
    if ($ok) { Log "Durmiendo 25min..."; Start-Sleep -Seconds 1500 }
    else { Log "Reintentando en 30s..."; Start-Sleep -Seconds 30 }
  }
} else {
  $ok = Update-CopilotToken
  if ($ok) { Write-Host "Copilot token renovado!" -ForegroundColor Green }
  else { Write-Host "Falló renovación" -ForegroundColor Red }
}

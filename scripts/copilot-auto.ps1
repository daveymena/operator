# ============================================================
# Copilot Token Auto-Generator
# Renueva automaticamente el token de Copilot cada 25 minutos
# Usa el OAuth token de opencode-core para generar tokens
# ============================================================

param([switch]$Daemon, [int]$IntervalMinutes = 25)

$ROOT = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$OPENCODE_ENV = Join-Path $ROOT "opencode-core\.env"
$PROJECT_ENV = Join-Path $ROOT "config\.env"
$HERMES_ENV = "$env:USERPROFILE\.hermes\.env"
$LOG_FILE = Join-Path $ROOT "logs\copilot-auto.log"

# Crear directorio de logs
$null = New-Item -ItemType Directory -Force -Path (Split-Path $LOG_FILE) -ErrorAction SilentlyContinue

function Log {
    param([string]$msg)
    $ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $line = "[$ts] $msg"
    Write-Host $line -ForegroundColor Cyan
    Add-Content -Path $LOG_FILE -Value $line -ErrorAction SilentlyContinue
}

function Get-EnvValue {
    param([string]$file, [string]$key)
    if (-not (Test-Path $file)) { return $null }
    $content = Get-Content $file -Raw
    $match = [regex]::Match($content, "(?m)^$key=(.*)$")
    if ($match.Success) { return $match.Groups[1].Value.Trim() }
    return $null
}

function Set-EnvValue {
    param([string]$file, [string]$key, [string]$value)
    if (-not (Test-Path $file)) { return $false }
    $content = Get-Content $file -Raw
    $newContent = $content -replace "(?m)^$key=.*$", "$key=$value"
    Set-Content -Path $file -Value $newContent -NoNewline
    return $true
}

function Renew-CopilotToken {
    Log "Iniciando renovacion de token Copilot..."
    
    # 1. Obtener OAuth token de opencode-core
    $oauthToken = Get-EnvValue -file $OPENCODE_ENV -key "GITHUB_TOKEN"
    if (-not $oauthToken -or $oauthToken.Length -lt 10) {
        Log "ERROR: No se encontro GITHUB_TOKEN en opencode-core/.env"
        return $false
    }
    Log "OAuth token encontrado: $($oauthToken.Substring(0, [Math]::Min(10, $oauthToken.Length)))..."
    
    # 2. Obtener token de Copilot
    try {
        $headers = @{
            "Authorization" = "token $oauthToken"
            "Accept" = "application/json"
        }
        $response = Invoke-RestMethod -Uri "https://api.github.com/copilot_internal/v2/token" -Headers $headers -Method Get -TimeoutSec 15
        
        $copilotToken = $response.token
        $expiresAt = $response.expires_at
        $expDate = (Get-Date -Date "1970-01-01").AddSeconds($expiresAt)
        $remaining = ($expDate - (Get-Date)).TotalMinutes
        
        Log "Token Copilot obtenido! Expira: $expDate (restante: $([Math]::Round($remaining)) min)"
        Log "Quota chat: $($response.limited_user_quotas.chat)"
        
        # 3. Actualizar todos los .env
        $files = @($PROJECT_ENV, $HERMES_ENV)
        foreach ($file in $files) {
            if (Set-EnvValue -file $file -key "GITHUB_COPILOT_TOKEN" -value $copilotToken) {
                Log "Actualizado: $file"
            }
        }
        
        # 4. Actualizar GITHUB_TOKEN tambien
        Set-EnvValue -file $PROJECT_ENV -key "GITHUB_TOKEN" -value $oauthToken | Out-Null
        
        Log "Renovacion completada exitosamente"
        return $true
        
    } catch {
        Log "ERROR al obtener token Copilot: $($_.Exception.Message)"
        
        # Intentar con el PAT como fallback
        $patToken = Get-EnvValue -file $PROJECT_ENV -key "GITHUB_TOKEN"
        if ($patToken -and $patToken.StartsWith("ghp_")) {
            Log "Intentando con PAT como fallback..."
            try {
                $response2 = Invoke-RestMethod -Uri "https://api.github.com/copilot_internal/v2/token" -Headers @{"Authorization"="token $patToken"; "Accept"="application/json"} -Method Get -TimeoutSec 15
                Log "PAT funciona! Token obtenido."
                Set-EnvValue -file $PROJECT_ENV -key "GITHUB_COPILOT_TOKEN" -value $response2.token | Out-Null
                return $true
            } catch {
                Log "PAT fallback fallo: $($_.Exception.Message)"
            }
        }
        
        return $false
    }
}

# === Main ===
if ($Daemon) {
    Log "=== COPILOT AUTO-GENERATOR INICIADO (Daemon) ==="
    Log "Intervalo: $IntervalMinutes minutos"
    
    while ($true) {
        $ok = Renew-CopilotToken
        if ($ok) {
            Log "Esperando $IntervalMinutes minutos..."
            Start-Sleep -Seconds ($IntervalMinutes * 60)
        } else {
            Log "Reintentando en 60 segundos..."
            Start-Sleep -Seconds 60
        }
    }
} else {
    # Modo single run
    $ok = Renew-CopilotToken
    if ($ok) {
        Write-Host ""
        Write-Host "Token Copilot renovado exitosamente!" -ForegroundColor Green
    } else {
        Write-Host ""
        Write-Host "Fallo la renovacion del token" -ForegroundColor Red
    }
}

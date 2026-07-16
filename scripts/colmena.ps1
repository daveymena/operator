param(
  [Parameter(Position=0)][string]$Action = "list",
  [Parameter(Position=1)][string]$Target = "",
  [Parameter(Position=2)][string]$Arg1 = "",
  [Parameter(Position=3)][string]$Arg2 = ""
)

$AGENT_API = "http://localhost:20102"
$COLORS = @{ cyan = "Cyan"; yellow = "Yellow"; green = "Green"; red = "Red"; gray = "Gray" }

function Log($color, $msg) { Write-Host $msg -ForegroundColor $COLORS[$color] }

function Get-Agents {
  try { return Invoke-RestMethod -Uri "$AGENT_API/agents" -TimeoutSec 5 }
  catch { Log red "Error: $($_.Exception.Message)"; return @() }
}

function Send-Cmd($agentId, $cmd) {
  try {
    $body = $cmd | ConvertTo-Json -Compress
    return Invoke-RestMethod -Uri "$AGENT_API/agents/$agentId" -Method Post -Body $body -ContentType "application/json" -TimeoutSec 30
  }
  catch { Log red "Error: $($_.Exception.Message)"; return $null }
}

function Show-Help {
  Log cyan "MENTE COLMENA (Hive Mind) - Control Remoto de PC"
  Log yellow ""
  Log yellow "  list                          Lista PCs conectados"
  Log yellow "  open <ID> <URL>               Abre URL en el PC remoto"
  Log yellow "  cmd <ID> <comando>            Ejecuta comando CMD"
  Log yellow "  ps <ID> <script>              Ejecuta PowerShell remoto"
  Log yellow "  screenshot <ID>               Captura pantalla del PC"
  Log yellow "  mouse_move <ID> <X> <Y>       Mueve mouse a (X,Y)"
  Log yellow "  mouse_click <ID> [left/right]  Click del mouse"
  Log yellow "  type <ID> <texto>             Escribe texto"
  Log yellow "  notify <ID> <mensaje>         Notificación push"
  Log yellow "  sysinfo <ID>                  Info del sistema"
  Log yellow "  help                          Este mensaje"
  Log gray  ""
  Log gray  "Ejemplo: .\colmena.ps1 open 1481d836... https://google.com"
}

switch ($Action.ToLower()) {
  "list" {
    $agents = Get-Agents
    if ($agents.Count -eq 0) { Log yellow "No hay PCs conectados."; exit }
    Log green "PCs conectados ($($agents.Count)):"
    foreach ($a in $agents) {
      Write-Host "  [$($a.id.Substring(0,8))...] $($a.name)  ($($a.sysinfo.hostname) - $($a.sysinfo.platform))"
    }
  }
  "open" {
    if (-not $Target -or -not $Arg1) { Log red "Uso: colmena open <ID> <URL>"; exit }
    Log cyan "Abriendo $Arg1 en $Target..."
    $r = Send-Cmd $Target @{ type = "open_url"; url = $Arg1 }
    $r | ConvertTo-Json
  }
  "cmd" {
    if (-not $Target -or -not $Arg1) { Log red "Uso: colmena cmd <ID> <comando>"; exit }
    Log cyan "Ejecutando: $Arg1"
    $r = Send-Cmd $Target @{ type = "cmd"; command = $Arg1 }
    if ($r.stdout) { Write-Host $r.stdout }
    if ($r.stderr) { Log red $r.stderr }
  }
  "ps" {
    if (-not $Target -or -not $Arg1) { Log red "Uso: colmena ps <ID> <script>"; exit }
    Log cyan "Ejecutando PowerShell remoto..."
    $r = Send-Cmd $Target @{ type = "powershell"; script = $Arg1 }
    if ($r.stdout) { Write-Host $r.stdout }
    if ($r.stderr) { Log red $r.stderr }
  }
  "screenshot" {
    if (-not $Target) { Log red "Uso: colmena screenshot <ID>"; exit }
    Log cyan "Tomando captura..."
    $r = Send-Cmd $Target @{ type = "screenshot"; quality = 75; scale = 0.75 }
    if ($r.base64) {
      $bytes = [Convert]::FromBase64String($r.base64)
      $path = Join-Path $pwd "screenshot_$(Get-Date -Format yyyyMMdd_HHmmss).jpg"
      [IO.File]::WriteAllBytes($path, $bytes)
      Log green "Captura guardada: $path (${width}x${height})"
    } else { Log red "Error: $($r.error)" }
  }
  "mouse_move" {
    if (-not $Target -or -not $Arg1 -or -not $Arg2) { Log red "Uso: colmena mouse_move <ID> <X> <Y>"; exit }
    $r = Send-Cmd $Target @{ type = "mouse_move"; x = [int]$Arg1; y = [int]$Arg2 }
    Log green "Mouse movido a ($Arg1, $Arg2)"
  }
  "mouse_click" {
    if (-not $Target) { Log red "Uso: colmena mouse_click <ID> [left/right]"; exit }
    $btn = if ($Arg1) { $Arg1 } else { "left" }
    $r = Send-Cmd $Target @{ type = "mouse_click"; button = $btn }
    Log green "Click ($btn)"
  }
  "type" {
    if (-not $Target -or -not $Arg1) { Log red "Uso: colmena type <ID> <texto>"; exit }
    $r = Send-Cmd $Target @{ type = "keyboard_type"; text = $Arg1 }
    Log green "Texto enviado"
  }
  "notify" {
    if (-not $Target -or -not $Arg1) { Log red "Uso: colmena notify <ID> <mensaje>"; exit }
    $r = Send-Cmd $Target @{ type = "notify"; title = "OpenCode Colmena"; message = $Arg1 }
    Log green "Notificación enviada"
  }
  "sysinfo" {
    if (-not $Target) { Log red "Uso: colmena sysinfo <ID>"; exit }
    $r = Send-Cmd $Target @{ type = "sysinfo" }
    $r | ConvertTo-Json
  }
  default { Show-Help }
}

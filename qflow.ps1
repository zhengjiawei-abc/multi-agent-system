param(
  [Parameter(Position = 0)]
  [ValidateSet("desktop", "server", "platform", "admin", "runtime", "status", "stop", "help")]
  [string]$Command = "desktop",

  [int]$Port = 0,
  [switch]$NoInstall
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigPath = Join-Path $Root "desktop.config.json"
$Config = Get-Content $ConfigPath -Raw | ConvertFrom-Json
$AppPort = if ($Port -gt 0) { $Port } else { [int]$Config.port }
$HostName = if ($Config.host) { [string]$Config.host } else { "127.0.0.1" }
$BindHost = if ($Config.bindHost) { [string]$Config.bindHost } else { $HostName }
$BaseUrl = "http://$HostName`:$AppPort"

function Show-Help {
  Write-Host ""
  Write-Host "QuantumFlow command line"
  Write-Host ""
  Write-Host "Usage:"
  Write-Host "  qflow.cmd desktop      Start API service and open desktop/browser app"
  Write-Host "  qflow.cmd server       Start API service in the current console"
  Write-Host "  qflow.cmd platform     Open Source Civilization workspace"
  Write-Host "  qflow.cmd admin        Open developer admin center"
  Write-Host "  qflow.cmd runtime      Open runtime environment view"
  Write-Host "  qflow.cmd status       Check local service status"
  Write-Host "  qflow.cmd stop         Stop local QuantumFlow uvicorn process"
  Write-Host ""
  Write-Host "Options:"
  Write-Host "  -Port 8765             Override configured port"
  Write-Host "  -NoInstall             Skip pip install step"
  Write-Host ""
}

function Get-PythonPath {
  $venvPython = Join-Path $Root ".venv\Scripts\python.exe"
  if (Test-Path $venvPython) { return $venvPython }
  return "python"
}

function Ensure-Venv {
  $venvPython = Join-Path $Root ".venv\Scripts\python.exe"
  if (-not (Test-Path $venvPython)) {
    Write-Host "Creating virtual environment..."
    python -m venv (Join-Path $Root ".venv")
  }
  if (-not $NoInstall) {
    Write-Host "Installing Python dependencies..."
    & $venvPython -m pip install -r (Join-Path $Root "requirements.txt")
  }
  return $venvPython
}

function Get-ServerProcess {
  Get-CimInstance Win32_Process | Where-Object {
    ($_.Name -like "python*.exe") -and
    ($_.CommandLine -like "*uvicorn*server:app*") -and
    ($_.CommandLine -like "*--port*$AppPort*")
  }
}

function Start-ServerHidden {
  $existing = Get-ServerProcess
  if ($existing) {
    Write-Host "QuantumFlow service already running on $BaseUrl"
    return
  }

  $python = Ensure-Venv
  Write-Host "Starting QuantumFlow service on $BaseUrl ..."
  Start-Process $python `
    -ArgumentList @("-m", "uvicorn", "server:app", "--host", $BindHost, "--port", "$AppPort") `
    -WorkingDirectory $Root `
    -WindowStyle Hidden | Out-Null
  Start-Sleep -Seconds 4
}

function Start-ServerForeground {
  $python = Ensure-Venv
  Write-Host "Starting QuantumFlow service on $BaseUrl ..."
  & $python -m uvicorn server:app --host $BindHost --port $AppPort
}

function Open-App([string]$Path) {
  $targetUrl = "$BaseUrl$Path"
  $electronRoot = Join-Path $Root "desktop-electron"
  $electronExe = Join-Path $electronRoot "node_modules\electron\dist\electron.exe"

  if (Test-Path $electronExe) {
    Start-Process $electronExe -ArgumentList @(".") -WorkingDirectory $electronRoot | Out-Null
    Write-Host "Opened Electron desktop app."
    return
  }

  $browserCandidates = @(
    "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles(x86)\Microsoft\Edge\Application\msedge.exe",
    "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
    "$env:ProgramFiles(x86)\Google\Chrome\Application\chrome.exe"
  )
  $browser = $browserCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $browser) {
    Start-Process $targetUrl
    Write-Host "Opened $targetUrl"
    return
  }

  $size = "$($Config.window.width),$($Config.window.height)"
  Start-Process $browser -ArgumentList @("--app=$targetUrl", "--window-size=$size", "--new-window") | Out-Null
  Write-Host "Opened $targetUrl"
}

function Show-Status {
  $process = Get-ServerProcess
  if (-not $process) {
    Write-Host "QuantumFlow service is not running on port $AppPort."
    return
  }

  try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/api/app-version" -UseBasicParsing -TimeoutSec 4
    Write-Host "QuantumFlow service is running: HTTP $($response.StatusCode) $BaseUrl"
  } catch {
    Write-Host "QuantumFlow process exists, but health check failed: $($_.Exception.Message)"
  }
}

function Stop-Server {
  $processes = Get-ServerProcess
  if (-not $processes) {
    Write-Host "No QuantumFlow service found on port $AppPort."
    return
  }
  $processes | ForEach-Object {
    Write-Host "Stopping QuantumFlow process $($_.ProcessId)..."
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

switch ($Command) {
  "help" { Show-Help }
  "server" { Start-ServerForeground }
  "desktop" {
    Start-ServerHidden
    Open-App $Config.defaultPath
  }
  "platform" {
    Start-ServerHidden
    Open-App $Config.platformPath
  }
  "admin" {
    Start-ServerHidden
    Open-App $Config.adminPath
  }
  "runtime" {
    Start-ServerHidden
    Open-App "/runtime-environment"
  }
  "status" { Show-Status }
  "stop" { Stop-Server }
}

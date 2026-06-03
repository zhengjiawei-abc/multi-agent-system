$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$config = Get-Content (Join-Path $root "desktop.config.json") -Raw | ConvertFrom-Json
$baseUrl = "http://$($config.host):$($config.port)"
$bindHost = if ($config.bindHost) { $config.bindHost } else { $config.host }

$existing = Get-CimInstance Win32_Process | Where-Object {
  ($_.Name -like "python*.exe") -and ($_.CommandLine -like "*uvicorn*server:app*--port*$($config.port)*")
}

if (-not $existing) {
  $python = Join-Path $root ".venv\Scripts\python.exe"
  if (-not (Test-Path $python)) {
    python -m venv (Join-Path $root ".venv")
    & $python -m pip install -r (Join-Path $root "requirements.txt")
  }
  Start-Process $python -ArgumentList @("-m", "uvicorn", "server:app", "--host", $bindHost, "--port", "$($config.port)") -WorkingDirectory $root -WindowStyle Hidden | Out-Null
  Start-Sleep -Seconds 5
}

$electronRoot = Join-Path $root "desktop-electron"
$electronExe = Join-Path $electronRoot "node_modules\electron\dist\electron.exe"
if (Test-Path $electronExe) {
  Start-Process $electronExe -ArgumentList @(".") -WorkingDirectory $electronRoot | Out-Null
  exit 0
}

$targetUrl = "$baseUrl$($config.defaultPath)"

if ($args.Count -gt 0 -and $args[0] -eq "platform") {
  $targetUrl = "$baseUrl$($config.platformPath)"
}
if ($args.Count -gt 0 -and $args[0] -eq "admin") {
  $targetUrl = "$baseUrl$($config.adminPath)"
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
  exit 0
}

$size = "$($config.window.width),$($config.window.height)"
Start-Process $browser -ArgumentList @(
  "--app=$targetUrl",
  "--window-size=$size",
  "--disable-features=Translate",
  "--new-window"
) | Out-Null

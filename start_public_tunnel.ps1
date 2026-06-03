$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$tools = Join-Path $root "tools"
$cloudflared = Join-Path $tools "cloudflared.exe"
$publicInfo = Join-Path $root "public_tunnel.json"
$port = 8765
$localUrl = "http://127.0.0.1:$port"

New-Item -ItemType Directory -Force -Path $tools | Out-Null

if (-not (Test-Path $cloudflared)) {
  Write-Host "Downloading cloudflared..."
  $downloadUrl = "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe"
  Invoke-WebRequest -Uri $downloadUrl -OutFile $cloudflared
}

try {
  & $cloudflared --version | Out-Null
} catch {
  throw "cloudflared cannot run on this machine or the download is incomplete. You can use any tunnel tool, then run: .\set_public_url.ps1 https://your-public-url"
}

$existingServer = Get-CimInstance Win32_Process | Where-Object {
  ($_.Name -like "python*.exe") -and ($_.CommandLine -like "*uvicorn*server:app*--port*$port*")
}

if (-not $existingServer) {
  $python = Join-Path $root ".venv\Scripts\python.exe"
  if (-not (Test-Path $python)) {
    python -m venv (Join-Path $root ".venv")
    & $python -m pip install -r (Join-Path $root "requirements.txt")
  }
  Start-Process $python -ArgumentList @("-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "$port") -WorkingDirectory $root -WindowStyle Hidden | Out-Null
  Start-Sleep -Seconds 4
}

$oldTunnels = Get-CimInstance Win32_Process | Where-Object {
  ($_.Name -eq "cloudflared.exe") -and ($_.CommandLine -like "*tunnel*--url*$localUrl*")
}
$oldTunnels | ForEach-Object {
  Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}

$outLog = Join-Path $tools "cloudflared-public.out.log"
$errLog = Join-Path $tools "cloudflared-public.err.log"
Remove-Item -Path $outLog, $errLog -Force -ErrorAction SilentlyContinue

$process = Start-Process $cloudflared `
  -ArgumentList @("tunnel", "--no-autoupdate", "--url", $localUrl) `
  -WorkingDirectory $root `
  -RedirectStandardOutput $outLog `
  -RedirectStandardError $errLog `
  -WindowStyle Hidden `
  -PassThru

$publicUrl = ""
$deadline = (Get-Date).AddSeconds(45)
while ((Get-Date) -lt $deadline -and -not $publicUrl) {
  Start-Sleep -Milliseconds 700
  $text = ""
  if (Test-Path $outLog) { $text += "`n" + (Get-Content $outLog -Raw -ErrorAction SilentlyContinue) }
  if (Test-Path $errLog) { $text += "`n" + (Get-Content $errLog -Raw -ErrorAction SilentlyContinue) }
  $match = [regex]::Match($text, "https://[a-zA-Z0-9-]+\.trycloudflare\.com")
  if ($match.Success) { $publicUrl = $match.Value }
}

if (-not $publicUrl) {
  Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
  throw "Cloudflare Tunnel did not return a public URL. Check $errLog"
}

$info = [ordered]@{
  ok = $true
  provider = "cloudflare_quick_tunnel"
  public_url = $publicUrl
  local_url = $localUrl
  websocket_url = ($publicUrl -replace "^https://", "wss://") + "/ws"
  process_id = $process.Id
  created_at = (Get-Date).ToString("s")
}

$info | ConvertTo-Json | Set-Content -Path $publicInfo -Encoding UTF8

Write-Host ""
Write-Host "QuantumFlow public entrance is ready:"
Write-Host $publicUrl
Write-Host ""
Write-Host "Share this URL with your collaborators. Keep this tunnel process running."

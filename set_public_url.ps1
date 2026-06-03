$ErrorActionPreference = "Stop"

param(
  [Parameter(Mandatory = $true)]
  [string]$Url
)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$publicInfo = Join-Path $root "public_tunnel.json"
$clean = $Url.Trim().TrimEnd("/")

if (-not ($clean.StartsWith("https://") -or $clean.StartsWith("http://"))) {
  throw "Public URL must start with https:// or http://"
}

$ws = if ($clean.StartsWith("https://")) {
  ($clean -replace "^https://", "wss://") + "/ws"
} else {
  ($clean -replace "^http://", "ws://") + "/ws"
}

$info = [ordered]@{
  ok = $true
  provider = "manual_public_url"
  public_url = $clean
  local_url = "http://127.0.0.1:8765"
  websocket_url = $ws
  process_id = $null
  created_at = (Get-Date).ToString("s")
}

$info | ConvertTo-Json | Set-Content -Path $publicInfo -Encoding UTF8

Write-Host "QuantumFlow public URL saved:"
Write-Host $clean

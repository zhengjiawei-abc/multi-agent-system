param(
  [Parameter(Mandatory = $true)]
  [string]$NetworkId
)

$ErrorActionPreference = 'Stop'

$homeDir = 'C:\ProgramData\ZeroTier\One'
$exe = Join-Path $homeDir 'zerotier-one_x64.exe'
$tokenPath = Join-Path $homeDir 'authtoken.secret'
$outPath = 'D:\agent\zerotier_join_result.txt'

if (-not (Test-Path -LiteralPath $exe)) {
  throw "ZeroTier executable not found: $exe"
}

if (-not ($NetworkId -match '^[0-9a-fA-F]{16}$')) {
  throw "NetworkId must be a 16-character ZeroTier network ID."
}

$token = (Get-Content -LiteralPath $tokenPath -Raw).Trim()
$join = & $exe -q "-T$token" join $NetworkId 2>&1
Start-Sleep -Seconds 3
$info = & $exe -q "-T$token" info 2>&1
$networks = & $exe -q "-T$token" listnetworks 2>&1

@(
  'JOIN:'
  $join
  ''
  'INFO:'
  $info
  ''
  'NETWORKS:'
  $networks
  ''
  'NEXT:'
  'Authorize this device in ZeroTier Central, then run zerotier_detect_ip.ps1.'
) | Set-Content -LiteralPath $outPath -Encoding UTF8

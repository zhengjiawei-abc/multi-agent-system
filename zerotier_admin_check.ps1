$ErrorActionPreference = 'Stop'

$homeDir = 'C:\ProgramData\ZeroTier\One'
$exe = Join-Path $homeDir 'zerotier-one_x64.exe'
$tokenPath = Join-Path $homeDir 'authtoken.secret'
$outPath = 'D:\agent\zerotier_status.txt'

$token = (Get-Content -LiteralPath $tokenPath -Raw).Trim()
$info = & $exe -q "-T$token" info 2>&1
$networks = & $exe -q "-T$token" listnetworks 2>&1

@(
  'INFO:'
  $info
  ''
  'NETWORKS:'
  $networks
) | Set-Content -LiteralPath $outPath -Encoding UTF8

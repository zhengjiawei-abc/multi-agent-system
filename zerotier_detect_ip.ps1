$ErrorActionPreference = 'Stop'

$homeDir = 'C:\ProgramData\ZeroTier\One'
$exe = Join-Path $homeDir 'zerotier-one_x64.exe'
$tokenPath = Join-Path $homeDir 'authtoken.secret'
$outPath = 'D:\agent\zerotier_access_url.txt'

$token = (Get-Content -LiteralPath $tokenPath -Raw).Trim()
$networksJson = & $exe -q "-T$token" -j listnetworks 2>$null
$networks = $networksJson | ConvertFrom-Json

$assigned = @()
foreach ($network in $networks) {
  foreach ($ip in @($network.assignedAddresses)) {
    if ($ip -match '^(\d{1,3}(?:\.\d{1,3}){3})/') {
      $assigned += [pscustomobject]@{
        NetworkId = $network.nwid
        Name = $network.name
        Status = $network.status
        Ip = $Matches[1]
        Url = "http://$($Matches[1]):8765"
      }
    }
  }
}

if (-not $assigned) {
  @(
    'No ZeroTier IPv4 address detected yet.'
    'Make sure this device is authorized in ZeroTier Central.'
    ''
    'Current networks:'
    (& $exe -q "-T$token" listnetworks 2>&1)
  ) | Set-Content -LiteralPath $outPath -Encoding UTF8
  exit 2
}

$assigned |
  Format-Table NetworkId, Name, Status, Ip, Url -AutoSize |
  Out-String |
  Set-Content -LiteralPath $outPath -Encoding UTF8

$ErrorActionPreference = 'Stop'

$homeDir = 'C:\ProgramData\ZeroTier\One'
$exe = Join-Path $homeDir 'zerotier-one_x64.exe'
$tokenPath = Join-Path $homeDir 'authtoken.secret'
$outPath = 'D:\agent\zerotier_create_network_result.txt'

$token = (Get-Content -LiteralPath $tokenPath -Raw).Trim()
$headers = @{ 'X-ZT1-Auth' = $token }
$port = (Get-Content -LiteralPath (Join-Path $homeDir 'zerotier-one.port') -Raw).Trim()
$baseUrl = "http://127.0.0.1:$port"
$infoRaw = & $exe -q "-T$token" info

if (-not ($infoRaw -match '200 info ([0-9a-fA-F]{10})')) {
  throw "Cannot read ZeroTier node ID from: $infoRaw"
}

$nodeId = $Matches[1].ToLowerInvariant()
$networkSuffix = (Get-Random -Minimum 0x100000 -Maximum 0xffffff).ToString('x6')
$networkId = "$nodeId$networkSuffix"
$networkName = 'QuantumFlow DevNet'
$cidr = '10.147.17.0/24'
$rangeStart = '10.147.17.10'
$rangeEnd = '10.147.17.250'

$createUrl = "$baseUrl/controller/network/$networkId"
$null = Invoke-RestMethod -Method Post -Uri $createUrl -Headers $headers -ContentType 'application/json' -Body '{}'

$config = @{
  name = $networkName
  private = $true
  enableBroadcast = $true
  mtu = 2800
  dns = @()
  routes = @(
    @{
      target = $cidr
      via = $null
    }
  )
  ipAssignmentPools = @(
    @{
      ipRangeStart = $rangeStart
      ipRangeEnd = $rangeEnd
    }
  )
  v4AssignMode = @{
    zt = $true
  }
  v6AssignMode = @{
    zt = $false
    rfc4193 = $false
    sixplane = $false
  }
}

$configJson = $config | ConvertTo-Json -Depth 10
$null = Invoke-RestMethod -Method Post -Uri $createUrl -Headers $headers -ContentType 'application/json' -Body $configJson

$join = & $exe -q "-T$token" join $networkId 2>&1
Start-Sleep -Seconds 4

$membersUrl = "$baseUrl/controller/network/$networkId/member"
$members = Invoke-RestMethod -Method Get -Uri $membersUrl -Headers $headers
foreach ($memberName in $members.PSObject.Properties.Name) {
  $memberUrl = "$baseUrl/controller/network/$networkId/member/$memberName"
  $memberConfig = Invoke-RestMethod -Method Get -Uri $memberUrl -Headers $headers
  $memberConfig.config.authorized = $true
  $memberBody = $memberConfig | ConvertTo-Json -Depth 20
  $null = Invoke-RestMethod -Method Post -Uri $memberUrl -Headers $headers -ContentType 'application/json' -Body $memberBody
}

$networks = & $exe -q "-T$token" listnetworks 2>&1
$networkJson = Invoke-RestMethod -Method Get -Uri $createUrl -Headers $headers

@(
  "NETWORK_ID=$networkId"
  "NETWORK_NAME=$networkName"
  "NODE_ID=$nodeId"
  "CIDR=$cidr"
  "ASSIGNMENT_POOL=$rangeStart-$rangeEnd"
  ''
  'JOIN_RESULT:'
  $join
  ''
  'NETWORKS:'
  $networks
  ''
  'CONTROLLER_CONFIG:'
  ($networkJson | ConvertTo-Json -Depth 20)
  ''
  'FRIEND_STEPS:'
  "1. Install ZeroTier."
  "2. Join network: $networkId"
  "3. Send you their ZeroTier node ID."
  "4. Run zerotier_authorize_member.ps1 -NetworkId $networkId -MemberId <friend_node_id>"
) | Set-Content -LiteralPath $outPath -Encoding UTF8

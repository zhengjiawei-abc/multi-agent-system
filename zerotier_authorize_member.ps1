param(
  [Parameter(Mandatory = $true)]
  [string]$NetworkId,

  [Parameter(Mandatory = $true)]
  [string]$MemberId
)

$ErrorActionPreference = 'Stop'

if (-not ($NetworkId -match '^[0-9a-fA-F]{16}$')) {
  throw "NetworkId must be a 16-character ZeroTier network ID."
}

if (-not ($MemberId -match '^[0-9a-fA-F]{10}$')) {
  throw "MemberId must be a 10-character ZeroTier node ID."
}

$homeDir = 'C:\ProgramData\ZeroTier\One'
$tokenPath = Join-Path $homeDir 'authtoken.secret'
$outPath = 'D:\agent\zerotier_authorize_result.txt'

$token = (Get-Content -LiteralPath $tokenPath -Raw).Trim()
$headers = @{ 'X-ZT1-Auth' = $token }
$port = (Get-Content -LiteralPath (Join-Path $homeDir 'zerotier-one.port') -Raw).Trim()
$baseUrl = "http://127.0.0.1:$port"

$memberUrl = "$baseUrl/controller/network/$NetworkId/member/$MemberId"
$memberConfig = Invoke-RestMethod -Method Get -Uri $memberUrl -Headers $headers
$memberConfig.config.authorized = $true
$body = $memberConfig | ConvertTo-Json -Depth 20
$updated = Invoke-RestMethod -Method Post -Uri $memberUrl -Headers $headers -ContentType 'application/json' -Body $body

@(
  "AUTHORIZED_MEMBER=$MemberId"
  "NETWORK_ID=$NetworkId"
  ''
  ($updated | ConvertTo-Json -Depth 20)
) | Set-Content -LiteralPath $outPath -Encoding UTF8

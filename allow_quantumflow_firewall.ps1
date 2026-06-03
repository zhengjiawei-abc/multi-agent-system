$ErrorActionPreference = 'Stop'

$ruleName = 'QuantumFlow 8765'
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if (-not $existing) {
  New-NetFirewallRule `
    -DisplayName $ruleName `
    -Direction Inbound `
    -Action Allow `
    -Protocol TCP `
    -LocalPort 8765 `
    -Profile Any | Out-Null
}

Get-NetFirewallRule -DisplayName $ruleName |
  Select-Object DisplayName, Enabled, Direction, Action |
  Format-Table -AutoSize |
  Out-String |
  Set-Content -LiteralPath 'D:\agent\firewall_8765.txt' -Encoding UTF8

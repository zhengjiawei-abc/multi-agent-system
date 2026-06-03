param(
  [string]$PackageName = "QuantumFlow-Developer-Kit",
  [switch]$NoVenv,
  [switch]$NoZip
)

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$releaseRoot = Join-Path $root "release"
$packageRoot = Join-Path $releaseRoot $PackageName
$zipPath = Join-Path $releaseRoot "$PackageName.zip"

function Assert-UnderRoot {
  param([string]$PathToCheck, [string]$ExpectedParent)
  $parent = [System.IO.Path]::GetFullPath($ExpectedParent)
  $target = [System.IO.Path]::GetFullPath($PathToCheck)
  if (-not $target.StartsWith($parent, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to write outside release root: $target"
  }
}

function Copy-ItemSafe {
  param([string]$RelativePath)
  $source = Join-Path $root $RelativePath
  if (-not (Test-Path $source)) {
    Write-Warning "Skip missing: $RelativePath"
    return
  }
  $destination = Join-Path $packageRoot $RelativePath
  $destinationParent = Split-Path -Parent $destination
  New-Item -ItemType Directory -Force -Path $destinationParent | Out-Null
  Copy-Item -LiteralPath $source -Destination $destination -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $releaseRoot | Out-Null
Assert-UnderRoot -PathToCheck $packageRoot -ExpectedParent $releaseRoot
if (Test-Path $packageRoot) {
  Remove-Item -LiteralPath $packageRoot -Recurse -Force
}
New-Item -ItemType Directory -Force -Path $packageRoot | Out-Null

$paths = @(
  "Agent.py",
  "connectors.py",
  "connector_sender.py",
  "desktop.config.json",
  "health_check.py",
  "install_desktop_shortcut.bat",
  "install_desktop_shortcut.ps1",
  "launch_desktop_hidden.vbs",
  "LLM.py",
  "Model.py",
  "patch_service.py",
  "RAG.py",
  "README.md",
  "requirements.txt",
  "server.py",
  "start_desktop.bat",
  "start_desktop.ps1",
  "start_server.bat",
  "start_server.ps1",
  "storage.py",
  "ws_check.py",
  "assets",
  "desktop-electron",
  "quantumflow-mvp",
  "scripts"
)

foreach ($path in $paths) {
  Copy-ItemSafe $path
}

if (-not $NoVenv) {
  Copy-ItemSafe ".venv"
}

@"
{
  "feishu_webhook_url": "",
  "wecom_webhook_url": ""
}
"@ | Set-Content -Path (Join-Path $packageRoot "connector.config.json") -Encoding UTF8

@"
# QuantumFlow Developer Kit

This package is a portable developer build. It includes the QuantumFlow source,
the Electron desktop runtime, and the Python environment when built with the
default options.

## Run

1. Extract the zip to a writable folder, for example `D:\QuantumFlow`.
2. Double-click `start_desktop.bat`.
3. Optional: run `install_desktop_shortcut.bat` to create a desktop shortcut.

## Develop

- Frontend: `quantumflow-mvp\app.js`, `quantumflow-mvp\styles.css`, `quantumflow-mvp\index.html`
- Backend: `server.py`, `storage.py`, `Agent.py`
- Desktop shell: `desktop-electron\main.js`, `desktop-electron\preload.js`

The desktop shortcut always points to `launch_desktop_hidden.vbs`, which resolves
paths relative to this extracted folder. Do not create shortcuts directly to a
developer-machine path such as `D:\agent\desktop-electron\node_modules\...`.

## Notes

- Runtime database and private connector settings are intentionally not copied.
- If `.venv` does not work after moving machines, delete `.venv` and run
  `start_desktop.bat`; the launcher will recreate it with `requirements.txt`
  when Python is installed.
"@ | Set-Content -Path (Join-Path $packageRoot "INSTALL_DEVELOPER.md") -Encoding UTF8

if (-not $NoZip) {
  if (Test-Path $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
  }
  Compress-Archive -Path (Join-Path $packageRoot "*") -DestinationPath $zipPath -Force
}

Write-Output "Package folder: $packageRoot"
if (-not $NoZip) {
  Write-Output "Package zip: $zipPath"
}

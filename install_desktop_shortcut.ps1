$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$iconPath = Join-Path $root "assets\quantumflow-icon.ico"
$launcher = Join-Path $root "launch_desktop_hidden.vbs"

if (-not (Test-Path $iconPath)) {
  & (Join-Path $root ".venv\Scripts\python.exe") (Join-Path $root "scripts\generate_icon.py")
}

$desktop = [Environment]::GetFolderPath("Desktop")
$shortcutPath = Join-Path $desktop "QuantumFlow Desktop.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "wscript.exe"
$shortcut.Arguments = "`"$launcher`""
$shortcut.WorkingDirectory = $root
$shortcut.IconLocation = $iconPath
$shortcut.WindowStyle = 1
$shortcut.Description = "Launch QuantumFlow Desktop"
$shortcut.Save()

Write-Output $shortcutPath

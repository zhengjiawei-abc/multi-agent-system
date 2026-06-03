Set shell = CreateObject("WScript.Shell")
root = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
cmd = "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & root & "\start_desktop.ps1"""
shell.Run cmd, 0, False

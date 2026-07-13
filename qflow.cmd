@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0qflow.ps1" %*

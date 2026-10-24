@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0reset-agent.ps1"
if errorlevel 1 (
  echo Reset failed.
  pause
  exit /b 1
)
pause

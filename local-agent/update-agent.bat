@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0update-agent.ps1"
if errorlevel 1 (
  echo UPDATE FAILED. See the error above.
  pause
  exit /b 1
)
pause

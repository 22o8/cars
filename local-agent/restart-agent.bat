@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0restart-agent.ps1"
if errorlevel 1 (
  pause
  exit /b 1
)
timeout /t 3 /nobreak >nul
pause

@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-agent.ps1"
if errorlevel 1 (
  echo.
  echo INSTALL FAILED. Read the error above.
  pause
  exit /b 1
)
pause

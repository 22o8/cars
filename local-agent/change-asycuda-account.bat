@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul
if not exist ".venv\Scripts\python.exe" (
  echo Agent environment was not found. Run install-agent.bat first.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" "change_asycuda_account.py"
if errorlevel 1 (
  echo.
  echo Account update failed.
  pause
  exit /b 1
)
echo.
pause

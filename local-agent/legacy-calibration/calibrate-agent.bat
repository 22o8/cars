@echo off
cd /d %~dp0
chcp 65001 >nul
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
title Tarabil ASYCUDA Calibration
if not exist .venv\Scripts\python.exe (
    echo Agent environment not found. Run install-agent.bat first.
    pause
    exit /b 1
)
.venv\Scripts\python.exe calibrate.py
if errorlevel 1 (
  echo.
  echo Calibration failed or was cancelled.
  pause
  exit /b 1
)
.venv\Scripts\python.exe check_calibration.py
if errorlevel 1 (
  echo.
  echo Calibration is incomplete. Do not start the agent yet.
  pause
  exit /b 1
)
call install-autostart.bat
call restart-agent.bat
echo.
echo Calibration saved and validated. Background agent restarted.
pause

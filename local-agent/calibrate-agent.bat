@echo off
cd /d %~dp0
if not exist .venv\Scripts\python.exe (
    echo Agent environment not found. Run install-agent.bat first.
    pause
    exit /b 1
)
.venv\Scripts\python.exe calibrate.py
if errorlevel 1 pause & exit /b 1
call install-autostart.bat
call restart-agent.bat
echo.
echo Calibration saved and background agent restarted.
pause

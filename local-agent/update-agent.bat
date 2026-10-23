@echo off
setlocal
cd /d "%~dp0"
.venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 exit /b 1
if not exist .venv32\Scripts\python.exe (
  "C:\Python312-32\python.exe" -m venv .venv32
  if errorlevel 1 exit /b 1
)
.venv32\Scripts\python.exe -m pip install -r requirements32.txt
if errorlevel 1 exit /b 1
.venv\Scripts\python.exe -X utf8 -m unittest -v test_navigation
if errorlevel 1 exit /b 1
echo Dependencies and tests complete. Restart the agent between jobs.
pause

@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Agent is not installed. Run install-agent.bat first.
  pause
  exit /b 1
)
echo Verifying mandatory ASYCUDA Agent core rules...
".venv\Scripts\python.exe" -X utf8 -m unittest -v test_navigation
if errorlevel 1 (
  echo.
  echo CORE VERIFICATION FAILED. Do not run production jobs.
  pause
  exit /b 1
)
echo.
echo CORE VERIFIED: Security Warning + review + fast navigation + production flow.
pause

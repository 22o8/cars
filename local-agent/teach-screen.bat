@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Main agent virtual environment is missing.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" -X utf8 teach_screen.py
pause

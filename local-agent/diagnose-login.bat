@echo off
setlocal
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" diagnose-login.py
) else (
  py diagnose-login.py
)
pause

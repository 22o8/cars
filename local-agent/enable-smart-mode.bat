@echo off
setlocal
cd /d %~dp0
chcp 65001 >nul
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
if not exist .venv\Scripts\python.exe (
  echo [ERROR] .venv not found. Run install-agent.bat first.
  pause
  exit /b 1
)
.venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 (
  echo [ERROR] Dependency installation failed.
  pause
  exit /b 1
)
.venv\Scripts\python.exe enable-smart-mode.py
pause

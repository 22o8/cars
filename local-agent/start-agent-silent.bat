@echo off
setlocal
chcp 65001 >nul
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
cd /d %~dp0
if not exist .venv\Scripts\python.exe exit /b 2
if not exist logs mkdir logs
:loop
.venv\Scripts\python.exe agent.py >> logs\agent.log 2>&1
set RC=%ERRORLEVEL%
if "%RC%"=="23" exit /b 0
timeout /t 5 /nobreak >nul
goto loop

@echo off
setlocal
cd /d "%~dp0"
.venv\Scripts\python.exe -X utf8 diagnostics.py
pause

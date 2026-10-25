@echo off
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" (".venv\Scripts\python.exe" check-asycuda-account.py) else (python check-asycuda-account.py)
pause

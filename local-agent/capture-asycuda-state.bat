@echo off
cd /d "%~dp0"
if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" capture-asycuda-state.py
) else (
  py -3 capture-asycuda-state.py
)
pause

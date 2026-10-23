@echo off
setlocal
cd /d %~dp0

echo ==========================================
echo Tarabil ASYCUDA Local Agent - Installer
echo ==========================================
echo.

py -3.12 --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python 3.12 64-bit is not installed.
    echo Install it first, then run this file again.
    echo You can use: winget install -e --id Python.Python.3.12
    echo.
    pause
    exit /b 1
)

if not exist .venv\Scripts\python.exe (
    echo Creating isolated Python 3.12 environment...
    py -3.12 -m venv .venv
    if errorlevel 1 pause & exit /b 1
)

echo Updating pip...
.venv\Scripts\python.exe -m pip install --upgrade pip setuptools wheel
if errorlevel 1 pause & exit /b 1

echo Installing agent requirements...
.venv\Scripts\python.exe -m pip install -r requirements.txt
if errorlevel 1 pause & exit /b 1

echo.
echo Dependencies installed successfully.
echo Starting credential setup...
.venv\Scripts\python.exe setup_credentials.py
pause

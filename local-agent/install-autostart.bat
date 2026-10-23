@echo off
setlocal
cd /d %~dp0
set "AGENT_VBS=%~dp0run-agent-hidden.vbs"
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "TarabilAsycudaAgent" /t REG_SZ /d "wscript.exe \"%AGENT_VBS%\"" /f >nul
if errorlevel 1 (
  echo [ERROR] Could not register Tarabil Agent for automatic startup.
  pause
  exit /b 1
)
echo Tarabil Agent will start automatically after Windows sign-in.
echo Starting it now...
start "" wscript.exe "%AGENT_VBS%"
timeout /t 2 /nobreak >nul
exit /b 0

@echo off
setlocal
cd /d %~dp0
powershell -NoProfile -ExecutionPolicy Bypass -Command "$target=[IO.Path]::GetFullPath('%~dp0agent.py'); Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -and $_.CommandLine -like ('*'+$target+'*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1
timeout /t 1 /nobreak >nul
start "" wscript.exe "%~dp0run-agent-hidden.vbs"
echo Tarabil Agent restarted in background.
timeout /t 2 /nobreak >nul
exit /b 0

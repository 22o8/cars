@echo off
setlocal
cd /d "%~dp0"
echo For a safe restart, stop the running agent between jobs first.
echo This launcher will not forcibly terminate an active job.
start "" wscript.exe "%~dp0run-agent-hidden.vbs"
pause

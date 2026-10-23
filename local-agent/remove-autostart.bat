@echo off
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "TarabilAsycudaAgent" /f >nul 2>&1
echo Tarabil Agent automatic startup removed.
pause

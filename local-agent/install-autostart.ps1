$ErrorActionPreference = 'Stop'
$agentRoot = (Resolve-Path $PSScriptRoot).Path
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$pythonw = Join-Path $agentRoot '.venv\Scripts\pythonw.exe'
$watchdog = Join-Path $agentRoot 'watchdog.py'
if(!(Test-Path $pythonw)){ throw 'Agent environment is missing. Run install-agent.bat first.' }
if(!(Test-Path (Join-Path $agentRoot 'config.json'))){ throw 'config.json is missing. Run install-agent.bat first.' }
Remove-Item (Join-Path $agentRoot 'STOP_AGENT') -Force -ErrorAction SilentlyContinue

try { Stop-ScheduledTask -TaskName 'TarabilAsycudaAgent' -ErrorAction SilentlyContinue } catch {}
$action = New-ScheduledTaskAction -Execute $pythonw -Argument ('"' + $watchdog + '"') -WorkingDirectory $agentRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $identity
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'TarabilAsycudaAgent' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
Remove-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name TarabilAsycudaAgent -ErrorAction SilentlyContinue
Start-ScheduledTask -TaskName 'TarabilAsycudaAgent'
Write-Output 'Autostart installed. The Agent will start automatically after every Windows sign-in.'

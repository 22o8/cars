$ErrorActionPreference = 'Stop'
$agentRoot = $PSScriptRoot
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute "$agentRoot\.venv\Scripts\pythonw.exe" -Argument ('"' + "$agentRoot\watchdog.py" + '"') -WorkingDirectory $agentRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $identity
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'TarabilAsycudaAgent' -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
# Remove only our legacy registration after the scheduled task succeeds.
Remove-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name TarabilAsycudaAgent -ErrorAction SilentlyContinue
Start-ScheduledTask -TaskName 'TarabilAsycudaAgent'
Write-Output 'Tarabil scheduled task installed for interactive Windows login.'

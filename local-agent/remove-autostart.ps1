$ErrorActionPreference = 'Stop'
Unregister-ScheduledTask -TaskName 'TarabilAsycudaAgent' -Confirm:$false -ErrorAction SilentlyContinue
Remove-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name TarabilAsycudaAgent -ErrorAction SilentlyContinue
Write-Output 'Autostart removed. Existing agent is not terminated.'

$ErrorActionPreference='Stop'
$preferred='C:\asycuda-office-1'
$root=if(Test-Path $preferred){ (Resolve-Path $preferred).Path } else { (Resolve-Path $PSScriptRoot).Path }
Write-Host 'Tarabil ASYCUDA Agent - CLEAN RESET'
Write-Host "Root: $root"

# Stop autostart task first.
try { Stop-ScheduledTask -TaskName 'TarabilAsycudaAgent' -ErrorAction SilentlyContinue } catch {}
try { Unregister-ScheduledTask -TaskName 'TarabilAsycudaAgent' -Confirm:$false -ErrorAction SilentlyContinue } catch {}
Remove-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name TarabilAsycudaAgent -ErrorAction SilentlyContinue

# Ask the watchdog/agent to exit between jobs.
$stopFile=Join-Path $root 'STOP_AGENT'
New-Item -ItemType File -Path $stopFile -Force | Out-Null
Start-Sleep -Seconds 2

# Stop only Python processes belonging to this exact agent folder.
$escaped=[regex]::Escape($root)
Get-CimInstance Win32_Process | Where-Object {
  $_.CommandLine -and $_.CommandLine -match $escaped -and $_.CommandLine -match '(agent\.py|watchdog\.py|jab_helper\.py)'
} | ForEach-Object {
  try { Stop-Process -Id $_.ProcessId -Force -ErrorAction Stop } catch {}
}
Start-Sleep -Seconds 1

# Clear stored secrets before deleting the venv, when possible.
$resetPy=Join-Path $root '.venv\Scripts\python.exe'
if (Test-Path $resetPy) {
  try { & $resetPy (Join-Path $root 'reset_credentials.py') } catch {}
}

$targets=@(
  '.venv','.venv32','config.json','screen-memory.json','pending-result.json',
  'diagnostics','logs','screenshots','__pycache__','STOP_AGENT'
)
foreach($item in $targets){
  $path=Join-Path $root $item
  if(Test-Path $path){ Remove-Item $path -Recurse -Force -ErrorAction SilentlyContinue }
}
Write-Host 'Clean reset complete.'
Write-Host 'Now run install-agent.bat, then install-autostart.bat.'

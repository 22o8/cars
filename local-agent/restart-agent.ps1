$ErrorActionPreference='Stop'
$root=(Resolve-Path $PSScriptRoot).Path
$stopFile=Join-Path $root 'STOP_AGENT'
Write-Host 'Requesting a safe Tarabil Agent restart...'
New-Item -ItemType File -Path $stopFile -Force | Out-Null
try { Stop-ScheduledTask -TaskName 'TarabilAsycudaAgent' -ErrorAction SilentlyContinue } catch {}

$escaped=[regex]::Escape($root)
$deadline=(Get-Date).AddSeconds(20)
do {
  $running=Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -and $_.CommandLine -match $escaped -and $_.CommandLine -match '(agent\.py|watchdog\.py|jab_helper\.py)'
  }
  if(!$running){ break }
  Start-Sleep -Milliseconds 500
} while((Get-Date) -lt $deadline)

if($running){
  Write-Error 'Agent is still executing a job. Stop/cancel the active job first, then run restart-agent.bat again.'
  exit 2
}
Remove-Item $stopFile -Force -ErrorAction SilentlyContinue

$task=Get-ScheduledTask -TaskName 'TarabilAsycudaAgent' -ErrorAction SilentlyContinue
if($task){
  Start-ScheduledTask -TaskName 'TarabilAsycudaAgent'
  Write-Host 'Agent restarted through Task Scheduler.'
}else{
  Start-Process -FilePath 'wscript.exe' -ArgumentList ('"' + (Join-Path $root 'run-agent-hidden.vbs') + '"')
  Write-Host 'Agent restarted in hidden mode. Run install-autostart.bat to enable automatic startup.'
}

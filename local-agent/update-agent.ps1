$ErrorActionPreference='Stop'
$root=(Resolve-Path $PSScriptRoot).Path
$py=Join-Path $root '.venv\Scripts\python.exe'
$py32=Join-Path $root '.venv32\Scripts\python.exe'
if(!(Test-Path $py) -or !(Test-Path $py32) -or !(Test-Path (Join-Path $root 'config.json'))){
  throw 'This is not an installed Agent. Run install-agent.bat first.'
}
Write-Host 'Updating Tarabil ASYCUDA Agent dependencies...'
& $py -m pip install -r (Join-Path $root 'requirements.txt')
& $py32 -m pip install -r (Join-Path $root 'requirements32.txt')

$dlls=Get-ChildItem 'C:\Program Files (x86)\Java' -Recurse -Filter 'WindowsAccessBridge-32.dll' -ErrorAction SilentlyContinue | Sort-Object FullName -Descending
if($dlls){
  $jabBin=Split-Path $dlls[0].FullName -Parent
  $jabswitch=Join-Path $jabBin 'jabswitch.exe'
  if(Test-Path $jabswitch){ & $jabswitch -enable }
  [Environment]::SetEnvironmentVariable('JAB_HOME',$jabBin,'User')
}
& $py -X utf8 -m unittest -v test_navigation
if($LASTEXITCODE -ne 0){ throw 'Tests failed. The running Agent was not restarted.' }
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $root 'restart-agent.ps1')
if($LASTEXITCODE -ne 0){ exit $LASTEXITCODE }
Write-Host 'Update installed and Agent restarted.'

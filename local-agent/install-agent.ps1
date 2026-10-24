$ErrorActionPreference='Stop'
$root=(Resolve-Path $PSScriptRoot).Path
Set-Location $root
Write-Host '=== Tarabil ASYCUDA Agent Clean Installer ==='

function Get-Bitness([string]$python){
  if(!(Test-Path $python)){ return 0 }
  try { return [int](& $python -c "import struct; print(struct.calcsize('P')*8)" 2>$null) } catch { return 0 }
}

# Main 64-bit Python: deliberately use 3.12 because the project dependencies have stable Windows wheels there.
$py64=''
try {
  $candidate=(& py -3.12 -c "import sys; print(sys.executable)" 2>$null | Select-Object -First 1).Trim()
  if((Get-Bitness $candidate) -eq 64){ $py64=$candidate }
} catch {}
if(!$py64){
  $candidate="$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"
  if((Get-Bitness $candidate) -eq 64){ $py64=$candidate }
}
if(!$py64){ throw 'Python 3.12 64-bit was not found. Install Python 3.12 x64 first.' }
Write-Host "Main Python: $py64 (64-bit)"

$venv=Join-Path $root '.venv'
if(!(Test-Path (Join-Path $venv 'Scripts\python.exe'))){ & $py64 -m venv $venv; if($LASTEXITCODE -ne 0){ throw 'Failed to create the 64-bit virtual environment.' } }
$venvPy=Join-Path $venv 'Scripts\python.exe'
& $venvPy -m pip install --upgrade pip
if($LASTEXITCODE -ne 0){ throw 'Failed to upgrade pip in .venv.' }
& $venvPy -m pip install -r (Join-Path $root 'requirements.txt')
if($LASTEXITCODE -ne 0){ throw 'Failed to install main Agent dependencies.' }

# Discover any working 32-bit Python. The user's current machine has C:\Python312-32\python.exe.
$candidates=@(
  'C:\Python312-32\python.exe',
  'C:\Python313-32\python.exe',
  'C:\Python311-32\python.exe'
)
$candidates += Get-ChildItem 'C:\Python*32\python.exe' -ErrorAction SilentlyContinue | ForEach-Object FullName
$candidates += Get-ChildItem 'C:\Program Files (x86)\Python*\python.exe' -ErrorAction SilentlyContinue | ForEach-Object FullName
$py32=$null
foreach($candidate in ($candidates | Select-Object -Unique)){
  if((Get-Bitness $candidate) -eq 32){ $py32=$candidate; break }
}
if(!$py32){ throw 'A 32-bit Python runtime was not found. Install a 32-bit Python and place it at C:\Python312-32\python.exe.' }
Write-Host "JAB Python: $py32 (32-bit)"

$venv32=Join-Path $root '.venv32'
if(!(Test-Path (Join-Path $venv32 'Scripts\python.exe'))){ & $py32 -m venv $venv32; if($LASTEXITCODE -ne 0){ throw 'Failed to create the 32-bit JAB virtual environment.' } }
$venv32Py=Join-Path $venv32 'Scripts\python.exe'
& $venv32Py -m pip install --upgrade pip
if($LASTEXITCODE -ne 0){ throw 'Failed to upgrade pip in .venv32.' }
& $venv32Py -m pip install -r (Join-Path $root 'requirements32.txt')
if($LASTEXITCODE -ne 0){ throw 'Failed to install Java Access Bridge helper dependencies.' }

# Discover and enable the same 32-bit Java Access Bridge used by ASYCUDA.
$dlls=Get-ChildItem 'C:\Program Files (x86)\Java' -Recurse -Filter 'WindowsAccessBridge-32.dll' -ErrorAction SilentlyContinue | Sort-Object FullName -Descending
if(!$dlls){ throw 'WindowsAccessBridge-32.dll was not found under C:\Program Files (x86)\Java.' }
$jabDll=$dlls[0].FullName
$jabBin=Split-Path $jabDll -Parent
$jabswitch=Join-Path $jabBin 'jabswitch.exe'
if(Test-Path $jabswitch){ & $jabswitch -enable }
[Environment]::SetEnvironmentVariable('JAB_HOME',$jabBin,'User')
$env:JAB_HOME=$jabBin
Write-Host "Java Access Bridge: $jabDll"

# Validate Python code before asking for secrets.
& $venvPy -X utf8 -m unittest -v test_navigation
if($LASTEXITCODE -ne 0){ throw 'Navigation tests failed.' }

# Always ask for fresh local credentials on an installation.
& $venvPy -X utf8 (Join-Path $root 'setup_credentials.py')
if($LASTEXITCODE -ne 0){ throw 'Credential setup failed.' }

Remove-Item (Join-Path $root 'STOP_AGENT') -Force -ErrorAction SilentlyContinue
Write-Host ''
Write-Host 'INSTALL COMPLETE.'
Write-Host 'Next run: install-autostart.bat'

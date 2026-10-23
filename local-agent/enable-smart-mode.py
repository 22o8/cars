from __future__ import annotations
import os
import shutil
import subprocess
from pathlib import Path

print('=== Tarabil ASYCUDA Smart Mode Setup ===')
print('Enabling Java Access Bridge for the current Windows user...')

candidates=[]
which=shutil.which('jabswitch') or shutil.which('jabswitch.exe')
if which:
    candidates.append(Path(which))
for env in ('JAVA_HOME','JRE_HOME','JDK_HOME'):
    base=os.environ.get(env)
    if base:
        candidates += [Path(base)/'bin'/'jabswitch.exe', Path(base)/'jre'/'bin'/'jabswitch.exe']
for root in [Path(os.environ.get('ProgramFiles','C:/Program Files'))/'Java', Path(os.environ.get('ProgramFiles(x86)','C:/Program Files (x86)'))/'Java']:
    if root.exists():
        candidates += list(root.glob('*/bin/jabswitch.exe')) + list(root.glob('*/jre/bin/jabswitch.exe'))

used=None
for c in candidates:
    if c.exists():
        try:
            r=subprocess.run([str(c),'-enable'],capture_output=True,text=True,timeout=20)
            if r.returncode==0:
                used=c
                break
        except Exception:
            pass

if used:
    print(f'Java Access Bridge enabled using: {used}')
else:
    # pyjab can create the per-user accessibility properties on first use.
    print('jabswitch.exe was not found. pyjab will attempt per-user Java Access Bridge setup automatically.')

print()
print('IMPORTANT: Close ALL ASYCUDA / Java Web Start windows, then open ASYCUDA again.')
print('After reopening ASYCUDA, run inspect-asycuda.bat.')

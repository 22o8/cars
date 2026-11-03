from pathlib import Path
import getpass, json
import keyring
import pygetwindow as gw

SERVICE='TarabilCustomsAgent'
print('Windows user:', getpass.getuser())
u=keyring.get_password(SERVICE,'asycuda_username') or ''
p=keyring.get_password(SERVICE,'asycuda_password') or ''
print('ASYCUDA username saved:', 'YES' if u else 'NO', (('(' + u[:2] + '***' + u[-1:] + ')') if u else ''))
print('ASYCUDA password saved:', 'YES' if p else 'NO')
print('\nVisible ASYCUDA windows:')
found=0
for title in gw.getAllTitles():
    if title and 'asycudaworld production server' in title.casefold():
        for w in gw.getWindowsWithTitle(title):
            found += 1
            try:
                print(f'- {title!r}  x={w.left} y={w.top} w={w.width} h={w.height}')
            except Exception as exc:
                print(f'- {title!r}  geometry-error={exc}')
if not found:
    print('- NONE')
print('\nExpected login candidate: visible ASYCUDA window with width 280..760 and height 190..520.')

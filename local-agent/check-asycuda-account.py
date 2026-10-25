import keyring
SERVICE='TarabilCustomsAgent'
u=keyring.get_password(SERVICE,'asycuda_username') or ''
p=keyring.get_password(SERVICE,'asycuda_password') or ''
print('Stored ASYCUDA account:')
print('Username: '+((u[:2]+'*'*max(0,len(u)-2)) if u else 'MISSING'))
print('Password: '+('SAVED' if p else 'MISSING'))
if not u or not p: raise SystemExit(2)

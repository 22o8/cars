import getpass
import keyring

SERVICE = 'TarabilCustomsAgent'

print('Tarabil ASYCUDA Agent - change ASYCUDA account')
current = keyring.get_password(SERVICE, 'asycuda_username') or ''
if current:
    masked = current[:2] + ('*' * max(0, len(current)-2))
    print('Current stored username: ' + masked)
username = input('New ASYCUDA username: ').strip()
password = getpass.getpass('New ASYCUDA password: ')
confirm = getpass.getpass('Confirm ASYCUDA password: ')
if not username:
    raise SystemExit('Username cannot be empty.')
if not password:
    raise SystemExit('Password cannot be empty.')
if password != confirm:
    raise SystemExit('Passwords do not match.')
keyring.set_password(SERVICE, 'asycuda_username', username)
keyring.set_password(SERVICE, 'asycuda_password', password)
print('ASYCUDA account updated successfully.')
print('Run restart-agent.bat before the next test.')

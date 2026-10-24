import json, getpass
from pathlib import Path
import keyring

BASE = Path(__file__).resolve().parent
SERVICE = 'TarabilCustomsAgent'
CONFIG = BASE / 'config.json'
EXAMPLE = BASE / 'config.example.json'
cfg = json.loads((CONFIG if CONFIG.exists() else EXAMPLE).read_text(encoding='utf-8'))

print('Tarabil ASYCUDA Agent - local credentials setup')
server = input(f'Vercel system URL [{cfg.get("cloud",{}).get("server_url","")}]: ').strip()
if server:
    cfg['cloud']['server_url'] = server.rstrip('/')
device_id = input(f'Device ID [{cfg.get("cloud",{}).get("device_id","asycuda-office-1")}]: ').strip()
if device_id:
    cfg['cloud']['device_id'] = device_id

device_token = getpass.getpass('TARABIL_AGENT_DEVICE_TOKEN (same value as Vercel): ').strip()
if device_token:
    keyring.set_password(SERVICE, 'agent_device_token', device_token)

username = input('ASYCUDA username: ').strip()
password = getpass.getpass('ASYCUDA password: ')
if not username or not password:
    raise SystemExit('ASYCUDA username/password cannot be empty.')
keyring.set_password(SERVICE, 'asycuda_username', username)
keyring.set_password(SERVICE, 'asycuda_password', password)

wa = input('Enable WhatsApp Cloud API now? (y/n) [n]: ').strip().lower() == 'y'
cfg.setdefault('whatsapp', {})['enabled'] = bool(wa)
if wa:
    token = getpass.getpass('WhatsApp Access Token: ')
    phone_id = input('WhatsApp Phone Number ID: ').strip()
    graph_version = input('Graph API version (example vXX.X): ').strip()
    keyring.set_password(SERVICE, 'whatsapp_access_token', token)
    keyring.set_password(SERVICE, 'whatsapp_phone_number_id', phone_id)
    cfg['whatsapp']['graph_version'] = graph_version

CONFIG.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding='utf-8')
print('Configuration saved successfully.')
print('Next: run install-autostart.bat, then restart-agent.bat.')

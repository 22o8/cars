import json, getpass
from pathlib import Path
import keyring

BASE = Path(__file__).resolve().parent
SERVICE = 'TarabilCustomsAgent'
CONFIG = BASE / 'config.json'
EXAMPLE = BASE / 'config.example.json'
cfg = json.loads((CONFIG if CONFIG.exists() else EXAMPLE).read_text(encoding='utf-8'))

print('إعداد جهاز ASYCUDA — طريبيل')
server = input(f'رابط النظام على Vercel [{cfg.get("cloud",{}).get("server_url","")}]: ').strip()
if server: cfg['cloud']['server_url'] = server.rstrip('/')
device_id = input(f'اسم الجهاز [{cfg.get("cloud",{}).get("device_id","asycuda-office-1")}]: ').strip()
if device_id: cfg['cloud']['device_id'] = device_id
device_token = getpass.getpass('TARABIL_AGENT_DEVICE_TOKEN (نفس القيمة الموجودة في Vercel): ').strip()
if device_token: keyring.set_password(SERVICE, 'agent_device_token', device_token)

username = input('اسم مستخدم ASYCUDA: ').strip()
password = getpass.getpass('كلمة مرور ASYCUDA: ')
keyring.set_password(SERVICE, 'asycuda_username', username)
keyring.set_password(SERVICE, 'asycuda_password', password)

wa = input('هل تريد تفعيل إرسال WhatsApp Cloud API الآن؟ (y/n): ').strip().lower() == 'y'
if wa:
    token = getpass.getpass('WhatsApp Access Token: ')
    phone_id = input('WhatsApp Phone Number ID: ').strip()
    graph_version = input('Graph API version (مثال vXX.X): ').strip()
    keyring.set_password(SERVICE, 'whatsapp_access_token', token)
    keyring.set_password(SERVICE, 'whatsapp_phone_number_id', phone_id)
    cfg['whatsapp']['enabled'] = True
    cfg['whatsapp']['graph_version'] = graph_version

CONFIG.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding='utf-8')
print('\nتم الحفظ. الآن شغّل calibrate.py ثم start-agent.bat.')

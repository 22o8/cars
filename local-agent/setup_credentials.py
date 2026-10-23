import json, secrets, getpass
from pathlib import Path
import keyring

BASE = Path(__file__).resolve().parent
SERVICE = 'TarabilCustomsAgent'
CONFIG = BASE / 'config.json'
EXAMPLE = BASE / 'config.example.json'

if CONFIG.exists():
    cfg = json.loads(CONFIG.read_text(encoding='utf-8'))
else:
    cfg = json.loads(EXAMPLE.read_text(encoding='utf-8'))

print('إعداد برنامج تحكم طريبيل المحلي')
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

cfg['agent_key'] = secrets.token_urlsafe(32)
CONFIG.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding='utf-8')
print('\nتم حفظ بيانات الدخول داخل Windows Credential Manager.')
print('مفتاح الربط المحلي — انسخه إلى صفحة رقم الإجراء الموحد في النظام:')
print(cfg['agent_key'])
print('\nالخطوة التالية: شغّل calibrate.py لضبط مواقع الأزرار على شاشتك.')

import json
from pathlib import Path
import pyautogui

BASE = Path(__file__).resolve().parent
CONFIG = BASE / 'config.json'
EXAMPLE = BASE / 'config.example.json'

if CONFIG.exists():
    cfg = json.loads(CONFIG.read_text(encoding='utf-8'))
else:
    cfg = json.loads(EXAMPLE.read_text(encoding='utf-8'))

asy = cfg['asycuda']

def capture(label):
    input(f'\nضع مؤشر الماوس فوق {label} ثم اضغط Enter... ')
    p = pyautogui.position()
    print(f'تم: {p.x}, {p.y}')
    return [p.x, p.y]

print('افتح ASYCUDA وخلي نافذة تسجيل الدخول ظاهرة أولاً.')
asy['login_username'] = capture('خانة اسم المستخدم')
asy['login_password'] = capture('خانة كلمة المرور')
asy['login_button'] = capture('زر تسجيل الدخول')

print('\nسجّل الدخول يدوياً الآن وافتح الشاشة الرئيسية.')
count = int(input('كم نقرة تحتاج حتى تصل إلى شاشة «رقم الإجراء الموحد»؟ '))
asy['unified_menu_clicks'] = []
for i in range(count):
    asy['unified_menu_clicks'].append(capture(f'النقرة رقم {i+1} للوصول إلى رقم الإجراء الموحد'))

asy['company_code_field'] = capture('خانة رمز الشركة داخل رقم الإجراء الموحد')
asy['submit_button'] = capture('زر الإرسال/التنفيذ لإنشاء رقم الإجراء')
can_copy = input('هل رقم الإجراء الناتج يظهر داخل خانة يمكن تحديدها ونسخها؟ (y/n): ').strip().lower() == 'y'
asy['result_number_field'] = capture('خانة رقم الإجراء الناتج') if can_copy else None

use_region = input('\nهل تريد لقطة لمنطقة محددة بدلاً من كامل الشاشة؟ (y/n): ').strip().lower() == 'y'
if use_region:
    print('سنحفظ مستطيلاً: أعلى-يسار ثم أسفل-يمين.')
    p1 = capture('الزاوية العلوية اليسرى لمنطقة النتيجة')
    p2 = capture('الزاوية السفلية اليمنى لمنطقة النتيجة')
    asy['screenshot_region'] = [p1[0], p1[1], max(1,p2[0]-p1[0]), max(1,p2[1]-p1[1])]
else:
    asy['screenshot_region'] = None

CONFIG.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding='utf-8')
print('\nتم حفظ المعايرة في config.json.')

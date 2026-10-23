import json
import time
from pathlib import Path
import pyautogui

BASE = Path(__file__).resolve().parent
CONFIG = BASE / 'config.json'
EXAMPLE = BASE / 'config.example.json'

if CONFIG.exists():
    cfg = json.loads(CONFIG.read_text(encoding='utf-8'))
else:
    cfg = json.loads(EXAMPLE.read_text(encoding='utf-8'))

cfg.setdefault('asycuda', {})
asy = cfg['asycuda']


def save():
    CONFIG.write_text(json.dumps(cfg, ensure_ascii=False, indent=2), encoding='utf-8')


def capture(label, click_after=False, wait=1.4):
    input(f'\nMove mouse to: {label}\nThen press ENTER... ')
    p = pyautogui.position()
    point = [p.x, p.y]
    print(f'Saved position: {p.x}, {p.y}')
    if click_after:
        pyautogui.click(p.x, p.y)
        time.sleep(wait)
    return point


def ask_int(prompt, minimum=1):
    while True:
        raw = input(prompt).strip()
        if not raw:
            print('Please enter a number. Example: 3')
            continue
        try:
            value = int(raw)
        except ValueError:
            print('Invalid value. Enter numbers only.')
            continue
        if value < minimum:
            print(f'Value must be {minimum} or greater.')
            continue
        return value


def ask_yes_no(prompt, default=False):
    suffix = ' [y/N]: ' if not default else ' [Y/n]: '
    while True:
        raw = input(prompt + suffix).strip().lower()
        if not raw:
            return default
        if raw in ('y', 'yes'):
            return True
        if raw in ('n', 'no'):
            return False
        print('Please type y or n.')


print('=== Tarabil ASYCUDA Calibration 2.6 ===')
print('This calibration DOES NOT create a unified procedure.')
print('It only saves screen positions used by the local agent.')
print()
print('Choose calibration mode:')
print('1) TEST ONLY  - login + navigate to Unified Procedure page')
print('2) FULL       - test mode + company field + submit button + result field')
mode = input('Mode [1]: ').strip() or '1'
while mode not in ('1', '2'):
    print('Please enter 1 or 2.')
    mode = input('Mode [1]: ').strip() or '1'
full = mode == '2'

print('\nSTEP 1 OF 3 - Login screen calibration')
print('Open ASYCUDA and keep the LOGIN window visible and stationary.')
asy['login_username'] = capture('CENTER of USERNAME field')
asy['login_password'] = capture('CENTER of PASSWORD field')
asy['login_button'] = capture('LOGIN button')
save()

print('\nSTEP 2 OF 3 - Unified Procedure navigation')
print('Log in to ASYCUDA MANUALLY now.')
print('Wait until the main ASYCUDA desktop is fully loaded.')
input('When the MAIN ASYCUDA screen is ready, press ENTER here... ')

print('\nNow we will record the clicks needed to open the Unified Procedure page.')
print('IMPORTANT: Start from the normal ASYCUDA main screen.')
print('For every step: move the mouse to the next button/menu item and press ENTER.')
print('The calibration tool will CLICK that position for you, then wait for the next screen/menu.')
count = ask_int('How many clicks are needed to reach the Unified Procedure page? ')

asy['unified_menu_clicks'] = []
step_wait = float(asy.get('menu_step_wait_seconds', 1.6))
for i in range(count):
    point = capture(f'NAVIGATION CLICK {i+1} of {count}', click_after=True, wait=step_wait)
    asy['unified_menu_clicks'].append(point)
    save()

print('\nWaiting for the Unified Procedure page to finish loading...')
time.sleep(float(asy.get('unified_ready_wait_seconds', 4.0)))
input('If the Unified Procedure page is fully visible now, press ENTER... ')
asy['test_navigation_calibrated'] = True

if full:
    print('\nSTEP 3 OF 3 - Real execution fields')
    print('Calibration will NOT click the real submit/create button.')
    asy['company_code_field'] = capture('COMPANY CODE field')
    asy['submit_button'] = capture('CREATE / SUBMIT Unified Procedure button')
    can_copy = ask_yes_no('Can the generated procedure number be selected/copied from a field?')
    asy['result_number_field'] = capture('GENERATED PROCEDURE NUMBER field') if can_copy else None
else:
    print('\nSTEP 3 OF 3 - Skipped')
    print('TEST button will work. Real procedure creation remains disabled until FULL calibration is completed.')

use_region = ask_yes_no('\nUse a specific screenshot region instead of the full screen?')
if use_region:
    print('Select screenshot region: TOP-LEFT first, then BOTTOM-RIGHT.')
    p1 = capture('TOP-LEFT corner of screenshot region')
    p2 = capture('BOTTOM-RIGHT corner of screenshot region')
    asy['screenshot_region'] = [
        p1[0], p1[1], max(1, p2[0] - p1[0]), max(1, p2[1] - p1[1])
    ]
else:
    asy['screenshot_region'] = None

save()
print('\n=== CALIBRATION SAVED SUCCESSFULLY ===')
print('Saved to config.json')
print('Next: run check-calibration.bat, then restart-agent.bat.')

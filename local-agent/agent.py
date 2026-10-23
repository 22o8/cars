from __future__ import annotations
import io
import json
import os
import subprocess
import time
from pathlib import Path

import keyring
import pyautogui
import pygetwindow as gw
import pyperclip
import requests

BASE = Path(__file__).resolve().parent
CONFIG_PATH = BASE / 'config.json'
SCREENSHOTS = BASE / 'screenshots'
SERVICE = 'TarabilCustomsAgent'
VERSION = '2.0.0-cloud'

if not CONFIG_PATH.exists():
    raise SystemExit('config.json غير موجود. شغّل setup_credentials.py ثم calibrate.py أولاً.')

CFG = json.loads(CONFIG_PATH.read_text(encoding='utf-8'))
SCREENSHOTS.mkdir(exist_ok=True)
pyautogui.FAILSAFE = True


def secret(name: str) -> str:
    return keyring.get_password(SERVICE, name) or ''


def paste_text(value: str):
    pyperclip.copy(str(value))
    pyautogui.hotkey('ctrl', 'a')
    pyautogui.hotkey('ctrl', 'v')


def click_point(p, pause=.35):
    if not p or len(p) != 2 or (int(p[0]) == 0 and int(p[1]) == 0):
        raise RuntimeError('برنامج التحكم غير معاير بالكامل. شغّل calibrate.py.')
    pyautogui.click(int(p[0]), int(p[1]))
    time.sleep(pause)


def find_asycuda_window():
    titles = CFG['asycuda'].get('window_title_contains', [])
    for title in gw.getAllTitles():
        if title and any(x.lower() in title.lower() for x in titles):
            wins = gw.getWindowsWithTitle(title)
            if wins:
                return wins[0]
    return None


def launch_asycuda():
    asy = CFG['asycuda']
    win = find_asycuda_window()
    if win:
        try:
            if win.isMinimized:
                win.restore()
            win.activate()
        except Exception:
            pass
        return False
    jnlp = asy.get('jnlp_path', '')
    if jnlp and not os.path.isabs(jnlp):
        jnlp = str((BASE / jnlp).resolve())
    launcher = asy.get('launcher_path', '')
    if not jnlp or not Path(jnlp).exists():
        raise RuntimeError('مسار AWIQWorld.jnlp غير صحيح في config.json.')
    if launcher:
        subprocess.Popen([launcher, jnlp], close_fds=True)
    else:
        os.startfile(jnlp)
    time.sleep(float(asy.get('launch_wait_seconds', 18)))
    return True


def login_if_needed(was_launched: bool):
    if not was_launched:
        return
    username = secret('asycuda_username')
    password = secret('asycuda_password')
    if not username or not password:
        raise RuntimeError('بيانات ASYCUDA غير موجودة في Windows Credential Manager.')
    asy = CFG['asycuda']
    click_point(asy['login_username']); paste_text(username)
    click_point(asy['login_password']); paste_text(password)
    click_point(asy['login_button'])
    time.sleep(float(asy.get('after_login_wait_seconds', 12)))


def create_unified(company_code: str):
    asy = CFG['asycuda']
    launched = launch_asycuda()
    login_if_needed(launched)
    for p in asy.get('unified_menu_clicks', []):
        click_point(p, .6)
    click_point(asy['company_code_field'])
    paste_text(company_code)
    click_point(asy['submit_button'])
    time.sleep(float(asy.get('after_submit_wait_seconds', 5)))


def read_result_number():
    p = CFG['asycuda'].get('result_number_field')
    if not p:
        return ''
    try:
        click_point(p)
        pyautogui.hotkey('ctrl','a'); pyautogui.hotkey('ctrl','c')
        time.sleep(.2)
        value = (pyperclip.paste() or '').strip()
        digits = ''.join(ch for ch in value if ch.isdigit())
        return digits if 6 <= len(digits) <= 30 else value[:80]
    except Exception:
        return ''


def take_screenshot(serial: str):
    region = CFG['asycuda'].get('screenshot_region')
    img = pyautogui.screenshot(region=tuple(region) if region else None)
    safe = ''.join(c for c in serial if c.isalnum() or c in '-_') or 'unified'
    path = SCREENSHOTS / f'{time.strftime("%Y%m%d-%H%M%S")}-{safe}.png'
    img.save(path)
    return path


def send_whatsapp(path: Path, to: str, serial: str, company_name: str, result_no: str) -> bool:
    wa = CFG.get('whatsapp', {})
    if not wa.get('enabled'):
        return False
    version = (wa.get('graph_version') or '').strip()
    token = secret('whatsapp_access_token')
    phone_id = secret('whatsapp_phone_number_id')
    if not version or not token or not phone_id:
        raise RuntimeError('إعداد WhatsApp Cloud API غير مكتمل.')
    to = ''.join(ch for ch in to if ch.isdigit())
    if not to:
        raise RuntimeError('رقم واتساب غير صالح.')
    base = f'https://graph.facebook.com/{version}/{phone_id}'
    with path.open('rb') as f:
        up = requests.post(f'{base}/media', headers={'Authorization': f'Bearer {token}'}, data={'messaging_product':'whatsapp'}, files={'file':('unified.png', f, 'image/png')}, timeout=30)
    up.raise_for_status()
    media_id = up.json()['id']
    caption_tpl = wa.get('caption') or 'رقم الإجراء الموحد: {procedureNo} - {serial} - {companyName}'
    caption = caption_tpl.format(procedureNo=result_no or 'راجع الصورة', serial=serial, companyName=company_name)
    msg = requests.post(f'{base}/messages', headers={'Authorization': f'Bearer {token}', 'Content-Type':'application/json'}, json={
        'messaging_product':'whatsapp','to':to,'type':'image','image':{'id':media_id,'caption':caption}
    }, timeout=30)
    msg.raise_for_status()
    return True


def run_job(job: dict):
    code = str(job.get('companyCode', '')).strip()
    if not code:
        raise RuntimeError('رمز الشركة فارغ.')
    serial = str(job.get('serial', '')).strip()
    company = str(job.get('companyName', '')).strip()
    phone = str(job.get('whatsappNumber', '')).strip()
    create_unified(code)
    result_number = read_result_number()
    path = take_screenshot(serial or code)
    sent = send_whatsapp(path, phone, serial, company, result_number) if phone else False
    return {'unifiedProcedureNo': result_number, 'whatsappSent': sent, 'screenshotPath': str(path)}


def cloud_headers():
    token = secret('agent_device_token')
    cloud = CFG.get('cloud', {})
    device_id = cloud.get('device_id', '')
    if not token or not device_id:
        raise RuntimeError('بيانات ربط الجهاز بالسيرفر غير مكتملة. شغّل setup_credentials.py.')
    return {'Authorization': f'Bearer {token}', 'X-Tarabil-Device-Id': device_id}


def api_url(path: str):
    base = str(CFG.get('cloud', {}).get('server_url', '')).rstrip('/')
    if not base.startswith('http'):
        raise RuntimeError('server_url غير مضبوط في config.json.')
    return base + path


def complete_job(job_id: str, ok: bool, result=None, error=''):
    payload = {'id': job_id, 'ok': ok, 'error': error}
    if result:
        payload.update({'unifiedProcedureNo': result.get('unifiedProcedureNo',''), 'whatsappSent': bool(result.get('whatsappSent'))})
    r = requests.post(api_url('/api/agent/complete'), headers=cloud_headers(), json=payload, timeout=25)
    r.raise_for_status()


def main():
    poll = max(2, int(CFG.get('cloud', {}).get('poll_seconds', 3)))
    print(f'Tarabil Cloud Agent {VERSION}')
    print('الجهاز جاهز لاستلام طلبات رقم الإجراء الموحد من الهاتف.')
    while True:
        try:
            r = requests.get(api_url('/api/agent/next'), headers=cloud_headers(), timeout=25)
            r.raise_for_status()
            payload = r.json()
            job = payload.get('job')
            if not job:
                time.sleep(poll)
                continue
            jid = str(job.get('id'))
            print(f'[{time.strftime("%H:%M:%S")}] تنفيذ {jid} للشركة {job.get("companyCode")}')
            try:
                result = run_job(job)
                complete_job(jid, True, result=result)
                print(f'تم ✓ رقم الإجراء: {result.get("unifiedProcedureNo") or "غير مقروء تلقائياً"}')
            except Exception as e:
                complete_job(jid, False, error=str(e)[:500])
                print(f'فشل: {e}')
        except KeyboardInterrupt:
            break
        except Exception as e:
            print(f'اتصال السيرفر: {e}')
            time.sleep(max(poll, 5))


if __name__ == '__main__':
    main()

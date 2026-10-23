from __future__ import annotations
import base64
import io
import json
import os
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
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
VERSION = '1.0.0'
JOB_LOCK = threading.Lock()

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
        if not title:
            continue
        if any(x.lower() in title.lower() for x in titles):
            wins = gw.getWindowsWithTitle(title)
            if wins:
                return wins[0]
    return None


def launch_asycuda():
    asy = CFG['asycuda']
    win = find_asycuda_window()
    if win:
        try:
            if win.isMinimized: win.restore()
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
        os.startfile(jnlp)  # Windows only
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
        pyautogui.hotkey('ctrl','a')
        pyautogui.hotkey('ctrl','c')
        time.sleep(.2)
        value = (pyperclip.paste() or '').strip()
        return value if len(value) <= 80 else ''
    except Exception:
        return ''


def take_screenshot(serial: str):
    region = CFG['asycuda'].get('screenshot_region')
    img = pyautogui.screenshot(region=tuple(region) if region else None)
    safe = ''.join(c for c in serial if c.isalnum() or c in '-_') or 'transaction'
    path = SCREENSHOTS / f'{time.strftime("%Y%m%d-%H%M%S")}-{safe}.png'
    img.save(path)
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    return path, base64.b64encode(buf.getvalue()).decode('ascii')


def send_whatsapp(path: Path, to: str, serial: str, company_name: str) -> bool:
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
    caption = (wa.get('caption') or 'رقم الإجراء الموحد - {serial} - {companyName}').format(serial=serial, companyName=company_name)
    msg = requests.post(f'{base}/messages', headers={'Authorization': f'Bearer {token}', 'Content-Type':'application/json'}, json={
        'messaging_product':'whatsapp','to':to,'type':'image','image':{'id':media_id,'caption':caption}
    }, timeout=30)
    msg.raise_for_status()
    return True


def run_job(payload):
    code = str(payload.get('companyCode', '')).strip()
    if not code:
        raise RuntimeError('رمز الشركة فارغ.')
    serial = str(payload.get('serial', '')).strip()
    company = str(payload.get('companyName', '')).strip()
    phone = str(payload.get('whatsappNumber', '')).strip()
    create_unified(code)
    result_number = read_result_number()
    path, b64 = take_screenshot(serial)
    sent = send_whatsapp(path, phone, serial, company) if phone else False
    return {'ok': True, 'unifiedProcedureNo': result_number, 'screenshotBase64': b64, 'screenshotPath': str(path), 'whatsappSent': sent}


class Handler(BaseHTTPRequestHandler):
    def _headers(self, status=200):
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Tarabil-Agent-Key')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        self.end_headers()

    def _json(self, status, data):
        self._headers(status)
        self.wfile.write(json.dumps(data, ensure_ascii=False).encode('utf-8'))

    def _authorized(self):
        return self.headers.get('X-Tarabil-Agent-Key', '') == CFG.get('agent_key', '')

    def do_OPTIONS(self):
        self._headers(204)

    def do_GET(self):
        if self.path != '/health': return self._json(404, {'ok':False})
        if not self._authorized(): return self._json(401, {'ok':False,'error':'unauthorized'})
        self._json(200, {'ok':True,'version':VERSION,'busy':JOB_LOCK.locked()})

    def do_POST(self):
        if self.path != '/run-unified': return self._json(404, {'ok':False})
        if not self._authorized(): return self._json(401, {'ok':False,'error':'unauthorized'})
        if not JOB_LOCK.acquire(blocking=False): return self._json(409, {'ok':False,'error':'يوجد إجراء آخر قيد التنفيذ على هذا الجهاز'})
        try:
            n = int(self.headers.get('Content-Length','0') or 0)
            payload = json.loads(self.rfile.read(n).decode('utf-8') or '{}')
            result = run_job(payload)
            self._json(200, result)
        except Exception as e:
            self._json(500, {'ok':False,'error':str(e)})
        finally:
            JOB_LOCK.release()

    def log_message(self, fmt, *args):
        pass


if __name__ == '__main__':
    host = CFG.get('listen_host', '127.0.0.1')
    port = int(CFG.get('listen_port', 8765))
    print(f'Tarabil Local Agent {VERSION} running on http://{host}:{port}')
    print('اترك هذه النافذة مفتوحة أثناء العمل. Ctrl+C للإغلاق.')
    ThreadingHTTPServer((host, port), Handler).serve_forever()

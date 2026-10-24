from __future__ import annotations
import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path

import keyring
import pyautogui
import pygetwindow as gw
import requests
from pywinauto import Desktop

import threading
import atexit
from jab_client import JABClient
from navigation import NavigationError

BASE = Path(__file__).resolve().parent
CONFIG_PATH = BASE / 'config.json'
SCREENSHOTS = BASE / 'screenshots'
SERVICE = 'TarabilCustomsAgent'
VERSION = '5.0.0-hybrid-intelligent'
INSTANCE_LOCK_PORT = 47621
AGENT_STATE = 'ONLINE'

# Windows consoles can use legacy encodings. Never let a status message crash a completed job.
for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

if not CONFIG_PATH.exists():
    raise SystemExit('config.json is missing. Run setup_credentials.py first.')

CFG = json.loads(CONFIG_PATH.read_text(encoding='utf-8'))
SCREENSHOTS.mkdir(exist_ok=True)
pyautogui.FAILSAFE = True


def log(message: str):
    try:
        print(str(message), flush=True)
    except Exception:
        try:
            print(str(message).encode('ascii', 'replace').decode('ascii'), flush=True)
        except Exception:
            pass


def acquire_instance_lock():
    lock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        lock.bind(('127.0.0.1', INSTANCE_LOCK_PORT))
        lock.listen(1)
        return lock
    except OSError:
        log('Tarabil Agent is already running in the background.')
        raise SystemExit(23)


def secret(name: str) -> str:
    return keyring.get_password(SERVICE, name) or ''


def find_asycuda_window():
    titles = ['ASYCUDAWorld production server']
    for title in gw.getAllTitles():
        if title and any(x.lower() in title.lower() for x in titles):
            wins = gw.getWindowsWithTitle(title)
            if wins:
                # Prefer the largest matching ASYCUDA window when more than one exists.
                return max(wins, key=lambda w: max(1, int(getattr(w, 'width', 1))) * max(1, int(getattr(w, 'height', 1))))
    return None


def focus_window(win):
    try:
        if win.isMinimized:
            win.restore()
        win.activate()
        time.sleep(.8)
    except Exception:
        pass


def _wait_until(predicate, timeout: float, interval: float = .4, description: str = 'condition'):
    deadline = time.time() + max(1.0, float(timeout))
    last_error = None
    while time.time() < deadline:
        try:
            value = predicate()
            if value:
                return value
        except Exception as exc:
            last_error = exc
        time.sleep(interval)
    if last_error:
        raise RuntimeError(f'Timed out waiting for {description}: {last_error}')
    raise RuntimeError(f'Timed out waiting for {description}.')


def _security_dialog():
    """Return the Java Security Warning dialog if it is visible."""
    for backend in ('uia', 'win32'):
        try:
            desktop = Desktop(backend=backend)
            wins = desktop.windows(title_re=r'.*Security Warning.*', visible_only=True)
            if wins:
                return wins[0]
        except Exception:
            continue
    return None


def _click_security_warning_if_present(timeout=40):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        dlg = _security_dialog()
        if dlg:
            text = ' '.join(x.window_text() for x in dlg.descendants()).casefold()
            if 'asycuda' not in text and 'awiqworld' not in text:
                raise NavigationError('manual_intervention_required', 'تعذر التأكد أن تحذير Java يخص الأسيكودا')
            # Require the exact risk checkbox and Run control. No positional fallback.
            boxes = [x for x in dlg.descendants() if
                     'i accept the risk and want to run this application' in x.window_text().lower()]
            buttons = [x for x in dlg.descendants() if x.window_text().strip() == 'Run']
            if len(boxes) != 1 or len(buttons) != 1:
                raise NavigationError('manual_intervention_required', 'تعذر تحديد عناصر تحذير Java بأمان')
            box = boxes[0]
            if not hasattr(box, 'get_toggle_state') or not hasattr(box, 'toggle'):
                raise NavigationError('manual_intervention_required', 'تحذير Java يحتاج إلى تدخل يدوي')
            if box.get_toggle_state() != 1:
                box.toggle()
            buttons[0].invoke()
            _wait_until(lambda: _security_dialog() is None, 20, .3, 'Java warning')
            return True
        if find_asycuda_window(): return False
        time.sleep(.4)
    return False


def _wait_for_asycuda_window(timeout: float = 90.0):
    return _wait_until(find_asycuda_window, timeout, .5, 'ASYCUDA window')


def launch_asycuda():
    asy = CFG['asycuda']
    win = find_asycuda_window()
    if win:
        focus_window(win)
        return False

    jnlp = asy.get('jnlp_path', '')
    if jnlp and not os.path.isabs(jnlp):
        jnlp = str((BASE / jnlp).resolve())
    launcher = asy.get('launcher_path', '')
    if not jnlp or not Path(jnlp).exists():
        raise RuntimeError('AWIQWorld.jnlp path is invalid in config.json.')

    log('Launching ASYCUDA...')
    if launcher:
        subprocess.Popen([launcher, jnlp], close_fds=True)
    else:
        os.startfile(jnlp)

    # Do NOT use a fixed 18-second sleep. Handle the Java warning, then wait for the real window.
    _click_security_warning_if_present(float(asy.get('security_warning_timeout_seconds', 40)))
    win = _wait_for_asycuda_window(float(asy.get('startup_timeout_seconds', 120)))
    focus_window(win)
    return True


HELPER = JABClient(BASE)
atexit.register(HELPER.close)


def ensure_unified_procedure_screen():
    launch_asycuda()
    deadline = time.monotonic() + 150
    login_sent = False
    previous, repeats = None, 0
    while time.monotonic() < deadline:
        if _security_dialog():
            _click_security_warning_if_present(10)
        try:
            result = HELPER.call('step')
        except NavigationError as exc:
            if exc.code not in ('jab_unavailable', 'helper_unavailable'):
                raise
            time.sleep(.5)
            continue
        log('ASYCUDA state: ' + result['state'] + ' | planner=' + str(result.get('source','rule')))
        operation = result['operation']
        if operation == 'ready': return 'READY'
        if operation == 'login':
            if login_sent:
                time.sleep(.5)
                continue
            username, password = secret('asycuda_username'), secret('asycuda_password')
            if not username or not password:
                raise NavigationError('manual_intervention_required', 'بيانات تسجيل دخول الأسيكودا غير متاحة محلياً')
            response = HELPER.call('step', credentials={'username': username, 'password': password})
            login_sent = response['operation'] == 'login_sent'
        marker = (result['state'], operation, result.get('target'))
        repeats = repeats + 1 if marker == previous else 0
        previous = marker
        if repeats >= 3 and operation not in ('wait', 'login'):
            raise NavigationError('navigation_stalled', 'تعذر الوصول إلى شاشة رقم الإجراء الموحد')
        time.sleep(.5)
    raise NavigationError('navigation_timeout', 'تعذر الوصول إلى شاشة رقم الإجراء الموحد')


def navigate_to_unified():
    return ensure_unified_procedure_screen()


def create_unified_procedure(job):
    # Production stays disabled pending explicit authorization and verified selectors.
    raise NavigationError('manual_intervention_required', 'إنشاء إجراء حقيقي غير مفعّل أثناء اختبار النظام')


def take_screenshot(label: str):
    win = find_asycuda_window()
    if not win or win.isMinimized:
        raise NavigationError('screenshot_failed', 'تعذر التقاط نافذة الأسيكودا')
    region = (int(win.left), int(win.top), int(win.width), int(win.height))
    img = pyautogui.screenshot(region=region)
    # File names are intentionally ASCII-only to avoid Windows locale/charmap issues.
    safe = ''.join(c for c in str(label) if c.isascii() and (c.isalnum() or c in '-_')) or 'test'
    filename = f'{safe}_{time.strftime("%Y-%m-%d_%H-%M-%S")}_{time.time_ns() % 1000000:06d}.png'
    path = SCREENSHOTS / filename
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
        raise RuntimeError('WhatsApp Cloud API settings are incomplete.')
    to = ''.join(ch for ch in to if ch.isdigit())
    if not to:
        raise RuntimeError('WhatsApp number is invalid.')
    base = f'https://graph.facebook.com/{version}/{phone_id}'
    with path.open('rb') as f:
        up = requests.post(
            f'{base}/media',
            headers={'Authorization': f'Bearer {token}'},
            data={'messaging_product': 'whatsapp'},
            files={'file': ('unified.png', f, 'image/png')},
            timeout=30,
        )
    up.raise_for_status()
    media_id = up.json()['id']
    caption_tpl = wa.get('caption') or 'Unified procedure: {procedureNo} - {serial} - {companyName}'
    caption = caption_tpl.format(procedureNo=result_no or 'see image', serial=serial, companyName=company_name)
    msg = requests.post(
        f'{base}/messages',
        headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'},
        json={'messaging_product': 'whatsapp', 'to': to, 'type': 'image', 'image': {'id': media_id, 'caption': caption}},
        timeout=30,
    )
    msg.raise_for_status()
    return True


def run_navigation_test():
    ensure_unified_procedure_screen()
    if HELPER.call('snapshot')['state'] != 'UNIFIED_PROCEDURE_OPEN':
        raise NavigationError('navigation_changed', 'تغيرت شاشة الأسيكودا قبل التقاط الصورة')
    path = take_screenshot('test')
    if HELPER.call('snapshot')['state'] != 'UNIFIED_PROCEDURE_OPEN':
        raise NavigationError('navigation_changed', 'تغيرت شاشة الأسيكودا أثناء التقاط الصورة')
    return {'statusCode': 'TEST_SUCCESS',
            'message': 'تم الوصول إلى شاشة رقم الإجراء الموحد بنجاح ولم يتم إنشاء أي إجراء.',
            'unifiedProcedureNo': '', 'whatsappSent': False,
            'screenshotTaken': True, 'screenshotName': path.name}


def run_test_job(job):
    return run_navigation_test()


def run_job(job):
    kind = job.get('kind')
    if kind in ('test', 'test_navigation'):
        return run_navigation_test()
    if kind in ('execute', 'create_unified_procedure'):
        return create_unified_procedure(job)
    raise NavigationError('invalid_job_kind', 'نوع الطلب غير مدعوم')


def cloud_headers():
    token = secret('agent_device_token')
    cloud = CFG.get('cloud', {})
    device_id = cloud.get('device_id', '')
    if not token or not device_id:
        raise RuntimeError('Agent cloud credentials are incomplete. Run setup_credentials.py.')
    return {'Authorization': f'Bearer {token}', 'X-Tarabil-Device-Id': device_id}


def api_url(path: str):
    base = str(CFG.get('cloud', {}).get('server_url', '')).rstrip('/')
    if not base.startswith('https://'):
        raise RuntimeError('server_url is invalid in config.json.')
    return base + path


def complete_job(job_id: str, ok: bool, result=None, error=''):
    payload = {'id': job_id, 'ok': ok, 'error': error}
    if result:
        payload.update({
            'unifiedProcedureNo': result.get('unifiedProcedureNo', ''),
            'whatsappSent': bool(result.get('whatsappSent')),
            'screenshotTaken': bool(result.get('screenshotTaken')),
            'screenshotName': result.get('screenshotName', ''),
            'statusCode': result.get('statusCode', ''),
            'message': result.get('message', ''),
        })
    r = requests.post(api_url('/api/agent/complete'), headers=cloud_headers(), json=payload, timeout=25)
    r.raise_for_status()


def heartbeat(stop):
    while not stop.is_set():
        try:
            response = requests.post(api_url('/api/agent/heartbeat'), headers=cloud_headers(),
                json={'version': VERSION, 'state': AGENT_STATE, 'capabilities': ['jab32','screen-memory','safe-planner']}, timeout=15)
            response.raise_for_status()
        except requests.HTTPError as exc:
            status = exc.response.status_code
            log('AUTH_ERROR' if status in (401, 403) else 'SERVER_ERROR')
        except Exception:
            log('SERVER_ERROR: heartbeat unavailable')
        stop.wait(10)


def main():
    global AGENT_STATE
    _instance_lock = acquire_instance_lock()
    stop = threading.Event()
    threading.Thread(target=heartbeat, args=(stop,), daemon=True).start()
    outbox = BASE / 'pending-result.json'
    poll = max(2, int(CFG.get('cloud', {}).get('poll_seconds', 3)))
    log('Tarabil Cloud Agent ' + VERSION)
    try:
        while not (BASE / 'STOP_AGENT').exists():
            try:
                # Persist completion before sending; network failures never repeat UI actions.
                if outbox.exists():
                    completion = json.loads(outbox.read_text(encoding='utf-8'))
                    complete_job(**completion)
                    outbox.unlink()
                response = requests.get(api_url('/api/agent/next'), headers=cloud_headers(), timeout=25)
                response.raise_for_status()
                job = response.json().get('job')
                if not job:
                    stop.wait(poll)
                    continue
                AGENT_STATE = 'ONLINE'
                completion = {'job_id': str(job['id']), 'ok': False}
                try:
                    completion.update(ok=True, result=run_job(job))
                except Exception as exc:
                    AGENT_STATE = 'AGENT_ERROR'
                    path = _safe_error_screenshot()
                    completion.update(ok=False,
                        error=str(exc) if isinstance(exc, NavigationError) else 'تعذر الوصول إلى شاشة رقم الإجراء الموحد',
                        result={'statusCode': getattr(exc, 'code', 'agent_error'),
                                'screenshotTaken': bool(path), 'screenshotName': path.name if path else ''})
                    log('Job stopped: ' + getattr(exc, 'code', 'agent_error'))
                temp = outbox.with_suffix('.tmp')
                temp.write_text(json.dumps(completion, ensure_ascii=True), encoding='utf-8')
                temp.replace(outbox)
            except requests.HTTPError as exc:
                log('AUTH_ERROR' if exc.response.status_code in (401, 403) else 'SERVER_ERROR')
                stop.wait(max(poll, 5))
            except Exception:
                log('AGENT_ERROR: check local diagnostics')
                stop.wait(max(poll, 5))
    except KeyboardInterrupt:
        pass
    finally:
        stop.set()
        HELPER.close()


def _safe_error_screenshot():
    try: return take_screenshot('navigation-error')
    except Exception: return None


if __name__ == '__main__':
    main()

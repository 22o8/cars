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
import pyperclip
import requests
from pywinauto import Desktop

BASE = Path(__file__).resolve().parent
CONFIG_PATH = BASE / 'config.json'
SCREENSHOTS = BASE / 'screenshots'
SERVICE = 'TarabilCustomsAgent'
VERSION = '2.5.0-cloud-guided-calibration'
INSTANCE_LOCK_PORT = 47621

# Windows consoles can use legacy encodings. Never let a status message crash a completed job.
for stream in (sys.stdout, sys.stderr):
    try:
        stream.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

if not CONFIG_PATH.exists():
    raise SystemExit('config.json is missing. Run setup_credentials.py and calibrate.py first.')

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


def paste_text(value: str):
    pyperclip.copy(str(value))
    pyautogui.hotkey('ctrl', 'a')
    pyautogui.hotkey('ctrl', 'v')


def click_point(p, pause=.35):
    if not p or len(p) != 2 or (int(p[0]) == 0 and int(p[1]) == 0):
        raise RuntimeError('Screen point is missing from config.json. Run calibrate-agent.bat and complete TEST calibration.')
    pyautogui.click(int(p[0]), int(p[1]))
    time.sleep(pause)


def find_asycuda_window():
    titles = CFG['asycuda'].get('window_title_contains', [])
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


def _is_login_window(win) -> bool:
    try:
        # The Iraqi ASYCUDA login dialog is a small Swing window, while the main client is large.
        return int(win.width) < 900 or int(win.height) < 650
    except Exception:
        return False


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


def _click_security_warning_if_present(timeout: float = 35.0) -> bool:
    """Accept the known Java Web Start warning and click Run.

    This is only attempted for the standard Java dialog titled "Security Warning".
    If ASYCUDA starts without the warning, the function simply returns False.
    """
    deadline = time.time() + timeout
    while time.time() < deadline:
        dlg = _security_dialog()
        if dlg:
            try:
                dlg.set_focus()
            except Exception:
                pass

            # UI Automation path first: find the actual checkbox and Run button by control type/text.
            clicked_checkbox = False
            for backend in ('uia', 'win32'):
                try:
                    d = Desktop(backend=backend).window(title_re=r'.*Security Warning.*')
                    # Some Java versions expose the checkbox text, others only expose a CheckBox control.
                    boxes = d.descendants(control_type='CheckBox') if backend == 'uia' else d.descendants(class_name='Button')
                    for box in boxes:
                        text = ''
                        try:
                            text = (box.window_text() or '').lower()
                        except Exception:
                            pass
                        if ('accept' in text and 'risk' in text) or (backend == 'uia' and not clicked_checkbox):
                            try:
                                state = box.get_toggle_state() if hasattr(box, 'get_toggle_state') else None
                            except Exception:
                                state = None
                            if state != 1:
                                try:
                                    box.click_input()
                                except Exception:
                                    box.click()
                            clicked_checkbox = True
                            break
                    if clicked_checkbox:
                        break
                except Exception:
                    continue

            # Fallback using relative coordinates inside the warning window if accessibility is unavailable.
            if not clicked_checkbox:
                try:
                    r = dlg.rectangle()
                    pyautogui.click(int(r.left + 43), int(r.bottom - 31))
                    time.sleep(.5)
                except Exception as exc:
                    raise RuntimeError(f'Could not accept Java Security Warning: {exc}')

            clicked_run = False
            for backend in ('uia', 'win32'):
                try:
                    d = Desktop(backend=backend).window(title_re=r'.*Security Warning.*')
                    try:
                        btn = d.child_window(title='Run', control_type='Button')
                        if btn.exists(timeout=.5):
                            btn.click_input()
                            clicked_run = True
                            break
                    except Exception:
                        pass
                    for b in d.descendants():
                        try:
                            if (b.window_text() or '').strip().lower() == 'run':
                                b.click_input()
                                clicked_run = True
                                break
                        except Exception:
                            pass
                    if clicked_run:
                        break
                except Exception:
                    continue

            if not clicked_run:
                try:
                    # Standard dialog: Run button is immediately left of Cancel near bottom-right.
                    r = dlg.rectangle()
                    pyautogui.click(int(r.right - 134), int(r.bottom - 31))
                    clicked_run = True
                except Exception as exc:
                    raise RuntimeError(f'Could not click Run in Java Security Warning: {exc}')

            # Wait for the security dialog to disappear before touching ASYCUDA.
            _wait_until(lambda: _security_dialog() is None, 20, .3, 'Java Security Warning to close')
            return True

        # If ASYCUDA already appeared, don't waste the full warning timeout.
        if find_asycuda_window():
            return False
        time.sleep(.35)
    return False


def _wait_for_asycuda_window(timeout: float = 90.0):
    return _wait_until(find_asycuda_window, timeout, .5, 'ASYCUDA window')


def _wait_for_main_window(timeout: float = 120.0):
    def ready():
        win = find_asycuda_window()
        if not win:
            return None
        try:
            if not _is_login_window(win):
                return win
        except Exception:
            pass
        return None
    return _wait_until(ready, timeout, .6, 'ASYCUDA main window after login')


def _wait_window_stable(seconds: float = 2.0, timeout: float = 15.0):
    """Wait until ASYCUDA's window geometry stays unchanged for a short period."""
    deadline = time.time() + timeout
    stable_since = None
    last = None
    while time.time() < deadline:
        win = find_asycuda_window()
        if not win:
            stable_since = None
            last = None
            time.sleep(.3)
            continue
        cur = (int(win.left), int(win.top), int(win.width), int(win.height), str(win.title))
        if cur == last:
            if stable_since is None:
                stable_since = time.time()
            if time.time() - stable_since >= seconds:
                return win
        else:
            last = cur
            stable_since = time.time()
        time.sleep(.3)
    return find_asycuda_window()


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
    _wait_window_stable(1.0, 8.0)
    return True


def login_if_needed(was_launched: bool):
    win = _wait_for_asycuda_window(float(CFG['asycuda'].get('startup_timeout_seconds', 120)))
    if not _is_login_window(win):
        focus_window(win)
        return False

    username = secret('asycuda_username')
    password = secret('asycuda_password')
    if not username or not password:
        raise RuntimeError('ASYCUDA credentials are missing from Windows Credential Manager.')

    asy = CFG['asycuda']
    log('ASYCUDA login screen detected. Signing in...')
    focus_window(win)
    click_point(asy['login_username'], .3); paste_text(username)
    click_point(asy['login_password'], .3); paste_text(password)
    click_point(asy['login_button'], .2)

    main = _wait_for_main_window(float(asy.get('login_timeout_seconds', 150)))
    focus_window(main)
    _wait_window_stable(1.5, 12.0)
    # Give ASYCUDA a small extra grace period after the main Swing frame is visible.
    time.sleep(float(asy.get('main_ready_grace_seconds', 2.0)))
    return True


def _normalized_nav_steps(points):
    """Turn legacy calibrated click points into steps; repeated adjacent points become a double-click."""
    steps = []
    i = 0
    while i < len(points):
        p = points[i]
        if i + 1 < len(points):
            q = points[i + 1]
            try:
                if abs(int(p[0]) - int(q[0])) <= 6 and abs(int(p[1]) - int(q[1])) <= 6:
                    steps.append({'point': p, 'clicks': 2})
                    i += 2
                    continue
            except Exception:
                pass
        steps.append({'point': p, 'clicks': 1})
        i += 1
    return steps


def navigate_to_unified():
    asy = CFG['asycuda']
    launched = launch_asycuda()
    login_if_needed(launched)

    main = _wait_for_main_window(float(asy.get('login_timeout_seconds', 150)))
    focus_window(main)
    points = asy.get('unified_menu_clicks', [])
    if not points:
        raise RuntimeError('Unified procedure navigation is missing. Run calibrate-agent.bat and complete all navigation steps.')

    step_wait = float(asy.get('menu_step_wait_seconds', 1.4))
    log(f'Navigating to unified procedure ({len(points)} calibrated clicks)...')
    for idx, step in enumerate(_normalized_nav_steps(points), start=1):
        p = step['point']
        if not p or len(p) != 2:
            raise RuntimeError('Invalid unified procedure navigation calibration.')
        focus_window(find_asycuda_window() or main)
        if step['clicks'] == 2:
            pyautogui.doubleClick(int(p[0]), int(p[1]), interval=.16)
        else:
            pyautogui.click(int(p[0]), int(p[1]))
        log(f'Navigation step {idx} completed; waiting for ASYCUDA UI...')
        time.sleep(step_wait)
        _wait_window_stable(.5, 3.0)

    # Final page can take longer than a tree/menu expansion. Wait before any field click or screenshot.
    final_wait = float(asy.get('unified_ready_wait_seconds', 4.0))
    time.sleep(final_wait)
    _wait_window_stable(1.0, 8.0)
    focus_window(find_asycuda_window() or main)

def create_unified(company_code: str):
    asy = CFG['asycuda']
    navigate_to_unified()
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
        pyautogui.hotkey('ctrl', 'a')
        pyautogui.hotkey('ctrl', 'c')
        time.sleep(.2)
        value = (pyperclip.paste() or '').strip()
        digits = ''.join(ch for ch in value if ch.isdigit())
        return digits if 6 <= len(digits) <= 30 else value[:80]
    except Exception:
        return ''


def take_screenshot(label: str):
    region = CFG['asycuda'].get('screenshot_region')
    img = pyautogui.screenshot(region=tuple(region) if region else None)
    # File names are intentionally ASCII-only to avoid Windows locale/charmap issues.
    safe = ''.join(c for c in str(label) if c.isascii() and (c.isalnum() or c in '-_')) or 'test'
    filename = f'{time.strftime("%Y%m%d-%H%M%S")}-{safe}.png'
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


def run_test_job(job: dict):
    # Safety boundary: this path NEVER reads companyCode and NEVER calls create_unified().
    navigate_to_unified()
    path = take_screenshot('connection-test')
    return {
        'unifiedProcedureNo': '',
        'whatsappSent': False,
        'screenshotTaken': True,
        'screenshotName': path.name,
    }


def run_execute_job(job: dict):
    code = str(job.get('companyCode', '')).strip()
    if not code:
        raise RuntimeError('Company code is empty.')
    serial = str(job.get('serial', '')).strip()
    company = str(job.get('companyName', '')).strip()
    phone = str(job.get('whatsappNumber', '')).strip()
    create_unified(code)
    result_number = read_result_number()
    path = take_screenshot(serial or code)
    sent = send_whatsapp(path, phone, serial, company, result_number) if phone else False
    return {
        'unifiedProcedureNo': result_number,
        'whatsappSent': sent,
        'screenshotTaken': True,
        'screenshotName': path.name,
    }


def run_job(job: dict):
    inferred = 'test' if not str(job.get('companyCode', '')).strip() else 'execute'
    kind = str(job.get('kind') or inferred).strip().lower()
    if kind == 'test':
        return run_test_job(job)
    return run_execute_job(job)


def cloud_headers():
    token = secret('agent_device_token')
    cloud = CFG.get('cloud', {})
    device_id = cloud.get('device_id', '')
    if not token or not device_id:
        raise RuntimeError('Agent cloud credentials are incomplete. Run setup_credentials.py.')
    return {'Authorization': f'Bearer {token}', 'X-Tarabil-Device-Id': device_id}


def api_url(path: str):
    base = str(CFG.get('cloud', {}).get('server_url', '')).rstrip('/')
    if not base.startswith('http'):
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
        })
    r = requests.post(api_url('/api/agent/complete'), headers=cloud_headers(), json=payload, timeout=25)
    r.raise_for_status()


def main():
    _instance_lock = acquire_instance_lock()
    poll = max(2, int(CFG.get('cloud', {}).get('poll_seconds', 3)))
    log(f'Tarabil Cloud Agent {VERSION}')
    log('Agent is online and waiting for cloud jobs.')
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
            inferred = 'test' if not str(job.get('companyCode', '')).strip() else 'execute'
            kind = str(job.get('kind') or inferred)
            if kind == 'test':
                log(f'[{time.strftime("%H:%M:%S")}] running safe connection test {jid}')
            else:
                log(f'[{time.strftime("%H:%M:%S")}] running job {jid} for company {job.get("companyCode")}')
            try:
                result = run_job(job)
                complete_job(jid, True, result=result)
                if kind == 'test':
                    log(f'test completed; screenshot saved: {result.get("screenshotName", "")}. No procedure was created.')
                else:
                    log(f'job completed; procedure: {result.get("unifiedProcedureNo") or "not auto-read"}')
            except Exception as e:
                err = f'{type(e).__name__}: {e}'
                try:
                    complete_job(jid, False, error=err[:500])
                finally:
                    log(f'job failed: {err}')
        except KeyboardInterrupt:
            break
        except Exception as e:
            log(f'server connection error: {type(e).__name__}: {e}')
            time.sleep(max(poll, 5))


if __name__ == '__main__':
    main()

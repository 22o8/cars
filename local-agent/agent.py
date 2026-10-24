from __future__ import annotations
import json
import base64
import io
import os
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlparse
import xml.etree.ElementTree as ET

import keyring
import pyautogui
import pygetwindow as gw
import requests
from pywinauto import Desktop
from pywinauto.keyboard import send_keys
from PIL import Image

import threading
import atexit
from jab_client import JABClient
from navigation import NavigationError

BASE = Path(__file__).resolve().parent
CONFIG_PATH = BASE / 'config.json'
SCREENSHOTS = BASE / 'screenshots'
SERVICE = 'TarabilCustomsAgent'
VERSION = '5.8.0-interactive-review'
INSTANCE_LOCK_PORT = 47621
AGENT_STATE = 'ONLINE'
CURRENT_CANCEL_EVENT = None

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


def check_cancelled():
    event = CURRENT_CANCEL_EVENT
    if event is not None and event.is_set():
        raise NavigationError('cancelled_by_user', 'تم إيقاف الطلب بواسطة المستخدم')


def cancellation_watcher(job_id: str, cancel_event: threading.Event, done_event: threading.Event):
    """Poll cloud control state while a job is running. Temporary network errors are ignored."""
    while not done_event.wait(0.8):
        try:
            response = requests.get(
                api_url(f'/api/agent/jobs/{job_id}/control'),
                headers=cloud_headers(), timeout=8
            )
            response.raise_for_status()
            if response.json().get('cancelRequested'):
                cancel_event.set()
                return
        except Exception:
            continue


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
        check_cancelled()
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




def _official_jnlp_source(jnlp_path: str | Path) -> tuple[bool, str]:
    """Validate the local JNLP before we auto-accept Java's warning.

    Java 8 often does not expose the visible Location label through UIA/Win32.
    Instead of trusting missing UI text, verify the exact JNLP *we are about to
    launch*. Auto-accept is allowed only when that file declares HTTPS codebase
    on the official asy.mof.gov.iq host.
    """
    try:
        path = Path(jnlp_path).resolve()
        root = ET.parse(path).getroot()
        codebase = (root.attrib.get('codebase') or '').strip()
        href = (root.attrib.get('href') or '').strip()
        parsed = urlparse(codebase)
        trusted = (
            parsed.scheme.lower() == 'https'
            and (parsed.hostname or '').lower() == 'asy.mof.gov.iq'
            and href.casefold().endswith('.jnlp')
        )
        detail = f'codebase={codebase or "(missing)"}, href={href or "(missing)"}'
        return trusted, detail
    except Exception as exc:
        return False, f'JNLP validation failed: {type(exc).__name__}: {exc}'


def _security_dialog():
    """Return a visible Java Security Warning dialog wrapper.

    Prefer UIA, but keep a Win32 fallback because old Java 8 dialogs expose
    controls differently across Windows builds.
    """
    for backend in ('uia', 'win32'):
        try:
            desktop = Desktop(backend=backend)
            wins = desktop.windows(title_re=r'.*Security Warning.*', visible_only=True)
            if wins:
                return wins[0], backend
        except Exception:
            continue
    return None, None


def _safe_window_texts(dlg):
    out = []
    try:
        out.append(dlg.window_text())
    except Exception:
        pass
    try:
        for item in dlg.descendants():
            try:
                t = item.window_text()
                if t:
                    out.append(t)
            except Exception:
                continue
    except Exception:
        pass
    return out


def _is_trusted_asycuda_security_warning(dlg, trusted_launch: bool = False) -> bool:
    """Trust the dialog either from exposed UI text or verified launch context.

    Old Oracle Java 8 dialogs can render Location on screen without exposing it
    to UI Automation. In that case trusted_launch is safe only when launch_asycuda
    already validated the exact JNLP codebase and there was no pre-existing
    Security Warning before starting it.
    """
    text = ' '.join(_safe_window_texts(dlg)).casefold()
    prompt_ok = ('do you want to run this application' in text) or trusted_launch
    host_ok = ('asy.mof.gov.iq' in text or 'https://asy.mof.gov.iq' in text) or trusted_launch
    title_ok = 'security warning' in text
    try:
        title_ok = title_ok or 'security warning' in (dlg.window_text() or '').casefold()
    except Exception:
        pass
    return bool(title_ok and prompt_ok and host_ok)


def _find_risk_checkbox_and_run(dlg):
    """Find Java 8 risk checkbox and Run button without screen coordinates."""
    checkbox = None
    run_button = None

    try:
        descendants = dlg.descendants()
    except Exception:
        descendants = []

    # Text/role based discovery first. On Java 8 the checkbox can appear as a
    # Win32 Button rather than a UIA CheckBox, so do not require one control type.
    for item in descendants:
        try:
            name = (item.window_text() or '').strip()
        except Exception:
            name = ''
        low = name.casefold()
        if checkbox is None and 'i accept the risk and want to run this application' in low:
            checkbox = item
        if run_button is None and name.casefold() == 'run':
            run_button = item

    # UIA can sometimes expose names only through element_info.name.
    if checkbox is None or run_button is None:
        for item in descendants:
            try:
                name = (getattr(item.element_info, 'name', '') or '').strip()
            except Exception:
                continue
            low = name.casefold()
            if checkbox is None and 'i accept the risk and want to run this application' in low:
                checkbox = item
            if run_button is None and low == 'run':
                run_button = item

    return checkbox, run_button


def _activate_checkbox(control) -> bool:
    """Enable the checkbox using semantics first, then a control click."""
    if control is None:
        return False
    try:
        state = control.get_toggle_state()
        if state == 1:
            return True
        control.toggle()
        time.sleep(.3)
        try:
            return control.get_toggle_state() == 1
        except Exception:
            return True
    except Exception:
        pass
    try:
        # click_input clicks the discovered control itself, not a stored desktop coordinate.
        control.click_input()
        time.sleep(.3)
        return True
    except Exception:
        return False


def _activate_run(control) -> bool:
    if control is None:
        return False
    # Give Java a moment to enable Run after accepting the risk.
    for _ in range(15):
        try:
            if hasattr(control, 'is_enabled') and not control.is_enabled():
                time.sleep(.2)
                continue
        except Exception:
            pass
        for method in ('invoke', 'click_input', 'click'):
            try:
                fn = getattr(control, method)
                fn()
                return True
            except Exception:
                continue
        time.sleep(.2)
    return False


def _security_keyboard_fallback(dlg) -> bool:
    """Keyboard-only fallback for the *trusted* official Java warning.

    It is intentionally conservative: it is used only after the dialog title,
    official host and prompt text were verified. Java 8's dialog normally opens
    with Cancel focused. Shift+Tab reaches the acceptance checkbox (disabled Run
    is skipped on common Java 8 builds), Space checks it, then Tab reaches Run.
    """
    try:
        dlg.set_focus()
        time.sleep(.3)
        # Try one and two reverse tabs because focus behavior differs by JRE build.
        for reverse_tabs in (1, 2):
            dlg.set_focus()
            send_keys('+{TAB}' * reverse_tabs, pause=.12)
            send_keys('{SPACE}', pause=.2)
            # Run should now be enabled. Tab forward until Enter closes the dialog.
            for _ in range(3):
                send_keys('{TAB}', pause=.12)
                send_keys('{ENTER}', pause=.2)
                time.sleep(.5)
                current, _ = _security_dialog()
                if current is None:
                    return True
        return False
    except Exception:
        return False


def _security_relative_fallback(dlg) -> bool:
    """Last-resort click using positions relative to the verified Java dialog.

    These are NOT desktop coordinates. They are fractions of the trusted dialog's
    current rectangle, so moving the dialog or changing screen resolution does not
    invalidate them. The action is allowed only after the official ASYCUDA host
    and warning text have already been verified.
    """
    try:
        rect = dlg.rectangle()
        width = max(1, int(rect.width()))
        height = max(1, int(rect.height()))
        dlg.set_focus()
        time.sleep(.25)
        # Java 8 risk checkbox is consistently in the lower-left action row.
        for checkbox_x in (.075, .09, .11):
            try:
                dlg.click_input(coords=(int(width * checkbox_x), int(height * .885)))
                time.sleep(.45)
                break
            except Exception:
                continue
        # Run is in the same row, left of Cancel. Try a tiny relative search band.
        for run_x in (.73, .70, .76):
            try:
                dlg.click_input(coords=(int(width * run_x), int(height * .885)))
                time.sleep(.75)
                current, _ = _security_dialog()
                if current is None:
                    return True
            except Exception:
                continue
        return False
    except Exception:
        return False


def _security_absolute_fallback(dlg) -> bool:
    """Trusted final fallback using live dialog bounds, never stored desktop coordinates.

    This is only called after title + official asy.mof.gov.iq location + prompt text
    were verified. Coordinates are recomputed from the current dialog rectangle.
    """
    try:
        rect = dlg.rectangle()
        left, top = int(rect.left), int(rect.top)
        width, height = max(1, int(rect.width())), max(1, int(rect.height()))
        dlg.set_focus()
        time.sleep(.35)
        # Confirmed Java 8 layout: checkbox in lower-left row, Run left of Cancel.
        pyautogui.click(left + int(width * .085), top + int(height * .885))
        time.sleep(.65)
        pyautogui.click(left + int(width * .735), top + int(height * .885))
        time.sleep(.9)
        current, _ = _security_dialog()
        return current is None
    except Exception:
        return False


def _click_security_warning_if_present(timeout=40, trusted_launch: bool = False):
    deadline = time.monotonic() + timeout
    last_detail = ''
    while time.monotonic() < deadline:
        check_cancelled()
        dlg, backend = _security_dialog()
        if dlg:
            if not _is_trusted_asycuda_security_warning(dlg, trusted_launch=trusted_launch):
                raise NavigationError(
                    'manual_intervention_required',
                    'Java Security Warning appeared, but neither its UI text nor the verified JNLP launch context proved it belongs to asy.mof.gov.iq.'
                )

            checkbox, run_button = _find_risk_checkbox_and_run(dlg)
            last_detail = f'backend={backend}, checkbox={checkbox is not None}, run={run_button is not None}'

            if checkbox is not None and run_button is not None:
                if _activate_checkbox(checkbox) and _activate_run(run_button):
                    _wait_until(lambda: _security_dialog()[0] is None, 20, .25, 'Java Security Warning to close')
                    log('Java Security Warning accepted automatically.')
                    return True

            # Old Java 8 sometimes does not expose the checkbox role correctly.
            # Use a keyboard fallback only after the official host was verified.
            if _security_keyboard_fallback(dlg):
                _wait_until(lambda: _security_dialog()[0] is None, 20, .25, 'Java Security Warning to close')
                log('Java Security Warning accepted through safe keyboard fallback.')
                return True

            if _security_relative_fallback(dlg):
                _wait_until(lambda: _security_dialog()[0] is None, 20, .25, 'Java Security Warning to close')
                log('Java Security Warning accepted through trusted relative-dialog fallback.')
                return True

            if _security_absolute_fallback(dlg):
                _wait_until(lambda: _security_dialog()[0] is None, 20, .25, 'Java Security Warning to close')
                log('Java Security Warning accepted through trusted live-dialog fallback.')
                return True

            raise NavigationError(
                'manual_intervention_required',
                'Official Java Security Warning detected, but its controls could not be activated safely. ' + last_detail
            )

        if find_asycuda_window():
            return False
        time.sleep(.35)
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

    # Never auto-accept a Java warning that was already on screen before this job.
    preexisting_warning, _ = _security_dialog()
    if preexisting_warning is not None:
        raise NavigationError(
            'manual_intervention_required',
            'A Java Security Warning was already open before ASYCUDA launch. Close it manually, then retry.'
        )

    trusted_jnlp, trust_detail = _official_jnlp_source(jnlp)
    if not trusted_jnlp:
        raise NavigationError(
            'manual_intervention_required',
            'The configured JNLP is not the verified HTTPS asy.mof.gov.iq launcher. ' + trust_detail
        )

    log('Launching ASYCUDA from verified official JNLP...')
    if launcher:
        subprocess.Popen([launcher, jnlp], close_fds=True)
    else:
        os.startfile(jnlp)

    # Java 8 may hide the visible Location label from UIA. Because this warning
    # appeared only after we validated and launched the official JNLP, allow the
    # trusted launch context to authenticate it.
    _click_security_warning_if_present(
        float(asy.get('security_warning_timeout_seconds', 40)),
        trusted_launch=True,
    )
    win = _wait_for_asycuda_window(float(asy.get('startup_timeout_seconds', 120)))
    focus_window(win)
    return True


HELPER = JABClient(BASE)
atexit.register(HELPER.close)


def _review_copy(state: str):
    mapping = {
        'NOTIFICATIONS_POPUP': ('ظهرت صفحة الإشعارات', 'تم إيقاف الطلب مؤقتاً لأن إشعارات ASYCUDA ظهرت. راجع الصورة واختر إغلاقها والمتابعة أو إبقاءها وإيقاف الطلب.'),
        'NOTIFICATIONS_PAGE': ('صفحة الإشعارات مفتوحة', 'وجد النظام صفحة إشعارات/رسائل مفتوحة داخل ASYCUDA. راجع الصورة وحدد هل تريد إغلاق الصفحة والمتابعة.'),
        'OTHER_PAGE_OPEN': ('توجد صفحة أخرى مفتوحة', 'وجد النظام صفحة داخلية غير متوقعة مفتوحة في ASYCUDA. راجع الصورة قبل إغلاقها أو إيقاف الطلب.'),
        'PREDECLARATION_OPEN': ('يوجد بيان مسبق مفتوح', 'وجد النظام بياناً مسبقاً مفتوحاً قبل الوصول إلى رقم الإجراء الموحد. راجع الصورة وحدد هل تريد إغلاق الصفحة والمتابعة.'),
        'DECLARATION_OPEN': ('يوجد بيان مفتوح', 'وجد النظام بياناً مفتوحاً داخل ASYCUDA. راجع الصورة وحدد هل تريد إغلاق الصفحة والمتابعة.'),
        'UNKNOWN_POPUP': ('ظهرت نافذة غير معروفة', 'لن يضغط النظام أي زر داخل هذه النافذة قبل قرارك.'),
        'MANUAL_INTERVENTION': ('تحتاج الشاشة إلى قرار', 'ظهرت نافذة حفظ أو تأكيد أو حالة حساسة. راجع الصورة قبل المتابعة.'),
    }
    return mapping.get(state, ('ظهرت شاشة غير متوقعة', 'تم إيقاف الطلب مؤقتاً حتى تراجع الشاشة وتحدد الإجراء المناسب.'))


def _encode_review_screenshot(path: Path):
    with Image.open(path) as img:
        img = img.convert('RGB')
        img.thumbnail((1400, 1000))
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=72, optimize=True)
    return base64.b64encode(buf.getvalue()).decode('ascii'), 'image/jpeg'


def _send_review(job_id: str, state: str):
    title, message = _review_copy(state)
    path = take_screenshot('review-' + state.lower())
    encoded, mime = _encode_review_screenshot(path)
    payload = {
        'state': state,
        'title': title,
        'message': message,
        'screenshotMime': mime,
        'screenshotBase64': encoded,
    }
    response = None
    last_error = None
    for _ in range(5):
        check_cancelled()
        try:
            response = requests.post(
                api_url(f'/api/agent/jobs/{job_id}/review'),
                headers=cloud_headers(), json=payload, timeout=35
            )
            response.raise_for_status()
            break
        except Exception as exc:
            last_error = exc
            time.sleep(1.5)
    if response is None or not response.ok:
        raise NavigationError('review_upload_failed', f'تعذر رفع صورة المراجعة إلى النظام: {last_error or "network error"}')
    review = response.json().get('review') or {}
    review_id = str(review.get('id') or '')
    if not review_id:
        raise NavigationError('review_upload_failed', 'تعذر إنشاء مراجعة الشاشة داخل النظام')
    log(f'Job paused for review: {state} | review={review_id}')
    return review_id


def _dismiss_review_screen(state: str):
    win = find_asycuda_window()
    if win:
        focus_window(win)
    if state == 'NOTIFICATIONS_POPUP':
        pyautogui.press('esc')
    elif state in ('DECLARATION_OPEN', 'PREDECLARATION_OPEN', 'NOTIFICATIONS_PAGE', 'OTHER_PAGE_OPEN'):
        # Swing MDI: Ctrl+F4 closes the active internal frame without closing ASYCUDA itself.
        pyautogui.hotkey('ctrl', 'f4')
    else:
        # Unknown dialogs are never confirmed automatically. Esc is the semantic Cancel action.
        pyautogui.press('esc')
    time.sleep(.8)


def _wait_for_review_decision(job_id: str, review_id: str, state: str):
    while True:
        check_cancelled()
        try:
            response = requests.get(
                api_url(f'/api/agent/jobs/{job_id}/control'),
                headers=cloud_headers(), timeout=12
            )
            response.raise_for_status()
            data = response.json()
            if data.get('cancelRequested'):
                raise NavigationError('cancelled_by_user', 'تم إيقاف الطلب بواسطة المستخدم')
            review = data.get('review') or {}
            if str(review.get('id') or '') != review_id:
                time.sleep(1.0)
                continue
            decision = str(review.get('decision') or '')
            if not decision:
                time.sleep(1.0)
                continue
            if decision in ('stop', 'keep_and_stop'):
                raise NavigationError('cancelled_by_user', 'تم إيقاف الطلب بواسطة المستخدم')
            if decision == 'dismiss_and_resume':
                _dismiss_review_screen(state)
            elif decision != 'resume':
                raise NavigationError('invalid_review_decision', 'قرار المراجعة غير مدعوم')
            try:
                requests.post(
                    api_url(f'/api/agent/jobs/{job_id}/review-resolved'),
                    headers=cloud_headers(), json={'reviewId': review_id}, timeout=12
                ).raise_for_status()
            except Exception:
                pass
            log(f'Review decision received: {decision} | state={state}')
            return decision
        except NavigationError:
            raise
        except Exception:
            time.sleep(1.5)


def ensure_unified_procedure_screen(job_id: str = ''):
    launch_asycuda()
    deadline = time.monotonic() + 600
    login_sent = False
    previous, repeats = None, 0
    skip_review_once = None
    review_states = {'NOTIFICATIONS_POPUP', 'NOTIFICATIONS_PAGE', 'PREDECLARATION_OPEN', 'DECLARATION_OPEN', 'OTHER_PAGE_OPEN', 'UNKNOWN_POPUP', 'MANUAL_INTERVENTION'}
    while time.monotonic() < deadline:
        check_cancelled()
        if _security_dialog():
            _click_security_warning_if_present(10)
        try:
            current = HELPER.call('snapshot')
            state = str(current.get('state') or 'LOADING')
        except NavigationError as exc:
            if exc.code not in ('jab_unavailable', 'helper_unavailable'):
                raise
            time.sleep(.5)
            continue

        if job_id and state in review_states and skip_review_once != state:
            review_id = _send_review(job_id, state)
            decision = _wait_for_review_decision(job_id, review_id, state)
            if decision == 'resume':
                skip_review_once = state
            else:
                skip_review_once = None
            continue
        if skip_review_once == state:
            skip_review_once = None

        try:
            result = HELPER.call('step')
            check_cancelled()
        except NavigationError as exc:
            if exc.code in ('unknown_popup', 'manual_intervention_required') and job_id:
                state = 'UNKNOWN_POPUP' if exc.code == 'unknown_popup' else 'MANUAL_INTERVENTION'
                review_id = _send_review(job_id, state)
                _wait_for_review_decision(job_id, review_id, state)
                continue
            if exc.code not in ('jab_unavailable', 'helper_unavailable'):
                raise
            time.sleep(.5)
            continue
        log('ASYCUDA state: ' + result['state'] + ' | planner=' + str(result.get('source','rule')))
        operation = result['operation']
        if operation == 'dismiss_notifications':
            # In interactive-review mode this should normally have been intercepted above.
            if job_id:
                review_id = _send_review(job_id, 'NOTIFICATIONS_POPUP')
                _wait_for_review_decision(job_id, review_id, 'NOTIFICATIONS_POPUP')
            else:
                _dismiss_review_screen('NOTIFICATIONS_POPUP')
            continue
        if operation == 'ready':
            log('Unified procedure screen detected and ready.')
            return 'READY'
        if operation == 'login':
            if login_sent:
                time.sleep(.6)
                continue
            username, password = secret('asycuda_username'), secret('asycuda_password')
            if not username or not password:
                raise NavigationError('manual_intervention_required', 'بيانات تسجيل دخول الأسيكودا غير متاحة محلياً')
            response = HELPER.call('step', credentials={'username': username, 'password': password})
            if response.get('operation') != 'login_filled':
                raise NavigationError('login_failed', 'تعذر تجهيز حقول تسجيل الدخول في الأسيكودا')
            submitted = False
            try:
                submit = HELPER.call('submit_login')
                if submit.get('operation') in ('login_submitted', 'login_already_left'):
                    submitted = True
                    log('ASYCUDA Login action sent through Java Access Bridge.')
            except NavigationError as exc:
                if exc.code not in ('login_submit_ambiguous', 'jab_unavailable', 'helper_unavailable'):
                    raise
                log('JAB Login button fallback unavailable; using default Enter action.')
            if not submitted:
                win = find_asycuda_window()
                if win:
                    focus_window(win)
                pyautogui.press('enter')
                log('ASYCUDA credentials filled; default Enter Login action sent.')
            login_sent = True
            login_deadline = time.monotonic() + 45
            while time.monotonic() < login_deadline:
                check_cancelled()
                time.sleep(.7)
                try:
                    current = HELPER.call('snapshot')
                    if current.get('state') != 'LOGIN':
                        log('ASYCUDA login accepted; continuing navigation.')
                        break
                except NavigationError as exc:
                    if exc.code not in ('jab_unavailable', 'helper_unavailable'):
                        raise
            else:
                raise NavigationError('login_failed', 'بقيت شاشة تسجيل الدخول مفتوحة بعد إرسال بيانات الحساب. تحقق من اسم المستخدم وكلمة المرور.')
            continue
        marker = (result['state'], operation, result.get('target'))
        repeats = repeats + 1 if marker == previous else 0
        previous = marker
        if repeats >= 3 and operation not in ('wait', 'login'):
            raise NavigationError('navigation_stalled', 'تعذر الوصول إلى شاشة رقم الإجراء الموحد')
        time.sleep(.5)
    raise NavigationError('navigation_timeout', 'تعذر الوصول إلى شاشة رقم الإجراء الموحد')

def navigate_to_unified(job_id: str = ''):
    return ensure_unified_procedure_screen(job_id)


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


def run_navigation_test(job=None):
    check_cancelled()
    job_id = (job or {}).get('id') or ''
    ensure_unified_procedure_screen(job_id)
    check_cancelled()
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
    return run_navigation_test(job)


def run_job(job):
    kind = job.get('kind')
    if kind in ('test', 'test_navigation'):
        return run_navigation_test(job)
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
        shot_name = str(result.get('screenshotName', '') or '')
        if result.get('screenshotTaken') and shot_name:
            shot_path = SCREENSHOTS / shot_name
            if shot_path.exists():
                try:
                    encoded, mime = _encode_review_screenshot(shot_path)
                    payload['screenshotBase64'] = encoded
                    payload['screenshotMime'] = mime
                except Exception:
                    pass
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
    global AGENT_STATE, CURRENT_CANCEL_EVENT
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
                cancel_event = threading.Event()
                watcher_done = threading.Event()
                CURRENT_CANCEL_EVENT = cancel_event
                watcher = threading.Thread(
                    target=cancellation_watcher,
                    args=(str(job['id']), cancel_event, watcher_done),
                    daemon=True
                )
                watcher.start()
                try:
                    check_cancelled()
                    completion.update(ok=True, result=run_job(job))
                    check_cancelled()
                except Exception as exc:
                    code = getattr(exc, 'code', 'agent_error')
                    cancelled = code == 'cancelled_by_user'
                    AGENT_STATE = 'ONLINE'
                    path = None if cancelled else _safe_error_screenshot()
                    completion.update(
                        ok=False,
                        error='' if cancelled else (str(exc) if isinstance(exc, NavigationError) else 'تعذر الوصول إلى شاشة رقم الإجراء الموحد'),
                        result={
                            'statusCode': code,
                            'message': 'تم إيقاف الطلب بواسطة المستخدم.' if cancelled else '',
                            'screenshotTaken': bool(path),
                            'screenshotName': path.name if path else ''
                        }
                    )
                    log(('Job cancelled: ' if cancelled else 'Job stopped: ') + code + ' | reason: ' + str(exc))
                    if not cancelled:
                        try:
                            diag_dir = BASE / 'diagnostics'
                            diag_dir.mkdir(exist_ok=True)
                            snap = HELPER.call('snapshot', timeout=10)
                            (diag_dir / 'last-ui-state.json').write_text(
                                json.dumps(snap, ensure_ascii=False, indent=2), encoding='utf-8'
                            )
                        except Exception:
                            pass
                finally:
                    watcher_done.set()
                    CURRENT_CANCEL_EVENT = None
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

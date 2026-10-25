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
from navigation import NavigationError, norm, subtree, visible

BASE = Path(__file__).resolve().parent
CONFIG_PATH = BASE / 'config.json'
SCREENSHOTS = BASE / 'screenshots'
SERVICE = 'TarabilCustomsAgent'
VERSION = '9.2.0-regression-safe-core'
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


def _wrapper_rect(win):
    try:
        r = win.rectangle()
        return int(r.left), int(r.top), int(r.right), int(r.bottom)
    except Exception:
        try:
            return int(win.left), int(win.top), int(win.left + win.width), int(win.top + win.height)
        except Exception:
            return 0, 0, 0, 0


def _rect_area(rect):
    l, t, r, b = rect
    return max(0, r-l) * max(0, b-t)


def _asycuda_top_windows():
    """Enumerate visible top-level ASYCUDA Java windows.

    Swing occasionally exposes a modal JOptionPane as a separate native top-level
    window while Java Access Bridge continues to report the main frame.  This is
    the exact case that previously left jobs spinning forever.
    """
    found = []
    seen = set()
    for backend in ('win32', 'uia'):
        try:
            for win in Desktop(backend=backend).windows(visible_only=True):
                try:
                    title = (win.window_text() or '').strip()
                except Exception:
                    title = ''
                if 'asycudaworld production server' not in title.casefold():
                    continue
                try:
                    hwnd = int(win.handle)
                except Exception:
                    hwnd = 0
                key = hwnd or (backend, title, _wrapper_rect(win))
                if key in seen:
                    continue
                seen.add(key)
                found.append({'wrapper': win, 'backend': backend, 'hwnd': hwnd, 'title': title, 'rect': _wrapper_rect(win)})
        except Exception:
            continue
    return found


def _find_asycuda_modal_window():
    """Return a separate small ASYCUDA window that is blocking the main frame.

    We deliberately use geometry + title, not the dialog text.  This catches old
    Java 8 JOptionPane windows even when JAB/UIA exposes no useful child text.
    The main frame is the largest matching ASYCUDA window; a candidate must be
    substantially smaller and spatially overlap the main frame.
    """
    wins = _asycuda_top_windows()
    if len(wins) < 2:
        return None
    main = max(wins, key=lambda x: _rect_area(x['rect']))
    main_area = _rect_area(main['rect'])
    if main_area <= 0:
        return None
    ml, mt, mr, mb = main['rect']
    candidates = []
    for item in wins:
        if item is main or (item['hwnd'] and item['hwnd'] == main['hwnd']):
            continue
        area = _rect_area(item['rect'])
        if area <= 0 or area >= main_area * 0.72:
            continue
        l,t,r,b = item['rect']
        overlap = max(0, min(r,mr)-max(l,ml)) * max(0, min(b,mb)-max(t,mt))
        if overlap <= 0:
            continue
        candidates.append(item)
    if not candidates:
        return None
    # Prefer the top-most/smallest modal-like window.
    return min(candidates, key=lambda x: _rect_area(x['rect']))


def _modal_identity(item):
    if not item:
        return ''
    return f"{item.get('hwnd',0)}:{item.get('title','')}:{item.get('rect')}"


def _dismiss_native_modal(expected_identity: str = ''):
    item = _find_asycuda_modal_window()
    if not item:
        return True
    if expected_identity and _modal_identity(item) != expected_identity:
        # The screen changed while the operator was reviewing it; do not close a
        # different dialog by mistake. It will be presented as a fresh review.
        return False
    win = item['wrapper']
    try:
        win.set_focus()
    except Exception:
        try:
            win.set_focus()
        except Exception:
            pass
    # First try the semantic Cancel action.
    try:
        send_keys('{ESC}')
    except Exception:
        pyautogui.press('esc')
    time.sleep(.9)
    if not _find_asycuda_modal_window():
        return True
    # If Escape is ignored, emulate the title-bar X/WM_CLOSE after the user has
    # explicitly chosen "close the open page and continue".  Any confirmation
    # created by the close is detected on the next loop and reviewed separately.
    try:
        win.close()
    except Exception:
        pass
    time.sleep(.9)
    return _find_asycuda_modal_window() is None


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


def _configured_official_jnlp() -> tuple[bool, str]:
    """Validate the currently configured JNLP without launching it.

    This is used by every Security Warning guard, including warnings left from
    an immediately previous Java Web Start attempt. It keeps the auto-accept
    invariant tied to the official HTTPS ASYCUDA launcher.
    """
    try:
        asy = CFG.get('asycuda', {})
        jnlp = str(asy.get('jnlp_path') or '')
        if jnlp and not os.path.isabs(jnlp):
            jnlp = str((BASE / jnlp).resolve())
        if not jnlp or not Path(jnlp).exists():
            return False, 'configured JNLP is missing'
        return _official_jnlp_source(jnlp)
    except Exception as exc:
        return False, f'configured JNLP validation failed: {type(exc).__name__}: {exc}'


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

    # Security Warning is a mandatory first-class step in every job. A warning
    # can remain visible from the immediately previous Java Web Start attempt.
    # If our configured launcher is the verified official ASYCUDA JNLP, accept
    # that warning before launching another instance instead of failing the job.
    preexisting_warning, _ = _security_dialog()

    trusted_jnlp, trust_detail = _official_jnlp_source(jnlp)
    if not trusted_jnlp:
        raise NavigationError(
            'manual_intervention_required',
            'The configured JNLP is not the verified HTTPS asy.mof.gov.iq launcher. ' + trust_detail
        )

    if preexisting_warning is not None:
        log('Verified official Java Security Warning already visible; accepting it before continuing...')
        _click_security_warning_if_present(12, trusted_launch=True)
        try:
            win = _wait_for_asycuda_window(18)
            focus_window(win)
            return True
        except Exception:
            # The old warning may have belonged to a launch that did not finish.
            # Continue by launching the same verified JNLP once.
            pass

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
        'NOTIFICATIONS_POPUP': ('ظهرت صفحة الإشعارات', 'تم إيقاف سير العمل مؤقتاً لأن نافذة إشعارات ASYCUDA ظهرت. راجع الصورة داخل تفاصيل الطلب ثم اختر إغلاق الصفحة المفتوحة والمتابعة أو إبقاءها وإيقاف الطلب.'),
        'NOTIFICATIONS_PAGE': ('صفحة الإشعارات مفتوحة', 'وجد النظام صفحة إشعارات أو رسائل مفتوحة داخل ASYCUDA. راجع الصورة داخل تفاصيل الطلب ثم اختر هل تريد إغلاق الصفحة المفتوحة ومتابعة الوصول إلى رقم الإجراء الموحد.'),
        'OTHER_PAGE_OPEN': ('توجد صفحة أخرى مفتوحة', 'وجد النظام صفحة داخلية غير متوقعة مفتوحة في ASYCUDA. تم إيقاف الطلب مؤقتاً حتى تقرر هل تريد إغلاق الصفحة المفتوحة والمتابعة أو إيقاف الطلب الحالي.'),
        'PREDECLARATION_OPEN': ('يوجد بيان مسبق مفتوح', 'وجد النظام بياناً مسبقاً مفتوحاً قبل الوصول إلى رقم الإجراء الموحد. راجع الصورة داخل تفاصيل الطلب ثم قرر هل تريد إغلاق الصفحة ومتابعة رقم الإجراء الموحد أو إبقاءها وإيقاف الطلب.'),
        'DECLARATION_OPEN': ('يوجد بيان مفتوح', 'وجد النظام بياناً مفتوحاً داخل ASYCUDA. راجع الصورة داخل تفاصيل الطلب ثم قرر هل تريد إغلاق الصفحة ومتابعة رقم الإجراء الموحد أو إبقاءها وإيقاف الطلب.'),
        'UNKNOWN_POPUP': ('ظهرت نافذة غير معروفة', 'لن يضغط النظام أي زر داخل هذه النافذة قبل قرارك. ستظهر الصورة داخل تفاصيل الطلب لتحدد هل تريد إيقاف الطلب أو إغلاق النافذة والمتابعة.'),
        'MANUAL_INTERVENTION': ('تحتاج الشاشة إلى قرار', 'ظهرت نافذة حفظ أو تأكيد أو حالة حساسة. أوقف النظام التنفيذ مؤقتاً ورفع صورة الشاشة إلى تفاصيل الطلب بانتظار قرارك.'),
        'UNKNOWN_SCREEN': ('توقفت الملاحة على شاشة غير متوقعة', 'لم يتمكن النظام من التقدم بأمان داخل ASYCUDA. تم إيقاف الطلب مؤقتاً ورفع صورة الشاشة حتى تختار إغلاق الشاشة المفتوحة والمتابعة أو إيقاف الطلب.'),
        'CLOSE_FAILED': ('تعذر إغلاق الشاشة السابقة', 'لم يعتبر النظام عملية الإغلاق ناجحة لأن الشاشة التي تمت مراجعتها ما زالت موجودة أو تغيرت أثناء التنفيذ. تم التقاط صورة جديدة ولم يتم الضغط على نافذة أخرى.'),
        'PROCEDURE_CREATED_WAITING_COMPLETION': ('تم إنشاء رقم الإجراء — بانتظار قرار الإنجاز', 'تم تنفيذ إنشاء رقم الإجراء الموحد ورفع صورة النتيجة. راجع الرقم في الصورة، وإذا تريد إنهاء الصفحة اضغط نعم، أنجز الرقم. إذا تريد الانتظار لا تضغط شيئاً وسيبقى الطلب متوقفاً هنا.'),
        'FINAL_CONFIRMATION_FAILED': ('تعذر تأكيد إنجاز الرقم', 'لم يتمكن النظام من تحديد زر التأكيد النهائي بأمان. راجع الصورة واتخذ قراراً جديداً دون تنفيذ ضغط عشوائي.'),
    }
    return mapping.get(state, ('ظهرت شاشة غير متوقعة', 'تم إيقاف الطلب مؤقتاً حتى تراجع الشاشة وتحدد الإجراء المناسب.'))



def _target_rect(metadata: dict | None):
    metadata = metadata or {}
    target = metadata.get('target') or {}
    b = target.get('bounds') or {}
    try:
        x, y = int(b.get('x') or 0), int(b.get('y') or 0)
        w, h = int(b.get('width') or 0), int(b.get('height') or 0)
        if w > 0 and h > 0:
            return (x, y, x + w, y + h)
    except Exception:
        pass
    rect = metadata.get('rect') or ()
    if isinstance(rect, (list, tuple)) and len(rect) == 4:
        try:
            return tuple(int(v) for v in rect)
        except Exception:
            pass
    return None


def _review_metadata(current: dict | None, state: str, extra: dict | None = None):
    current = current or {}
    data = {
        'observedState': state,
        'capturedAt': time.strftime('%Y-%m-%dT%H:%M:%S'),
        'target': current.get('target') or {},
    }
    snap = current.get('snapshot') or {}
    if snap:
        data['mainHwnd'] = int(snap.get('mainHwnd') or 0)
        data['pid'] = int(snap.get('pid') or 0)
        data['javaWindows'] = snap.get('javaWindows') or []
    if extra:
        data.update(extra)
    return data


def _progress(job_id: str, code: str, message: str):
    if not job_id:
        return
    try:
        requests.post(
            api_url(f'/api/agent/jobs/{job_id}/progress'),
            headers=cloud_headers(), json={'statusCode': code, 'message': message}, timeout=8
        ).raise_for_status()
    except Exception:
        pass


def _norm_target_text(value):
    return ' '.join(str(value or '').replace('أ','ا').replace('إ','ا').replace('آ','ا').split()).casefold()


def _target_matches(expected: dict, actual: dict):
    if not expected or not actual:
        return False
    ek, ak = str(expected.get('kind') or ''), str(actual.get('kind') or '')
    if ek and ak and ek != ak:
        return False
    eh, ah = int(expected.get('windowHwnd') or 0), int(actual.get('windowHwnd') or 0)
    if eh and ah and eh != ah:
        return False
    en, an = _norm_target_text(expected.get('name')), _norm_target_text(actual.get('name'))
    if en and an and en != an:
        return False
    eb, ab = expected.get('bounds') or {}, actual.get('bounds') or {}
    try:
        if eb and ab:
            ecx = int(eb.get('x',0)) + int(eb.get('width',0)) // 2
            ecy = int(eb.get('y',0)) + int(eb.get('height',0)) // 2
            acx = int(ab.get('x',0)) + int(ab.get('width',0)) // 2
            acy = int(ab.get('y',0)) + int(ab.get('height',0)) // 2
            if abs(ecx-acx) > 80 or abs(ecy-acy) > 80:
                return False
    except Exception:
        pass
    return True


def _current_review_target():
    try:
        current = HELPER.call('snapshot')
        return current, current.get('target') or {}
    except Exception:
        return {}, {}


def _hwnd_exists(hwnd: int):
    if not hwnd:
        return False
    try:
        import win32gui
        return bool(win32gui.IsWindow(int(hwnd)) and win32gui.IsWindowVisible(int(hwnd)))
    except Exception:
        try:
            Desktop(backend='win32').window(handle=int(hwnd)).window_text()
            return True
        except Exception:
            return False


def _close_exact_top_window(target: dict):
    hwnd = int(target.get('windowHwnd') or 0)
    if not hwnd or target.get('windowMain'):
        return False
    if not _hwnd_exists(hwnd):
        return True
    try:
        win = Desktop(backend='win32').window(handle=hwnd)
        title = (win.window_text() or '').casefold()
        if 'asycudaworld production server' not in title:
            return False
        win.set_focus()
        time.sleep(.15)
        win.close()
    except Exception:
        return False
    deadline = time.monotonic() + 4.0
    while time.monotonic() < deadline:
        check_cancelled()
        if not _hwnd_exists(hwnd):
            return True
        time.sleep(.15)
    return False


def _close_exact_internal_frame(expected: dict):
    current, actual = _current_review_target()
    if not _target_matches(expected, actual):
        return False
    b = actual.get('bounds') or {}
    try:
        x, y = int(b.get('x') or 0), int(b.get('y') or 0)
        w, h = int(b.get('width') or 0), int(b.get('height') or 0)
    except Exception:
        return False
    if w < 80 or h < 50:
        return False
    win = find_asycuda_window()
    if not win:
        return False
    focus_window(win)
    # Focus the exact internal frame by its live JAB bounds, then use Swing's
    # standard Ctrl+F4 close command. These are live coordinates, never saved
    # desktop coordinates.
    pyautogui.click(x + max(30, min(w // 3, 140)), y + min(14, max(6, h // 20)))
    time.sleep(.18)
    pyautogui.hotkey('ctrl', 'f4')
    deadline = time.monotonic() + 4.0
    while time.monotonic() < deadline:
        check_cancelled()
        now, target = _current_review_target()
        if now.get('state') != current.get('state') or not _target_matches(expected, target):
            return True
        time.sleep(.18)
    return False


def take_review_screenshot(label: str, metadata: dict | None = None):
    win = find_asycuda_window()
    if not win or win.isMinimized:
        raise NavigationError('screenshot_failed', 'تعذر التقاط نافذة الأسيكودا')
    left, top = int(win.left), int(win.top)
    right, bottom = left + int(win.width), top + int(win.height)
    tr = _target_rect(metadata)
    if tr:
        tl, tt, tright, tbottom = tr
        left, top = min(left, tl), min(top, tt)
        right, bottom = max(right, tright), max(bottom, tbottom)
    pad = 8
    left, top = max(0, left-pad), max(0, top-pad)
    width, height = max(1, right-left+pad), max(1, bottom-top+pad)
    img = pyautogui.screenshot(region=(left, top, width, height))
    safe = ''.join(c for c in str(label) if c.isascii() and (c.isalnum() or c in '-_')) or 'review'
    filename = f'{safe}_{time.strftime("%Y-%m-%d_%H-%M-%S")}_{time.time_ns() % 1000000:06d}.png'
    path = SCREENSHOTS / filename
    img.save(path)
    return path

def _encode_review_screenshot(path: Path):
    with Image.open(path) as img:
        img = img.convert('RGB')
        img.thumbnail((1400, 1000))
        buf = io.BytesIO()
        img.save(buf, format='JPEG', quality=72, optimize=True)
    return base64.b64encode(buf.getvalue()).decode('ascii'), 'image/jpeg'


def _send_review(job_id: str, state: str, metadata: dict | None = None):
    title, message = _review_copy(state)
    path = take_review_screenshot('review-' + state.lower(), metadata)
    encoded, mime = _encode_review_screenshot(path)
    payload = {
        'state': state,
        'title': title,
        'message': message,
        'screenshotMime': mime,
        'screenshotBase64': encoded,
        'metadata': metadata or {},
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
            time.sleep(.55)
    if response is None or not response.ok:
        raise NavigationError('review_upload_failed', f'تعذر رفع صورة المراجعة إلى النظام: {last_error or "network error"}')
    review = response.json().get('review') or {}
    review_id = str(review.get('id') or '')
    if not review_id:
        raise NavigationError('review_upload_failed', 'تعذر إنشاء مراجعة الشاشة داخل النظام')
    log(f'Job paused for review: {state} | review={review_id}')
    return review_id


def _dismiss_review_screen(state: str, metadata: dict | None = None):
    metadata = metadata or {}
    target = metadata.get('target') or {}

    # Native modal captured by the OS watchdog: close exactly the reviewed HWND.
    if state == 'OS_MODAL_BLOCKER':
        expected = f"{metadata.get('hwnd',0)}:{metadata.get('title','')}:{tuple(metadata.get('rect') or ())}"
        return _dismiss_native_modal(expected)

    # A separate Java dialog/window: close only that exact HWND, never the main frame.
    if target.get('kind') in ('java_window', 'jab_popup') and int(target.get('windowHwnd') or 0) and not target.get('windowMain'):
        return _close_exact_top_window(target)

    # An MDI page such as declaration / pre-declaration / notifications page.
    if target.get('kind') == 'internal_frame' or state in ('DECLARATION_OPEN', 'PREDECLARATION_OPEN', 'NOTIFICATIONS_PAGE', 'OTHER_PAGE_OPEN'):
        return _close_exact_internal_frame(target)

    # Embedded notification dialog in the main Swing frame: only use Escape after
    # confirming that the same reviewed target/state is still present.
    current, actual = _current_review_target()
    if state == 'NOTIFICATIONS_POPUP' and current.get('state') == state and (not target or _target_matches(target, actual)):
        win = find_asycuda_window()
        if win:
            focus_window(win)
        pyautogui.press('esc')
        deadline = time.monotonic() + 3.0
        while time.monotonic() < deadline:
            check_cancelled()
            now, now_target = _current_review_target()
            if now.get('state') != state or (target and not _target_matches(target, now_target)):
                return True
            time.sleep(.18)
        return False

    # Unknown/sensitive states are not closed by a blind key press. The user will
    # receive a fresh screenshot instead of risking the wrong ASYCUDA window.
    return False


def _wait_for_review_decision(job_id: str, review_id: str, state: str, metadata: dict | None = None):
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
                time.sleep(.45)
                continue
            decision = str(review.get('decision') or '')
            if not decision:
                time.sleep(.45)
                continue
            if decision in ('stop', 'keep_and_stop'):
                raise NavigationError('cancelled_by_user', 'تم إيقاف الطلب بواسطة المستخدم')
            if decision == 'dismiss_and_resume':
                _progress(job_id, 'closing_reviewed_screen', 'جاري إغلاق نفس الشاشة التي تمت مراجعتها...')
                closed = _dismiss_review_screen(state, metadata)
                if not closed:
                    log('Reviewed screen did not close or changed before the action; requesting a fresh review.')
                    try:
                        requests.post(
                            api_url(f'/api/agent/jobs/{job_id}/review-resolved'),
                            headers=cloud_headers(), json={'reviewId': review_id}, timeout=12
                        ).raise_for_status()
                    except Exception:
                        pass
                    return 'close_failed'
                _progress(job_id, 'resuming_navigation', 'تم إغلاق الشاشة. جاري المتابعة تلقائياً إلى رقم الإجراء الموحد...')
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


def _unified_submit_live_fallback() -> bool:
    current = HELPER.call('snapshot')
    if current.get('state') != 'UNIFIED_PROCEDURE_OPEN':
        return False
    snap=current.get('snapshot') or {}; nodes=snap.get('nodes') or []
    frame_id=current.get('frame'); frame=next((n for n in nodes if str(n.get('id'))==str(frame_id)),None)
    if not frame: return False
    scope=subtree(nodes,frame)
    fb=frame.get('bounds') or {}; fy=int(fb.get('y',0)); fh=max(1,int(fb.get('height',0)))
    icons=[]
    for n in scope:
        if n.get('role')!='push button' or not visible(n) or 'enabled' not in n.get('states',[]): continue
        b=n.get('bounds') or {}; w=int(b.get('width',0)); h=int(b.get('height',0)); y=int(b.get('y',0))
        if 8<=w<=70 and 8<=h<=70 and fy<=y<=fy+max(90,int(fh*.18)):
            icons.append(n)
    icons=sorted(icons,key=lambda n:int((n.get('bounds') or {}).get('x',0)))
    if not (3<=len(icons)<=8): return False
    return _click_live_node(icons[-2])


def _affirm_popup_live_fallback() -> bool:
    current=HELPER.call('snapshot'); snap=current.get('snapshot') or {}; nodes=snap.get('nodes') or []
    candidates=[n for n in nodes if n.get('role')=='push button' and visible(n) and 'enabled' in n.get('states',[]) and not n.get('windowMain')]
    if len(candidates)!=2:
        # Fall back to the currently detected dialog subtree if Java reports the
        # popup inside the main HWND rather than as its own top-level window.
        popups=[n for n in nodes if visible(n) and (n.get('role') in ('alert','dialog','option pane') or 'modal' in n.get('states',[]))]
        if popups:
            scope=subtree(nodes,popups[0])
            candidates=[n for n in scope if n.get('role')=='push button' and visible(n) and 'enabled' in n.get('states',[])]
    if len(candidates)!=2: return False
    def box(n):
        b=n.get('bounds') or {}; return (int(b.get('x',0)),int(b.get('y',0)),int(b.get('width',0)),int(b.get('height',0)))
    candidates=sorted(candidates,key=lambda n:box(n)[0]); l,r=candidates
    if abs(box(l)[1]-box(r)[1])>max(12,max(box(l)[3],box(r)[3])//2): return False
    return _click_live_node(r)


def _submit_unified_action():
    try:
        return HELPER.call('submit_unified_procedure')
    except NavigationError as exc:
        if exc.code not in ('submit_button_not_found','jab_unavailable','helper_unavailable'):
            raise
        if not _unified_submit_live_fallback():
            raise
        return {'operation':'procedure_submitted','method':'live_bounds_fallback'}


def _affirm_final_popup_action():
    try:
        return HELPER.call('affirm_current_popup')
    except NavigationError as exc:
        if exc.code not in ('final_confirmation_ambiguous','jab_unavailable','helper_unavailable'):
            raise
        if not _affirm_popup_live_fallback():
            raise
        return {'operation':'final_confirmation_clicked','method':'live_bounds_fallback'}


def _wait_for_completion_decision(job_id: str, review_id: str):
    """Wait after a real procedure number is created.

    No completion click is executed until the operator explicitly confirms it
    from the web details page.
    """
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
                time.sleep(.35)
                continue
            decision = str(review.get('decision') or '')
            if not decision:
                time.sleep(.35)
                continue
            if decision in ('stop', 'keep_and_stop'):
                raise NavigationError('cancelled_by_user', 'تم إيقاف الطلب بواسطة المستخدم')
            if decision != 'finalize_and_complete':
                raise NavigationError('invalid_review_decision', 'قرار إنجاز رقم الإجراء غير مدعوم')
            _progress(job_id, 'finalizing_procedure', 'تمت الموافقة. جاري تأكيد إنجاز رقم الإجراء الموحد...')
            try:
                result = _affirm_final_popup_action()
                log('Final procedure confirmation clicked through JAB: ' + str(result.get('operation','')))
            except NavigationError as exc:
                # Some builds display the generated number first and only show
                # the completion popup after clicking the same check control once more.
                if exc.code != 'final_confirmation_ambiguous':
                    raise
                _submit_unified_action()
                time.sleep(.45)
                result = _affirm_final_popup_action()
                log('Final procedure confirmation opened and accepted through JAB.')
            try:
                requests.post(
                    api_url(f'/api/agent/jobs/{job_id}/review-resolved'),
                    headers=cloud_headers(), json={'reviewId': review_id}, timeout=12
                ).raise_for_status()
            except Exception:
                pass
            return 'finalize_and_complete'
        except NavigationError:
            raise
        except Exception:
            time.sleep(1.0)


def _click_live_node(node: dict, clicks: int = 1, interval: float = .04) -> bool:
    b = node.get('bounds') or {}
    try:
        x = int(b.get('x') or 0); y = int(b.get('y') or 0)
        w = int(b.get('width') or 0); h = int(b.get('height') or 0)
    except Exception:
        return False
    if w < 4 or h < 4:
        return False
    win = find_asycuda_window()
    if not win:
        return False
    focus_window(win)
    cx, cy = x + w // 2, y + h // 2
    if int(clicks) >= 2:
        pyautogui.doubleClick(cx, cy, interval=max(.02, float(interval)))
    else:
        pyautogui.click(cx, cy)
    return True


def _main_screen_live_click_fallback(job_id: str = '') -> bool:
    """Ultra-fast live-bounds navigation for the clean ASYCUDA main screen.

    This Iraqi Swing tree requires a double-click to open the Unified Procedure
    folder and another double-click to open the Unified Procedure Number page.
    Targets are read live from JAB on every attempt; no stored coordinates are
    used.
    """
    current = HELPER.call('snapshot')
    if current.get('state') != 'MAIN_SCREEN':
        return False
    nodes = current.get('snapshot', {}).get('nodes', [])
    visible_nodes = [n for n in nodes if 'showing' in n.get('states', [])]
    folder_names = {norm('الإجراء الموحد'), norm('الاجراء الموحد'), norm('Unified Procedure')}
    page_names = {norm('رقم الإجراء الموحد'), norm('Unified Procedure Number')}

    def matches(source, names):
        return [n for n in source if norm(n.get('name','')) in names and int((n.get('bounds') or {}).get('width',0) or 0) > 0]

    # If the page is already visible, open it immediately with the two clicks
    # required by this client build.
    pages = matches(visible_nodes, page_names)
    if pages:
        _progress(job_id, 'fast_open_unified_page', 'فتح رقم الإجراء الموحد...')
        return _click_live_node(pages[0], clicks=2, interval=.035)

    folders = matches(visible_nodes, folder_names)
    if not folders:
        return False

    folder = folders[0]
    _progress(job_id, 'fast_expand_unified_folder', 'فتح مجلد الإجراء الموحد...')
    # Only double-click a collapsed folder. If accessibility already reports it
    # expanded, leave it open and proceed straight to the child page.
    if 'expanded' not in folder.get('states', []):
        if not _click_live_node(folder, clicks=2, interval=.035):
            return False

    # Poll at event-loop speed for the child to become visible. Maximum wait is
    # ~0.6s, not a multi-second fixed delay.
    for _ in range(12):
        check_cancelled()
        time.sleep(.05)
        refreshed = HELPER.call('snapshot')
        state = str(refreshed.get('state') or '')
        if state != 'MAIN_SCREEN':
            # A popup/page appeared; the outer loop will review/handle it.
            return True
        nodes2 = refreshed.get('snapshot', {}).get('nodes', [])
        visible2 = [n for n in nodes2 if 'showing' in n.get('states', [])]
        pages2 = matches(visible2, page_names)
        if pages2:
            _progress(job_id, 'fast_open_unified_page', 'فتح رقم الإجراء الموحد...')
            return _click_live_node(pages2[0], clicks=2, interval=.035)
    return True


def _fast_main_navigation(job_id: str = '', max_steps: int = 6):
    """Fast path from a confirmed clean main screen.

    Prefer live-bounds double-click navigation because this ASYCUDA tree opens
    both the folder and document on double-click. JAB semantic actions remain
    the secondary fallback.
    """
    review_states = {
        'NOTIFICATIONS_POPUP', 'NOTIFICATIONS_PAGE', 'PREDECLARATION_OPEN',
        'DECLARATION_OPEN', 'OTHER_PAGE_OPEN', 'UNKNOWN_POPUP',
        'MANUAL_INTERVENTION', 'UNKNOWN_SCREEN', 'OS_MODAL_BLOCKER'
    }
    last = None
    for _ in range(max_steps):
        check_cancelled()
        if _security_dialog():
            return {'state': 'SECURITY_WARNING', 'operation': 'wait'}
        native_modal = _find_asycuda_modal_window() if job_id else None
        if native_modal:
            return {'state': 'OS_MODAL_BLOCKER', 'operation': 'review'}
        current = HELPER.call('snapshot')
        state = str(current.get('state') or '')
        if state in review_states or state == 'LOGIN':
            return {'state': state, 'operation': 'review' if state in review_states else 'login'}
        if state == 'UNIFIED_PROCEDURE_OPEN':
            return {'state': state, 'operation': 'ready'}
        if state == 'MAIN_SCREEN' and _main_screen_live_click_fallback(job_id):
            # Re-read immediately; if the page is already open, finish in this
            # same burst. Otherwise the next fast iteration continues.
            time.sleep(.04)
            verify = HELPER.call('snapshot')
            vstate = str(verify.get('state') or '')
            if vstate == 'UNIFIED_PROCEDURE_OPEN':
                return {'state': vstate, 'operation': 'ready'}
            if vstate in review_states:
                return {'state': vstate, 'operation': 'review'}
            last = {'state': vstate or 'MAIN_SCREEN', 'operation': 'click'}
            continue
        result = HELPER.call('step')
        last = result
        state = str(result.get('state') or '')
        operation = str(result.get('operation') or 'wait')
        log('ASYCUDA fast path: ' + state + ' | operation=' + operation)
        if state in review_states or state == 'LOGIN' or operation == 'ready':
            return result
        if operation not in ('click', 'expand'):
            return result
        time.sleep(.04)
    return last or {'state': 'MAIN_SCREEN', 'operation': 'wait'}


def ensure_unified_procedure_screen(job_id: str = ''):
    launch_asycuda()
    deadline = time.monotonic() + 600
    login_sent = False
    previous, repeats = None, 0
    skip_review_once = None
    review_states = {'NOTIFICATIONS_POPUP', 'NOTIFICATIONS_PAGE', 'PREDECLARATION_OPEN', 'DECLARATION_OPEN', 'OTHER_PAGE_OPEN', 'UNKNOWN_POPUP', 'MANUAL_INTERVENTION', 'UNKNOWN_SCREEN', 'OS_MODAL_BLOCKER'}
    while time.monotonic() < deadline:
        check_cancelled()
        if _security_dialog():
            trusted_warning, warning_detail = _configured_official_jnlp()
            if not trusted_warning:
                raise NavigationError('manual_intervention_required', 'Security Warning appeared but official JNLP validation failed: ' + warning_detail)
            _click_security_warning_if_present(12, trusted_launch=True)
            previous, repeats = None, 0
            continue
        try:
            current = HELPER.call('snapshot')
            state = str(current.get('state') or 'LOADING')
        except NavigationError as exc:
            if exc.code not in ('jab_unavailable', 'helper_unavailable'):
                raise
            time.sleep(.18)
            continue

        # Native Java modal watchdog. Old Java 8 can place JOptionPane in a
        # separate HWND that is invisible to the main JAB tree. Do this after
        # snapshot so the legitimate LOGIN dialog is never mistaken for review.
        if job_id and state != 'LOGIN':
            native_modal = _find_asycuda_modal_window()
            if native_modal:
                identity = _modal_identity(native_modal)
                metadata = {
                    'nativeWindow': True,
                    'title': native_modal.get('title',''),
                    'hwnd': native_modal.get('hwnd',0),
                    'rect': list(native_modal.get('rect') or ()),
                }
                log('Native ASYCUDA modal detected; pausing job for review: ' + identity)
                review_id = _send_review(job_id, 'OS_MODAL_BLOCKER', metadata)
                decision = _wait_for_review_decision(job_id, review_id, 'OS_MODAL_BLOCKER', metadata)
                if decision == 'dismiss_and_resume':
                    # _wait_for_review_decision already performs the close. If a
                    # confirmation appears, the next loop catches it as a new review.
                    pass
                previous, repeats = None, 0
                continue

        if job_id and state in review_states and skip_review_once != state:
            metadata = _review_metadata(current, state)
            review_id = _send_review(job_id, state, metadata)
            decision = _wait_for_review_decision(job_id, review_id, state, metadata)
            if decision == 'resume':
                skip_review_once = state
            else:
                skip_review_once = None
            if decision == 'close_failed':
                try:
                    refreshed = HELPER.call('snapshot')
                    failed_meta = _review_metadata(refreshed, 'CLOSE_FAILED')
                    failed_id = _send_review(job_id, 'CLOSE_FAILED', failed_meta)
                    _wait_for_review_decision(job_id, failed_id, 'CLOSE_FAILED', failed_meta)
                except NavigationError:
                    raise
                except Exception:
                    pass
            previous, repeats = None, 0
            continue
        if skip_review_once == state:
            skip_review_once = None

        try:
            # When ASYCUDA is already on its clean main screen, navigate the
            # document tree immediately.  Each burst step re-reads JAB first,
            # so safety/review states still preempt navigation instantly.
            if state == 'MAIN_SCREEN' and not skip_review_once:
                result = _fast_main_navigation(job_id)
            else:
                result = HELPER.call('step')
            check_cancelled()
        except NavigationError as exc:
            if exc.code in ('unknown_popup', 'manual_intervention_required') and job_id:
                state = 'UNKNOWN_POPUP' if exc.code == 'unknown_popup' else 'MANUAL_INTERVENTION'
                metadata = _review_metadata(current, state)
                review_id = _send_review(job_id, state, metadata)
                _wait_for_review_decision(job_id, review_id, state, metadata)
                continue
            if exc.code not in ('jab_unavailable', 'helper_unavailable'):
                raise
            time.sleep(.18)
            continue
        # If the clean main screen is readable but the tree item has no JAB
        # action, click the exact live bounds of the named element. This is the
        # only mouse fallback in normal navigation and it is never based on
        # stored screen coordinates.
        if state == 'MAIN_SCREEN' and str(result.get('operation') or 'wait') == 'wait':
            try:
                if _main_screen_live_click_fallback(job_id):
                    time.sleep(.16)
                    previous, repeats = None, 0
                    continue
            except NavigationError as exc:
                if exc.code not in ('jab_unavailable','helper_unavailable'):
                    raise

        log('ASYCUDA state: ' + result['state'] + ' | planner=' + str(result.get('source','rule')))
        operation = result['operation']
        if operation == 'dismiss_notifications':
            # In interactive-review mode this should normally have been intercepted above.
            if job_id:
                current = HELPER.call('snapshot')
                metadata = _review_metadata(current, 'NOTIFICATIONS_POPUP')
                review_id = _send_review(job_id, 'NOTIFICATIONS_POPUP', metadata)
                _wait_for_review_decision(job_id, review_id, 'NOTIFICATIONS_POPUP', metadata)
            else:
                _dismiss_review_screen('NOTIFICATIONS_POPUP')
            continue
        if operation == 'ready':
            log('Unified procedure screen detected and ready.')
            _progress(job_id, 'unified_procedure_ready', 'تم الوصول إلى شاشة رقم الإجراء الموحد بنجاح.')
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
                time.sleep(.25)
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

        # Fail into interactive review instead of leaving a job spinning or
        # failing silently when a modal screen is visually blocking JAB but is
        # not exposed with a reliable role. This guarantees the operator gets
        # a screenshot and a decision point.
        if job_id and repeats >= 4 and operation == 'wait':
            current = HELPER.call('snapshot')
            metadata = _review_metadata(current, 'UNKNOWN_SCREEN')
            review_id = _send_review(job_id, 'UNKNOWN_SCREEN', metadata)
            decision = _wait_for_review_decision(job_id, review_id, 'UNKNOWN_SCREEN', metadata)
            previous, repeats = None, 0
            if decision == 'resume':
                skip_review_once = 'UNKNOWN_SCREEN'
            continue
        if repeats >= 3 and operation not in ('wait', 'login'):
            if job_id:
                current = HELPER.call('snapshot')
                metadata = _review_metadata(current, 'UNKNOWN_SCREEN')
                review_id = _send_review(job_id, 'UNKNOWN_SCREEN', metadata)
                _wait_for_review_decision(job_id, review_id, 'UNKNOWN_SCREEN', metadata)
                previous, repeats = None, 0
                continue
            raise NavigationError('navigation_stalled', 'تعذر الوصول إلى شاشة رقم الإجراء الموحد')
        time.sleep(.08)
    raise NavigationError('navigation_timeout', 'تعذر الوصول إلى شاشة رقم الإجراء الموحد')

def navigate_to_unified(job_id: str = ''):
    return ensure_unified_procedure_screen(job_id)


def create_unified_procedure(job):
    job_id = str(job.get('id') or '')
    code = ''.join(ch for ch in str(job.get('companyCode') or '') if ch.isdigit())
    if not code:
        raise NavigationError('invalid_company_code', 'رمز الشركة مطلوب للتنفيذ الحقيقي')

    _progress(job_id, 'opening_unified_procedure', 'جاري الوصول إلى شاشة رقم الإجراء الموحد...')
    ensure_unified_procedure_screen(job_id)
    check_cancelled()
    snap = HELPER.call('snapshot')
    if snap.get('state') != 'UNIFIED_PROCEDURE_OPEN':
        raise NavigationError('navigation_changed', 'تغيرت شاشة الأسيكودا قبل إدخال رمز الشركة')

    _progress(job_id, 'entering_company_code', 'جاري إدخال رمز الشركة وتثبيته...')
    filled = HELPER.call('set_company_code', company_code=code)
    b = filled.get('bounds') or {}
    # Explicitly commit the company code with Enter as required by this ASYCUDA build.
    try:
        x=int(b.get('x') or 0); y=int(b.get('y') or 0); w=int(b.get('width') or 0); h=int(b.get('height') or 0)
        win=find_asycuda_window()
        if win: focus_window(win)
        if w>0 and h>0:
            pyautogui.click(x+w//2, y+h//2)
            # Numeric company codes are safe to retype after focusing the exact
            # live JAB field. This covers Java builds where send_text() updates
            # the model but the combo/editor does not visually commit it.
            pyautogui.hotkey('ctrl','a')
            pyautogui.write(code, interval=.025)
        pyautogui.press('enter')
    except Exception:
        raise NavigationError('company_commit_failed', 'تم إدخال رمز الشركة لكن تعذر إرسال Enter لتثبيته')

    # Give ASYCUDA a short event-loop turn, then let the normal review/navigation
    # policy handle any validation popup instead of guessing through it.
    time.sleep(.35)
    current = HELPER.call('snapshot')
    if current.get('state') != 'UNIFIED_PROCEDURE_OPEN':
        ensure_unified_procedure_screen(job_id)
    check_cancelled()

    _progress(job_id, 'creating_procedure', 'تم تثبيت رمز الشركة. جاري إنشاء رقم الإجراء الموحد...')
    _submit_unified_action()

    # Wait briefly for the generated number / completion dialog to render. No
    # production confirmation is clicked here.
    deadline=time.monotonic()+8.0
    last=None
    while time.monotonic()<deadline:
        check_cancelled()
        time.sleep(.25)
        try:
            last=HELPER.call('snapshot')
            # A popup/dialog or a changed visible state means the server response
            # has arrived. If the page stays open, the generated number may simply
            # have appeared in its result field; either case is ready for review.
            if last.get('state') != 'LOADING':
                break
        except NavigationError as exc:
            if exc.code not in ('jab_unavailable','helper_unavailable'):
                raise

    metadata = _review_metadata(last or {}, 'PROCEDURE_CREATED_WAITING_COMPLETION', {'companyCode': code})
    review_id = _send_review(job_id, 'PROCEDURE_CREATED_WAITING_COMPLETION', metadata)
    _progress(job_id, 'procedure_created_waiting_completion', 'تم إنشاء رقم الإجراء ورفع صورة النتيجة. بانتظار قرارك لإنجاز الرقم.')
    _wait_for_completion_decision(job_id, review_id)
    check_cancelled()

    # Allow the final confirmation to settle, then capture proof of the completed
    # state. If a new unexpected popup remains, surface it through the review loop
    # rather than clicking blindly.
    time.sleep(.65)
    try:
        after = HELPER.call('snapshot')
        if after.get('state') in ('UNKNOWN_POPUP','MANUAL_INTERVENTION','NOTIFICATIONS_POPUP'):
            state=str(after.get('state'))
            meta=_review_metadata(after,state)
            rid=_send_review(job_id,state,meta)
            _wait_for_review_decision(job_id,rid,state,meta)
    except NavigationError as exc:
        if exc.code not in ('jab_unavailable','helper_unavailable'):
            raise

    final_path = take_screenshot('unified-completed')
    return {
        'statusCode':'PROCEDURE_COMPLETED',
        'message':'تم إنشاء رقم الإجراء الموحد وتأكيد إنجازه بنجاح.',
        'unifiedProcedureNo':'',
        'whatsappSent':False,
        'screenshotTaken':True,
        'screenshotName':final_path.name,
    }


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
                json={'version': VERSION, 'state': AGENT_STATE, 'capabilities': ['jab32','screen-memory','safe-planner','native-window-watchdog','interactive-review','fast-main-navigation','production-unified-flow','company-enter-commit','operator-finalize-gate','visible-frame-review','doubleclick-fastpath','security-warning-regression-guard','review-every-open-page']}, timeout=15)
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

"""Persistent 32-bit PyJAB helper. Private stdin/stdout JSON; no network listener.
Never use JABDriver context manager: its __exit__ terminates the Java process.
"""
import contextlib
import json
import os
import struct
import sys
from pathlib import Path
from navigation import NavigationError, detect_state, subtree, visible
from intelligent_planner import IntelligentPlanner
def find_bridge_dll() -> str:
    candidates = []
    jab_home = os.environ.get('JAB_HOME', '').strip()
    if jab_home:
        candidates.append(Path(jab_home) / 'WindowsAccessBridge-32.dll')
    java_root = Path(r'C:\Program Files (x86)\Java')
    if java_root.exists():
        candidates.extend(sorted(java_root.glob('jre*/bin/WindowsAccessBridge-32.dll'), reverse=True))
        candidates.extend(sorted(java_root.glob('jdk*/jre/bin/WindowsAccessBridge-32.dll'), reverse=True))
    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    raise RuntimeError('WindowsAccessBridge-32.dll was not found. Run install-agent.bat.')

DLL = find_bridge_dll()

class Session:
    def __init__(self):
        if struct.calcsize('P') * 8 != 32:
            raise RuntimeError('JAB helper requires Python 32-bit')
        self.drivers, self.elements = {}, {}
        self.owned = set()
        self.planner = IntelligentPlanner(Path(__file__).resolve().parent)

    def release_elements(self):
        for key in self.owned:
            try: self.elements[key].release_jabelement()
            except Exception: pass
        self.elements.clear()
        self.owned.clear()

    def snapshot(self):
        import win32gui
        import win32process
        from pyjab.jabdriver import JABDriver
        self.release_elements()
        for driver in self.drivers.values(): driver._pump_messages()
        windows = []
        win32gui.EnumWindows(lambda h, _: windows.append(h) if win32gui.IsWindowVisible(h) else None, None)
        main = [h for h in windows if win32gui.GetWindowText(h).startswith('ASYCUDAWorld production server')]
        if len(main) != 1:
            raise NavigationError('jab_unavailable', 'تعذر تحديد نافذة ASYCUDA بشكل فريد')
        hwnd = main[0]
        pid = win32process.GetWindowThreadProcessId(hwnd)[1]
        if hwnd not in self.drivers:
            self.drivers[hwnd] = JABDriver(title='ASYCUDAWorld production server*', bridge_dll=DLL, timeout=12)
        bridge = self.drivers[hwnd].bridge
        handles = [h for h in windows if win32process.GetWindowThreadProcessId(h)[1] == pid and bridge.isJavaWindow(h)]
        handles.sort(key=lambda h: h == hwnd)
        for h in list(self.drivers):
            if h not in handles: self.drivers.pop(h).detach()
        nodes, truncated = [], False
        for h in windows:
            if win32process.GetWindowThreadProcessId(h)[1] == pid and h not in handles and win32gui.GetClassName(h) in ('#32770', 'SunAwtDialog'):
                nodes.append({'id': 'native-' + str(h), 'parent': None, 'role': 'dialog', 'name': 'Unrecognized native ASYCUDA dialog', 'states': ['showing'], 'action': False})
        def visit(el, parent, depth, owned=True):
            nonlocal truncated
            if len(nodes) >= 5000 or depth > 60:
                truncated = True
                if owned: el.release_jabelement()
                return
            key = str(len(nodes))
            self.elements[key] = el
            if owned: self.owned.add(key)
            role = el.role_en_us
            try:
                bounds = dict(el.bounds or {})
            except Exception:
                bounds = {}
            try:
                index_in_parent = int(el.index_in_parent)
            except Exception:
                index_in_parent = -1
            try:
                description = str(el.description or '')
            except Exception:
                description = ''
            nodes.append({'id': key, 'parent': parent, 'role': role,
                          'name': '' if role in ('text', 'password text') else el.name,
                          'description': '' if role in ('text', 'password text') else description,
                          'states': list(el.states_en_us), 'action': bool(el.accessible_action),
                          'index_in_parent': index_in_parent, 'bounds': bounds})
            for child in el.get_children(): visit(child, key, depth + 1)
        for h in handles:
            if h not in self.drivers: self.drivers[h] = JABDriver(hwnd=h, bridge_dll=DLL, timeout=8)
            self.drivers[h]._pump_messages()
            visit(self.drivers[h].root_element, None, 0, owned=False)
        return {'nodes': nodes, 'truncated': truncated}

    def request(self, request):
        snapshot = self.snapshot()
        state_info = detect_state(snapshot)
        if request['command'] == 'snapshot':
            return {'snapshot': snapshot, **state_info}
        if request['command'] == 'submit_login':
            # This ASYCUDA Java 8 build exposes the login/cancel controls as two
            # unnamed icon-only Swing buttons. Identify the login control only
            # after positively identifying the LOGIN screen and the two editable
            # credential fields. No desktop coordinates are used.
            if state_info.get('state') != 'LOGIN':
                return {'operation': 'login_already_left'}
            nodes = snapshot['nodes']
            scope = nodes
            popup_id = state_info.get('popup')
            if popup_id is not None:
                root = next((n for n in nodes if n.get('id') == str(popup_id)), None)
                if root:
                    scope = subtree(nodes, root)
            passwords = [n for n in scope if n.get('role') in ('password text', 'password') and visible(n) and 'enabled' in n.get('states', [])]
            users = [n for n in scope if n.get('role') in ('text', 'editable text') and visible(n) and 'enabled' in n.get('states', []) and 'editable' in n.get('states', [])]
            buttons = [n for n in scope if n.get('role') == 'push button' and visible(n) and 'enabled' in n.get('states', []) and n.get('action') and not str(n.get('name','')).strip()]
            if len(passwords) != 1 or len(users) != 1 or len(buttons) != 2:
                raise NavigationError('login_submit_ambiguous', f'تعذر تحديد زر الدخول بأمان (username={len(users)}, password={len(passwords)}, buttons={len(buttons)})')
            def box(n):
                b=n.get('bounds') or {}
                return (int(b.get('x',0) or 0), int(b.get('y',0) or 0), int(b.get('width',0) or 0), int(b.get('height',0) or 0))
            ordered=sorted(buttons, key=lambda n: (box(n)[0], box(n)[1]))
            left, right = ordered[0], ordered[1]
            lx,ly,lw,lh=box(left); rx,ry,rw,rh=box(right)
            # In the observed Iraqi ASYCUDA login dialog the green check button
            # is immediately to the left of the cancel-X button. Require the pair
            # to be horizontally aligned and similarly sized before using this
            # structural rule. If the UI ever changes, fail closed instead.
            aligned = abs(ly-ry) <= max(8, max(lh,rh)//2) and abs(lh-rh) <= max(8, max(lh,rh)//2)
            adjacent = rx >= lx and (rx - (lx+lw)) <= max(80, 4*max(lw,rw,1))
            if not aligned or not adjacent:
                raise NavigationError('login_submit_ambiguous', 'تغير ترتيب أزرار تسجيل الدخول في ASYCUDA ويحتاج إلى فحص')
            self.elements[left['id']].click(simulate=False)
            return {'operation': 'login_submitted', 'method': 'jab_structural_button'}
        if request['command'] != 'step':
            raise NavigationError('invalid_command', 'Unsupported helper command')
        action = self.planner.decide(snapshot)
        operation = action['operation']
        if operation in ('click', 'expand'):
            element = self.elements[action['target']]
            if operation == 'expand': element.expand(simulate=False)
            else: element.click(simulate=False)
        elif operation == 'login' and request.get('credentials'):
            # The Iraqi Java 8 login window exposes the username/password fields
            # through JAB, but the green checkmark login button is icon-only and
            # has no accessible name. Do not guess an unnamed button by index.
            # Fill the two real editable fields here; the 64-bit coordinator then
            # sends Enter, which activates Swing's default login action.
            nodes = snapshot['nodes']
            passwords = [
                n for n in nodes
                if n['role'] in ('password text', 'password')
                and 'showing' in n['states']
                and 'enabled' in n['states']
            ]
            users = [
                n for n in nodes
                if n['role'] in ('text', 'editable text')
                and 'showing' in n['states']
                and 'enabled' in n['states']
                and 'editable' in n['states']
            ]
            if len(passwords) != 1 or len(users) != 1:
                raise NavigationError(
                    'manual_intervention_required',
                    f'تعذر تحديد حقول تسجيل الدخول بأمان (username={len(users)}, password={len(passwords)})'
                )
            creds = request['credentials']
            self.elements[users[0]['id']].send_text(creds['username'], wait_for_text_update=False)
            self.elements[passwords[0]['id']].send_text(creds['password'], wait_for_text_update=False)
            action['operation'] = 'login_filled'
        return action

    def close(self):
        self.release_elements()
        for driver in self.drivers.values(): driver.detach()

def main():
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stdin.reconfigure(encoding='utf-8')
    wire, session = sys.stdout, Session()
    try:
        for line in sys.stdin:
            try:
                with contextlib.redirect_stdout(sys.stderr):
                    result = session.request(json.loads(line))
                response = {'ok': True, 'result': result}
            except NavigationError as exc:
                response = {'ok': False, 'code': exc.code, 'message': str(exc)}
            except Exception:
                response = {'ok': False, 'code': 'jab_unavailable', 'message': 'تعذر قراءة واجهة ASYCUDA عبر Java Access Bridge'}
            wire.write(json.dumps(response, ensure_ascii=True) + '\n')
            wire.flush()
    finally: session.close()

if __name__ == '__main__': main()


"""Persistent 32-bit PyJAB helper. Private stdin/stdout JSON; no network listener.
Never use JABDriver context manager: its __exit__ terminates the Java process.
"""
import contextlib
import json
import struct
import sys
from navigation import NavigationError, plan, detect_state
DLL = r'C:\Program Files (x86)\Java\jre1.8.0_202\bin\WindowsAccessBridge-32.dll'

class Session:
    def __init__(self):
        if struct.calcsize('P') * 8 != 32:
            raise RuntimeError('JAB helper requires Python 32-bit')
        self.drivers, self.elements = {}, {}
        self.owned = set()

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
            nodes.append({'id': key, 'parent': parent, 'role': role,
                          'name': '' if role in ('text', 'password text') else el.name,
                          'states': list(el.states_en_us), 'action': bool(el.accessible_action)})
            for child in el.get_children(): visit(child, key, depth + 1)
        for h in handles:
            if h not in self.drivers: self.drivers[h] = JABDriver(hwnd=h, bridge_dll=DLL, timeout=8)
            self.drivers[h]._pump_messages()
            visit(self.drivers[h].root_element, None, 0, owned=False)
        return {'nodes': nodes, 'truncated': truncated}

    def request(self, request):
        snapshot = self.snapshot()
        if request['command'] == 'snapshot':
            return {'snapshot': snapshot, **detect_state(snapshot)}
        if request['command'] != 'step':
            raise NavigationError('invalid_command', 'Unsupported helper command')
        action = plan(snapshot)
        operation = action['operation']
        if operation in ('click', 'expand'):
            element = self.elements[action['target']]
            if operation == 'expand': element.expand(simulate=False)
            else: element.click(simulate=False)
        elif operation == 'login' and request.get('credentials'):
            nodes = snapshot['nodes']
            passwords = [n for n in nodes if n['role'] == 'password text' and 'showing' in n['states']]
            users = [n for n in nodes if n['role'] == 'text' and 'showing' in n['states'] and 'editable' in n['states']]
            buttons = [n for n in nodes if n['role'] == 'push button' and n['name'].strip().casefold() in ('login', 'log in', 'تسجيل الدخول', 'دخول') and 'showing' in n['states']]
            if len(passwords) != 1 or len(users) != 1 or len(buttons) != 1:
                raise NavigationError('manual_intervention_required', 'تعذر تحديد حقول تسجيل الدخول بأمان')
            creds = request['credentials']
            self.elements[users[0]['id']].send_text(creds['username'], wait_for_text_update=False)
            self.elements[passwords[0]['id']].send_text(creds['password'], wait_for_text_update=False)
            self.elements[buttons[0]['id']].click(simulate=False)
            action['operation'] = 'login_sent'
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


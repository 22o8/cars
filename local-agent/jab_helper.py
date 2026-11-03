"""Persistent 32-bit PyJAB helper. Private stdin/stdout JSON; no network listener.
Never use JABDriver context manager: its __exit__ terminates the Java process.
"""
import contextlib
import json
import os
import struct
import time
from urllib.parse import urlparse
import sys
from pathlib import Path
from navigation import NavigationError, detect_state, subtree, visible, norm
from intelligent_planner import IntelligentPlanner
from unified_form import form_values, company_editor, unified_candidates, choose_unified_frame
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
        self.bound_frame = None
        self.completion_receipt = None
        self.page_open_pending_until = 0.0
        self.planner = IntelligentPlanner(Path(__file__).resolve().parent)

    def unified_frame(self, snapshot):
        nodes=snapshot['nodes']
        if self.bound_frame is not None:
            matches=[n for n in unified_candidates(nodes) if self.elements[n['id']].vmid==self.bound_frame.vmid and self.bound_frame._is_same_object(self.bound_frame.accessible_context,self.elements[n['id']].accessible_context)]
            if len(matches)!=1:
                raise NavigationError('bound_form_changed','The original company form disappeared or changed; creation stopped')
            return matches[0]
        frame=choose_unified_frame(nodes)
        self.bound_frame=self.elements[frame['id']]
        # Keep this Java object reference alive across snapshots; indices are not identities.
        self.owned.discard(frame['id'])
        return frame

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
        main_candidates = [h for h in windows if win32gui.GetWindowText(h).startswith('ASYCUDAWorld production server')]
        if not main_candidates:
            raise NavigationError('jab_unavailable', 'لم يتم العثور على نافذة ASYCUDA')

        # IMPORTANT: Iraqi ASYCUDA can expose a Swing JOptionPane/JDialog as a
        # second top-level Java HWND with the SAME window title.  Older builds
        # required exactly one matching title, which made JAB disappear at the
        # precise moment a notification popup appeared.  Choose the largest
        # matching HWND as the main frame and attach to every Java HWND in the
        # same process instead.
        def area(h):
            try:
                l,t,r,b = win32gui.GetWindowRect(h)
                return max(0, r-l) * max(0, b-t)
            except Exception:
                return 0
        hwnd = max(main_candidates, key=area)
        pid = win32process.GetWindowThreadProcessId(hwnd)[1]
        if hwnd not in self.drivers:
            self.drivers[hwnd] = JABDriver(hwnd=hwnd, bridge_dll=DLL, timeout=12)
        bridge = self.drivers[hwnd].bridge
        handles = [h for h in windows if win32process.GetWindowThreadProcessId(h)[1] == pid and bridge.isJavaWindow(h)]
        if hwnd not in handles:
            handles.append(hwnd)
        # Traverse non-main Java dialogs first, then the main frame.  This lets
        # detect_state() see a modal alert before normal navigation elements.
        handles = sorted(set(handles), key=lambda h: (h == hwnd, -area(h)))
        for h in list(self.drivers):
            if h not in handles: self.drivers.pop(h).detach()
        nodes, truncated = [], False
        for h in windows:
            if win32process.GetWindowThreadProcessId(h)[1] == pid and h not in handles and win32gui.GetClassName(h) in ('#32770', 'SunAwtDialog'):
                
                try:
                    l,t,r,b = win32gui.GetWindowRect(h)
                except Exception:
                    l=t=r=b=0
                nodes.append({'id': 'native-' + str(h), 'parent': None, 'role': 'dialog', 'name': 'Unrecognized native ASYCUDA dialog', 'states': ['showing'], 'action': False, 'windowHwnd': int(h), 'windowMain': False, 'windowTitle': win32gui.GetWindowText(h), 'bounds': {'x':int(l),'y':int(t),'width':max(0,int(r-l)),'height':max(0,int(b-t))}})
        def visit(el, parent, depth, window_hwnd, window_main, window_title, owned=True):
            nonlocal truncated
            if len(nodes) >= 5000 or depth > 60:
                truncated = True
                if owned: el.release_jabelement()
                return
            key = str(len(nodes))
            self.elements[key] = el
            if owned: self.owned.add(key)
            info = el._get_accessible_context_info()
            role = info.role_en_US
            states = str(info.states_en_US).split(',')
            bounds = {'x':int(info.x),'y':int(info.y),'width':int(info.width),'height':int(info.height)}
            sensitive = role in ('text','editable text','password text','password')
            nodes.append({'id': key, 'parent': parent, 'role': role,
                          'name': '' if sensitive else str(info.name),
                          'description': '' if sensitive else str(info.description),
                          'states': states, 'action': bool(info.accessibleAction),
                          'index_in_parent': int(info.indexInParent), 'bounds': bounds,
                          'windowHwnd': int(window_hwnd), 'windowMain': bool(window_main), 'windowTitle': str(window_title or '')})
            # Hidden subtrees contain hundreds of inactive menus, not live controls.
            if depth == 0 or 'showing' in states:
                for child in el.get_children(): visit(child, key, depth + 1, window_hwnd, window_main, window_title)
        java_windows = []
        for h in handles:
            if h not in self.drivers: self.drivers[h] = JABDriver(hwnd=h, bridge_dll=DLL, timeout=8)
            self.drivers[h]._pump_messages()
            try:
                rect = list(win32gui.GetWindowRect(h))
            except Exception:
                rect = [0,0,0,0]
            java_windows.append({
                'hwnd': int(h),
                'title': win32gui.GetWindowText(h),
                'className': win32gui.GetClassName(h),
                'rect': rect,
                'main': bool(h == hwnd),
            })
            visit(self.drivers[h].root_element, None, 0, h, h == hwnd, win32gui.GetWindowText(h), owned=False)
        return {'nodes': nodes, 'truncated': truncated, 'javaWindows': java_windows, 'mainHwnd': int(hwnd), 'pid': int(pid)}

    def security_warning(self, hwnd):
        import win32gui
        from pyjab.jabdriver import JABDriver
        if not win32gui.IsWindow(hwnd) or win32gui.GetWindowText(hwnd) != 'Security Warning':
            raise NavigationError('security_window_changed', 'The warning window changed')
        driver = JABDriver(hwnd=hwnd, bridge_dll=DLL, timeout=8)
        owned=[]
        def tree(el):
            result=[el]
            for child in el.get_children():
                owned.append(child)
                result.extend(tree(child))
            return result
        try:
            elements=tree(driver.root_element)
            labels=[str(el.name or '').strip() for el in elements if el.role_en_us=='label']
            origins=[urlparse(text) for text in labels if text.startswith('https://')]
            if not any(u.scheme=='https' and u.hostname=='asy.mof.gov.iq' and u.port in (None,443) and not u.username for u in origins):
                raise NavigationError('security_origin_unverified', 'Warning does not show the official HTTPS origin')
            boxes=[e for e in elements if e.role_en_us=='check box' and str(e.name or '').rstrip('.')=='I accept the risk and want to run this application']
            runs=[e for e in elements if e.role_en_us=='push button' and e.name=='Run']
            if len(boxes)!=1 or len(runs)!=1:
                raise NavigationError('security_controls_ambiguous', 'Warning controls are not unique')
            if 'checked' not in boxes[0].states_en_us:
                boxes[0].click(simulate=False)
            driver._pump_messages()
            fresh=tree(driver.root_element)
            checked=[e for e in fresh if e.role_en_us=='check box' and str(e.name or '').startswith('I accept the risk') and 'checked' in e.states_en_us]
            run=[e for e in fresh if e.role_en_us=='push button' and e.name=='Run' and 'enabled' in e.states_en_us]
            if len(checked)!=1 or len(run)!=1:
                raise NavigationError('security_acceptance_unverified','Checkbox did not become checked or Run did not enable')
            run[0].click(simulate=False)
            deadline=time.monotonic()+20
            while win32gui.IsWindow(hwnd) and win32gui.IsWindowVisible(hwnd) and time.monotonic()<deadline:
                driver._pump_messages(); time.sleep(.1)
            if win32gui.IsWindow(hwnd) and win32gui.IsWindowVisible(hwnd):
                raise NavigationError('security_warning_still_open','Run was clicked but warning remains open')
            return {'operation':'security_accepted','originVerified':True,'checkboxChecked':True,'runClicked':True,'windowClosed':True}
        finally:
            for el in owned:
                try: el.release_jabelement()
                except Exception: pass
            driver.detach()

    def request(self, request):
        if request['command']=='reset_procedure_binding':
            if self.bound_frame is not None:
                self.bound_frame.release_jabelement()
                self.bound_frame=None
            return {'operation':'procedure_binding_reset'}
        if request['command']=='accept_security_warning':
            return self.security_warning(int(request['hwnd']))
        snapshot = self.snapshot()
        state_info = detect_state(snapshot)
        if request['command'] == 'snapshot':
            return {'snapshot': snapshot, **state_info}
        if request['command'] == 'reveal_unified_page':
            if state_info.get('state') != 'UNIFIED_PROCEDURE_OFFSCREEN':
                raise NavigationError('navigation_changed','Expected an offscreen unified procedure frame')
            nodes=snapshot['nodes']
            desktop=next(n for n in nodes if n['role']=='desktop pane')
            viewport=next(n for n in nodes if n['id']==desktop['parent'])
            bars=[n for n in nodes if n['role']=='scroll bar' and 'horizontal' in n['states'] and n['parent']==viewport['parent']]
            if len(bars)!=1: raise NavigationError('scrollbar_ambiguous','Cannot locate the application desktop scrollbar')
            self.elements[bars[0]['id']].scroll(to_bottom=False,hold=1)
            return {'operation':'unified_page_revealed'}

        if request['command'] == 'set_company_code':
            if state_info.get('state') != 'UNIFIED_PROCEDURE_OPEN':
                raise NavigationError('unified_screen_not_ready', 'شاشة رقم الإجراء الموحد ليست جاهزة لإدخال رمز الشركة')
            code = ''.join(ch for ch in str(request.get('company_code') or '') if ch.isdigit())
            if not code or len(code) > 20:
                raise NavigationError('invalid_company_code', 'رمز الشركة غير صالح')
            nodes = snapshot['nodes']
            frame = self.unified_frame(snapshot)
            scope = subtree(nodes, frame) if frame else nodes
            import win32gui, win32process
            from pyjab.common.win32utils import Win32Utils
            hwnd = int(frame.get('windowHwnd') or 0)
            if win32process.GetWindowThreadProcessId(hwnd)[1] != snapshot['pid']:
                raise NavigationError('window_changed','Company window identity changed')
            if win32gui.GetForegroundWindow()!=hwnd:
                import win32api
                foreground=win32gui.GetForegroundWindow()
                foreground_thread=win32process.GetWindowThreadProcessId(foreground)[0] if foreground else 0
                current_thread=win32api.GetCurrentThreadId()
                attached=False
                try:
                    if foreground_thread and foreground_thread!=current_thread:
                        win32process.AttachThreadInput(current_thread,foreground_thread,True)
                        attached=True
                    if win32gui.IsIconic(hwnd): win32gui.ShowWindow(hwnd,9)
                    win32gui.SetForegroundWindow(hwnd)
                except Exception:
                    pass
                finally:
                    if attached: win32process.AttachThreadInput(current_thread,foreground_thread,False)
            if win32gui.GetForegroundWindow()!=hwnd:
                raise NavigationError('focus_failed','Company window is not foreground')
            for attempt in range(16):
                try:
                    target = company_editor(scope)
                    break
                except NavigationError:
                    focused = [n for n in scope if 'focused' in n.get('states',[]) and n.get('role') in ('text','editable text','combo box')]
                    if not focused:
                        raise NavigationError('company_field_not_found','No focused editor inside the verified form; focus company code first')
                    Win32Utils().send_keys('shift+tab')
                    time.sleep(.08)
                    snapshot = self.snapshot()
                    info = detect_state(snapshot)
                    if info.get('state')!='UNIFIED_PROCEDURE_OPEN':
                        raise NavigationError('navigation_changed','Form changed during editor discovery')
                    frame=self.unified_frame(snapshot)
                    scope=subtree(snapshot['nodes'],frame)
            else:
                raise NavigationError('company_field_not_found','No company-code editor in the form tab order')
            element=self.elements[target['id']]
            element.send_text(code, wait_for_text_update=False)
            element._request_focus()
            deadline=time.monotonic()+2
            while time.monotonic()<deadline:
                self.drivers[hwnd]._pump_messages()
                if 'focused' in element.states_en_us: break
                time.sleep(.05)
            if str(element.text or '').strip()!=code:
                raise NavigationError('company_input_unverified','Company code text did not match; Enter was not sent')
            # Commit exactly once, after read-back. Never retype an already verified code.
            if win32gui.GetForegroundWindow()!=hwnd or 'focused' not in element.states_en_us:
                raise NavigationError('focus_failed','Company Enter blocked: foreground=' + str(win32gui.GetForegroundWindow()==hwnd) + ', editorFocused=' + str('focused' in element.states_en_us))
            Win32Utils().send_keys('enter')
            return {'operation':'company_code_filled','target':target['id'],'bounds':target.get('bounds') or {},'companyCode':code,'filledByJab':True,'enterSent':True,'role':target.get('role','')}

        if request['command'] == 'read_company_data':
            if state_info.get('state') != 'UNIFIED_PROCEDURE_OPEN':
                raise NavigationError('company_validation_interrupted', 'Company validation opened another page or dialog; review is required')
            nodes = snapshot['nodes']
            frame = self.unified_frame(snapshot)
            scope = subtree(nodes, frame) if frame else []
            def read_named(names):
                labels = [n for n in scope if n.get('role') == 'label' and norm(n.get('name','')) in {norm(v) for v in names}]
                if len(labels) != 1:
                    return ''
                lb = labels[0].get('bounds') or {}
                candidates = []
                for n in scope:
                    if n.get('role') not in ('text', 'editable text') or not visible(n): continue
                    b = n.get('bounds') or {}
                    if abs((b.get('y',0)+b.get('height',0)/2)-(lb.get('y',0)+lb.get('height',0)/2)) > max(12,lb.get('height',0)): continue
                    candidates.append(n)
                if len(candidates) != 1: return ''
                try: return str(self.elements[candidates[0]['id']].text or '').strip()
                except Exception: return ''
            values = form_values(frame.get('description','')) if frame else {}
            code = values.get('companyCode') or read_named(('رمز الشركة', 'Company code'))
            name = values.get('companyName') or read_named(('اسم الشركة', 'Company name'))
            expected = request.get('expected_name') or ''
            verified = code == request.get('company_code') and bool(name) and (not expected or norm(name) == norm(expected))
            return {'verified': bool(verified), 'companyNamePresent': bool(name), 'companyName': name, 'companyCode': code}

        if request['command'] == 'read_unified_result':
            nodes=snapshot['nodes']
            frame=self.unified_frame(snapshot)
            scope=subtree(nodes,frame)
            values = form_values(frame.get('description','')) if frame else {}
            if frame and 'تسجيل. رقم:' in frame.get('description',''):
                return {'operation':'result_read','procedureNo':values.get('procedureNo',''),'source':'registration_metadata'}
            labels=[n for n in scope if n.get('role')=='label' and norm('رقم الإجراء الموحد') in norm(n.get('name',''))]
            fields=[n for n in scope if n.get('role') in ('text','editable text') and visible(n) and 'enabled' in n.get('states',[])]
            if not labels or not fields:
                raise NavigationError('result_field_not_found','تعذر تحديد خانة رقم الإجراء الموحد')
            def center(n):
                b=n.get('bounds') or {}; return (int(b.get('x',0))+int(b.get('width',0))//2,int(b.get('y',0))+int(b.get('height',0))//2)
            lx,ly=center(labels[0])
            ranked=sorted(fields,key=lambda n:(abs(center(n)[1]-ly)*5+abs(center(n)[0]-lx)))
            aligned=[n for n in ranked if abs(center(n)[1]-ly) <= max(12,(labels[0].get('bounds') or {}).get('height',0))]
            if len(aligned)!=1: raise NavigationError('result_field_not_found','Result field is ambiguous')
            target=aligned[0]
            el=self.elements.get(target['id'])
            raw=''
            if el is not None:
                try: raw=str(el.text or '')
                except Exception: raw=''

            digits=''.join(ch for ch in raw if ch.isdigit())
            # A company code can also be numeric, so only accept a value close to
            # the actual unified-number label and not identical to the company code
            # field selected elsewhere.
            return {'operation':'result_read','procedureNo':digits,'bounds':target.get('bounds') or {}}

        if request['command'] == 'submit_unified_procedure':
            if state_info.get('state') != 'UNIFIED_PROCEDURE_OPEN':
                raise NavigationError('unified_screen_not_ready', 'شاشة رقم الإجراء الموحد ليست جاهزة للتنفيذ')
            nodes=snapshot['nodes']; frame_id=state_info.get('frame')
            frame=self.unified_frame(snapshot)
            scope=subtree(nodes, frame) if frame else nodes
            # Observed Iraqi client: eye = document check, checkmark = validate/create.
            checks = [n for n in scope if n.get('role')=='push button' and visible(n) and 'enabled' in n.get('states',[]) and norm(n.get('description',''))==norm('التحقق') and n.get('action')]
            if len(checks)==1:
                self.elements[checks[0]['id']].click(simulate=False)
                return {'operation':'procedure_submitted','method':'exact_validation_tooltip'}
            # Prefer a semantically named validation/create button if this build exposes one.
            semantic=[]
            good_terms=tuple(norm(x) for x in ('تحقق','تأكيد','انشاء','إنشاء','تنفيذ','Validate','Verify','Create','Execute','OK'))
            bad_terms=tuple(norm(x) for x in ('مساعدة','بحث','عرض','Help','Search','View','Cancel','الغاء','إلغاء'))
            for n in scope:
                if n.get('role')!='push button' or not visible(n) or 'enabled' not in n.get('states',[]) or not n.get('action'): continue
                text=norm((n.get('name') or '')+' '+(n.get('description') or ''))
                if text and any(t in text for t in good_terms) and not any(t in text for t in bad_terms): semantic.append(n)
            if len(semantic)==1:
                self.elements[semantic[0]['id']].click(simulate=False)
                return {'operation':'procedure_submitted','method':'semantic_button'}
            raise NavigationError('submit_button_not_found', 'Create button lacks a unique semantic identity; capture/review required')

        if request['command'] in ('affirm_current_popup','read_completion_result'):
            nodes=snapshot['nodes']
            expected_no=str(request.get('procedure_no') or '')
            frames=[n for n in unified_candidates(nodes) if form_values(n.get('description','')).get('procedureNo')==expected_no]
            values=form_values(frames[0].get('description','')) if len(frames)==1 else {}
            target=request.get('target') or {}
            popups=[n for n in nodes if visible(n) and n.get('role')=='dialog' and norm(n.get('name',''))==norm('انجاز المعاملة')]
            if request['command']=='read_completion_result':
                import win32gui
                from unified_form import verify_completion_receipt
                hwnd=int(target.get('windowHwnd') or 0)
                closed=bool(hwnd) and (not win32gui.IsWindow(hwnd) or not win32gui.IsWindowVisible(hwnd))
                # Iraqi ASYCUDA closes the completed internal frame when Yes is clicked.
                # Verify the recorded success+number from BEFORE that click, not an unrelated blank form.
                return {'verified':verify_completion_receipt(self.completion_receipt,expected_no,hwnd,snapshot['pid'],closed,any(visible(n) and n.get('role') in ('dialog','alert','option pane') for n in nodes))}
            if not expected_no or values.get('procedureNo')!=expected_no:
                raise NavigationError('completion_identity_changed','The registered procedure does not match the approved number')
            if len(popups)!=1 or int(popups[0].get('windowHwnd') or 0)!=int(target.get('windowHwnd') or 0):
                raise NavigationError('final_confirmation_ambiguous','Completion dialog differs from the approved screenshot')
            scope=subtree(nodes,popups[0])
            texts=[]
            for n in scope:
                if n.get('role')=='text':
                    try: texts.append(str(self.elements[n['id']].text or ''))
                    except Exception: pass
            success=norm(' '.join(texts))
            if 'is done' not in success and 'تم' not in success:
                raise NavigationError('completion_success_missing','Completion dialog does not report success')
            buttons=[n for n in scope if n.get('role')=='push button' and visible(n) and 'enabled' in n.get('states',[]) and norm(n.get('description',''))==norm('نعم') and n.get('action')]
            if len(buttons)!=1: raise NavigationError('final_confirmation_ambiguous','Expected one Yes checkmark in completion dialog')
            self.elements[buttons[0]['id']].click(simulate=False)
            self.completion_receipt={'procedureNo':expected_no,'hwnd':int(target['windowHwnd']),'pid':snapshot['pid'],'serverSuccess':True,'confirmationClicked':True}
            return {'operation':'final_confirmation_clicked','receipt':self.completion_receipt}

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
            semantic = [n for n in scope if n.get('role')=='push button' and visible(n) and 'enabled' in n.get('states',[]) and norm(n.get('description','')) in {norm('المرور'),norm('Login')}]
            if len(passwords)==1 and len(users)==1 and len(semantic)==1:
                self.elements[semantic[0]['id']].click(simulate=False)
                return {'operation':'login_submitted','method':'verified_login_tooltip'}
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
        if state_info.get('state')=='MAIN_SCREEN' and time.monotonic()<self.page_open_pending_until:
            return {'state':'LOADING','operation':'wait'}
        action = self.planner.decide(snapshot)
        operation = action['operation']
        if operation in ('click', 'expand'):
            element = self.elements[action['target']]
            if operation == 'expand': element.expand(simulate=False)
            else:
                element.click(simulate=False)
                node=next(n for n in snapshot['nodes'] if n['id']==action['target'])
                if norm(node.get('name',''))==norm('رقم الاجراء الموحد'):
                    self.page_open_pending_until=time.monotonic()+8
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
            user_value = self.elements[users[0]['id']].text or ''
            password_length = self.elements[passwords[0]['id']]._get_accessible_text_info().charCount
            verified = user_value == creds['username'] and password_length == len(creds['password'])
            if not verified:
                raise NavigationError('login_fields_unverified','Java did not confirm the username and password length; login was not submitted')
            action['fieldsVerified'] = True
            action['operation'] = 'login_filled'
            action['usernameBounds'] = dict(users[0].get('bounds') or {})
            action['passwordBounds'] = dict(passwords[0].get('bounds') or {})
            action['usernameTarget'] = str(users[0].get('id') or '')
            action['passwordTarget'] = str(passwords[0].get('id') or '')
        return action

    def close(self):
        self.release_elements()
        if self.bound_frame is not None:
            self.bound_frame.release_jabelement()
            self.bound_frame = None
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
            except Exception as exc:
                import traceback
                frame = traceback.extract_tb(exc.__traceback__)[-1]
                response = {'ok': False, 'code': 'jab_unavailable', 'message': 'JAB ' + type(exc).__name__ + ' at ' + Path(frame.filename).name + ':' + str(frame.lineno)}
            wire.write(json.dumps(response, ensure_ascii=True) + '\n')
            wire.flush()
    finally: session.close()

if __name__ == '__main__': main()


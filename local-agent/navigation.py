"""Fail-closed navigation policy; no operating-system input."""
import re
import unicodedata

class NavigationError(RuntimeError):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code

def norm(value):
    return ' '.join(unicodedata.normalize('NFKC', str(value)).replace('أ', 'ا').replace('إ', 'ا').replace('آ', 'ا').split()).casefold()

PAGE = {norm(x) for x in ('رقم الإجراء الموحد', 'Unified Procedure Number')}
FOLDER = {norm(x) for x in ('الإجراء الموحد', 'Unified Procedure')}
DOCUMENTS = {norm(x) for x in ('قائمة الوثائق', 'Document List', 'Document Library', 'مكتبة الوثائق')}
NO = {norm(x) for x in ('لا', 'No')}

def visible(n):
    return 'showing' in n.get('states', [])

def subtree(nodes, root):
    ids = {root['id']}
    result = []
    for n in nodes:
        if n['id'] in ids or n.get('parent') in ids:
            ids.add(n['id'])
            result.append(n)
    return result


def target_for(node, kind):
    if not node:
        return None
    return {
        'kind': kind,
        'nodeId': str(node.get('id','')),
        'windowHwnd': int(node.get('windowHwnd') or 0),
        'windowMain': bool(node.get('windowMain')),
        'windowTitle': str(node.get('windowTitle') or ''),
        'role': str(node.get('role') or ''),
        'name': str(node.get('name') or ''),
        'bounds': dict(node.get('bounds') or {}),
    }

def detect_state(snapshot):
    if snapshot.get('truncated'):
        raise NavigationError('manual_intervention_required', 'تعذر قراءة واجهة الأسيكودا كاملة')
    nodes = [n for n in snapshot['nodes'] if visible(n)]

    # Iraqi ASYCUDA has used multiple unread-mail phrasings across builds
    # (e.g. numeric counts and the singular "رسالة واحدة"). Detect the
    # semantic content anywhere in the visible accessibility tree instead of
    # depending on one exact sentence or one specific Swing role.
    all_visible_text = norm(' '.join(n.get('name','') for n in nodes if n['role'] not in ('text', 'password text')))
    unread_mail = (
        ('صندوق البريد' in all_visible_text or 'mailbox' in all_visible_text)
        and ('غير مقرو' in all_visible_text or 'unread' in all_visible_text)
        and ('رسالة' in all_visible_text or 'رسائل' in all_visible_text or 'message' in all_visible_text)
    )
    if unread_mail:
        popup = next((n for n in nodes if n['role'] in ('alert', 'dialog', 'option pane') or 'modal' in n.get('states', [])), None)
        anchor = popup or next((n for n in nodes if ('غير مقرو' in norm(n.get('name','')) or 'unread' in norm(n.get('name','')))), None)
        kind = 'java_window' if anchor and anchor.get('windowHwnd') and not anchor.get('windowMain') else 'jab_popup'
        return {'state': 'NOTIFICATIONS_POPUP', 'popup': popup['id'] if popup else '', 'target': target_for(anchor, kind)}

    popup_nodes = [n for n in nodes if n['role'] in ('alert', 'dialog', 'option pane') or 'modal' in n.get('states', [])]
    for popup in popup_nodes:
        inside = subtree(nodes, popup)
        text = norm(' '.join(n['name'] for n in inside if n['role'] not in ('text', 'password text')))
        if any(x in text for x in ('unsaved', 'discard', 'save changes', 'غير محفوظ', 'حفظ التغييرات', 'تجاهل التغييرات')):
            return {'state': 'MANUAL_INTERVENTION', 'popup': popup['id'], 'target': target_for(popup, 'java_window' if popup.get('windowHwnd') and not popup.get('windowMain') else 'jab_popup')}
        if any(n['role'] == 'password text' for n in inside):
            ready_login = any(n['role']=='password text' and 'enabled' in n.get('states',[]) for n in inside)
            return {'state': 'LOGIN' if ready_login else 'LOADING', 'popup': popup['id'], 'target': target_for(popup, 'java_window' if popup.get('windowHwnd') and not popup.get('windowMain') else 'jab_popup')}
        return {'state': 'UNKNOWN_POPUP', 'popup': popup['id'], 'target': target_for(popup, 'java_window' if popup.get('windowHwnd') and not popup.get('windowMain') else 'jab_popup')}
    password_nodes = [n for n in nodes if n['role'] in ('password text','password')]
    if password_nodes:
        return {'state': 'LOGIN' if any('enabled' in n.get('states',[]) for n in password_nodes) else 'LOADING'}
    # Do not require Swing to mark an internal frame selected/active. Iraqi
    # ASYCUDA frequently leaves a visible declaration/document frame without
    # those accessibility states. Any visible internal frame is therefore a
    # real open page and must be reviewed instead of being mistaken for the
    # clean main screen. Prefer active/selected frames first when there are
    # several.
    frames = [n for n in nodes if n['role'] == 'internal frame' and not (norm(n.get('name','')) in DOCUMENTS and any(c.get('role') == 'tree' for c in subtree(nodes,n)))]
    frames.sort(key=lambda n: 0 if ('selected' in n.get('states', []) or 'active' in n.get('states', [])) else 1)
    for frame in frames:
        content = subtree(nodes, frame)
        title = norm(frame.get('name',''))
        content_text = norm(' '.join(n.get('name','') for n in content if n.get('role') not in ('text','password text')))
        labels = {norm(n.get('name','')) for n in content if n.get('role') == 'label'}
        # Unified-procedure readiness is structural as well as title-based.
        # This avoids confusing the navigator tree item with the opened page.
        has_company = bool(labels.intersection({norm('رمز الشركة'), norm('company code')})) or norm('رمز الشركة') in content_text
        has_unified_number = norm('رقم الإجراء الموحد') in content_text or title in PAGE
        has_editable = any(n.get('role') in ('text','combo box') and 'enabled' in n.get('states', []) for n in content)
        # This Iraqi build paints document fields rather than exposing text widgets.
        # Its internal-frame metadata independently identifies the document and company.
        description = norm(frame.get('description',''))
        painted_form = any(title.startswith(page + ' -') for page in PAGE) and 'اسم الشركة' in description and 'تسجيل. رقم' in description and any(norm(n.get('description','')) == norm('التحقق من الوثيقة') for n in content)
        if painted_form:
            b=frame.get('bounds') or {}
            root=next((n for n in nodes if n.get('role')=='frame' and n.get('windowHwnd')==frame.get('windowHwnd')),None)
            rb=(root or {}).get('bounds') or {}
            offscreen=bool(rb and (b.get('x',0)+b.get('width',0)<=rb.get('x',0) or b.get('x',0)>=rb.get('x',0)+rb.get('width',0)))
            return {'state':'UNIFIED_PROCEDURE_OFFSCREEN' if offscreen else 'UNIFIED_PROCEDURE_OPEN','frame':frame['id'],'fieldMode':'painted_form','target':target_for(frame,'internal_frame')}
        if has_company and has_unified_number and has_editable:
            return {'state': 'UNIFIED_PROCEDURE_OPEN', 'frame': frame['id'], 'target': target_for(frame, 'internal_frame')}
        if any(s in title or s in content_text for s in ('البيان المسبق', 'pre-declaration', 'pre declaration')):
            return {'state': 'PREDECLARATION_OPEN', 'frame': frame['id'], 'title': frame.get('name',''), 'target': target_for(frame, 'internal_frame')}
        if any(s in title or s in content_text for s in ('تفاصيل البيان', 'البيان الجمركي', 'بيان جمركي', 'declaration details')):
            return {'state': 'DECLARATION_OPEN', 'frame': frame['id'], 'title': frame.get('name',''), 'target': target_for(frame, 'internal_frame')}
        # A generic title containing بيان is still considered a declaration,
        # but only after the explicit unified-procedure test above.
        if any(s in title for s in ('بيان', 'declaration')):
            return {'state': 'DECLARATION_OPEN', 'frame': frame['id'], 'title': frame.get('name',''), 'target': target_for(frame, 'internal_frame')}
        if any(s in title or s in content_text for s in ('اشعار', 'الاشعارات', 'رسائل', 'صندوق البريد', 'notification', 'mailbox', 'message')):
            return {'state': 'NOTIFICATIONS_PAGE', 'frame': frame['id'], 'title': frame.get('name',''), 'target': target_for(frame, 'internal_frame')}
    if frames:
        return {'state': 'OTHER_PAGE_OPEN', 'frame': frames[0]['id'], 'title': frames[0].get('name',''), 'target': target_for(frames[0], 'internal_frame')}
    return {'state': 'MAIN_SCREEN' if nodes else 'LOADING'}

def plan(snapshot):
    info = detect_state(snapshot)
    state, nodes = info['state'], snapshot['nodes']
    if state == 'MANUAL_INTERVENTION':
        raise NavigationError('manual_intervention_required', 'تحتاج نافذة حفظ أو تأكيد إلى تدخل يدوي')
    if state == 'UNKNOWN_POPUP':
        raise NavigationError('unknown_popup', 'ظهرت نافذة غير معروفة داخل ASYCUDA')
    if state == 'UNIFIED_PROCEDURE_OPEN':
        return {'state': state, 'operation': 'ready'}
    if state == 'LOGIN':
        return {'state': state, 'operation': 'login'}
    if state == 'NOTIFICATIONS_POPUP':
        # The Iraqi client exposes the two JOptionPane buttons without accessible names.
        # Do not guess by button index. The caller performs the semantic Cancel action (Esc)
        # only after this exact popup text has been positively identified.
        return {'state': state, 'operation': 'dismiss_notifications', 'safety_tag': 'known_notification_cancel'}
    for names, operation in ((PAGE, 'click'), (FOLDER, 'expand'), (DOCUMENTS, 'click')):
        matches = [n for n in nodes if visible(n) and norm(n['name']) in names and n['role'] in ('tree item', 'label', 'menu item', 'push button', 'page tab') and n.get('action') and 'enabled' in n['states']]
        if operation == 'expand':
            matches = [n for n in matches if 'expanded' not in n['states']]
        if len(matches) > 1 and operation == 'expand':
            # Expanding a named navigation folder is reversible; inspect each
            # collapsed branch until the unique target document becomes visible.
            matches = sorted(matches, key=lambda n: n.get('index_in_parent', -1))[:1]
        if len(matches) > 1:
            raise NavigationError('manual_intervention_required', 'توجد عناصر تنقل متشابهة تحتاج إلى فحص')
        if matches:
            return {'state': state, 'operation': operation, 'target': matches[0]['id']}
    return {'state': state, 'operation': 'wait'}

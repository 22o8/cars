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
DOCUMENTS = {norm(x) for x in ('قائمة الوثائق', 'Document List', 'Document Library')}
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

def detect_state(snapshot):
    if snapshot.get('truncated'):
        raise NavigationError('manual_intervention_required', 'تعذر قراءة واجهة الأسيكودا كاملة')
    nodes = [n for n in snapshot['nodes'] if visible(n)]
    for popup in [n for n in nodes if n['role'] in ('alert', 'dialog')]:
        inside = subtree(nodes, popup)
        text = norm(' '.join(n['name'] for n in inside if n['role'] not in ('text', 'password text')))
        if any(x in text for x in ('unsaved', 'discard', 'save changes', 'غير محفوظ', 'حفظ التغييرات', 'تجاهل التغييرات')):
            return {'state': 'MANUAL_INTERVENTION', 'popup': popup['id']}
        if re.search(r'لديك\s+\d+\s+رسالة غير مقروءة', text) and 'هل تريد فتح صندوق البريد' in text:
            return {'state': 'NOTIFICATIONS_POPUP', 'popup': popup['id']}
        if any(n['role'] == 'password text' for n in inside):
            return {'state': 'LOGIN', 'popup': popup['id']}
        return {'state': 'UNKNOWN_POPUP', 'popup': popup['id']}
    if any(n['role'] == 'password text' for n in nodes):
        return {'state': 'LOGIN'}
    frames = [n for n in nodes if n['role'] == 'internal frame' and ('selected' in n['states'] or 'active' in n['states'])]
    for frame in frames:
        content = subtree(nodes, frame)
        title = norm(frame['name'])
        if title in PAGE:
            labels = {norm(n['name']) for n in content if n['role'] == 'label'}
            if labels.intersection({norm('رمز الشركة'), 'company code'}) and any(n['role'] in ('text', 'combo box') and 'enabled' in n['states'] for n in content):
                return {'state': 'UNIFIED_PROCEDURE_OPEN', 'frame': frame['id']}
        if any(s in title for s in ('البيان المسبق', 'pre-declaration', 'pre declaration')):
            return {'state': 'PREDECLARATION_OPEN'}
        if any(s in title for s in ('بيان', 'declaration')):
            return {'state': 'DECLARATION_OPEN'}
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
        popup = next(n for n in nodes if n['id'] == info['popup'])
        matches = [n for n in subtree(nodes, popup) if visible(n) and n['role'] == 'push button' and norm(n['name']) in NO and 'enabled' in n['states']]
        if len(matches) != 1:
            raise NavigationError('manual_intervention_required', 'تعذر تحديد زر رفض فتح البريد بأمان')
        return {'state': state, 'operation': 'click', 'target': matches[0]['id']}
    for names, operation in ((PAGE, 'click'), (FOLDER, 'expand'), (DOCUMENTS, 'click')):
        matches = [n for n in nodes if visible(n) and norm(n['name']) in names and n['role'] in ('tree item', 'label', 'menu item', 'push button', 'page tab') and n.get('action') and 'enabled' in n['states']]
        if operation == 'expand':
            matches = [n for n in matches if 'expanded' not in n['states']]
        if len(matches) > 1:
            raise NavigationError('manual_intervention_required', 'توجد عناصر تنقل متشابهة تحتاج إلى فحص')
        if matches:
            return {'state': state, 'operation': operation, 'target': matches[0]['id']}
    return {'state': state, 'operation': 'wait'}

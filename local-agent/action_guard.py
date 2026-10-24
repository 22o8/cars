from __future__ import annotations

from navigation import DOCUMENTS, FOLDER, NO, PAGE, NavigationError, norm, subtree, visible

# Test/navigation mode is intentionally unable to execute production actions.
FORBIDDEN_TERMS = tuple(norm(x) for x in (
    'حفظ', 'تسجيل', 'اعتماد', 'انشاء', 'إنشاء', 'ارسال', 'إرسال', 'دفع', 'حذف', 'تعديل',
    'save', 'submit', 'create', 'register', 'approve', 'pay', 'delete', 'amend', 'update'
))

SAFE_ROLES = {'tree item', 'label', 'menu item', 'push button', 'page tab'}


def _node(snapshot, node_id):
    return next((n for n in snapshot.get('nodes', []) if n.get('id') == str(node_id)), None)


def semantic_safe(node: dict) -> bool:
    if not node or not visible(node) or 'enabled' not in node.get('states', []):
        return False
    name = norm(node.get('name', ''))
    return not any(term and term in name for term in FORBIDDEN_TERMS)


def validate_navigation_action(snapshot: dict, action: dict, *, source: str = 'rule') -> dict:
    operation = action.get('operation')
    if operation in ('ready', 'wait', 'login', 'login_sent'):
        return action
    if operation not in ('click', 'expand'):
        raise NavigationError('unsafe_action', 'The proposed ASYCUDA action is not navigation-safe.')
    target = _node(snapshot, action.get('target'))
    if not target or target.get('role') not in SAFE_ROLES or not target.get('action'):
        raise NavigationError('unsafe_action', 'The proposed ASYCUDA target is not an actionable navigation element.')
    if not semantic_safe(target):
        raise NavigationError('unsafe_action', 'The proposed ASYCUDA target looks like a production action.')

    name = norm(target.get('name', ''))
    allowed_named = name in PAGE or name in FOLDER or name in DOCUMENTS
    if source == 'rule' and not allowed_named and name not in NO:
        raise NavigationError('unsafe_action', 'The navigation rule attempted a non-allowlisted control.')
    if source in ('memory', 'ai') and not allowed_named:
        # Learned/AI actions are accepted only when explicitly marked as a safe popup dismissal.
        if action.get('safety_tag') != 'dismiss_known_popup':
            raise NavigationError('unsafe_action', 'Learned/AI action is outside the navigation allowlist.')
    return {**action, 'target_role': target.get('role', ''), 'target_name': target.get('name', '')}


def resolve_selector(snapshot: dict, selector: dict) -> dict | None:
    nodes = [n for n in snapshot.get('nodes', []) if visible(n)]
    parent_text = norm(selector.get('parent_text', ''))
    candidates = nodes
    if parent_text:
        roots = []
        for root in nodes:
            if root.get('role') not in ('alert', 'dialog'):
                continue
            text = norm(' '.join(n.get('name', '') for n in subtree(nodes, root)))
            if parent_text in text:
                roots.append(root)
        if len(roots) != 1:
            return None
        allowed = {n['id'] for n in subtree(nodes, roots[0])}
        candidates = [n for n in nodes if n.get('id') in allowed]
    role = selector.get('role')
    if role:
        candidates = [n for n in candidates if n.get('role') == role]
    name = norm(selector.get('name', ''))
    if name:
        candidates = [n for n in candidates if norm(n.get('name', '')) == name]
    idx = selector.get('index_in_parent')
    if idx is not None:
        candidates = [n for n in candidates if n.get('index_in_parent') == idx]
    candidates = [n for n in candidates if semantic_safe(n) and n.get('action')]
    return candidates[0] if len(candidates) == 1 else None

import json
from pathlib import Path

BASE = Path(__file__).resolve().parent
p = BASE / 'config.json'
if not p.exists():
    print('[FAIL] config.json was not found.')
    raise SystemExit(1)

cfg = json.loads(p.read_text(encoding='utf-8'))
a = cfg.get('asycuda', {})

def point_ok(v):
    return isinstance(v, list) and len(v) == 2 and any(int(x) != 0 for x in v)

checks = [
    ('login_username', point_ok(a.get('login_username'))),
    ('login_password', point_ok(a.get('login_password'))),
    ('login_button', point_ok(a.get('login_button'))),
    ('unified_menu_clicks', isinstance(a.get('unified_menu_clicks'), list)
        and len(a.get('unified_menu_clicks')) > 0
        and all(point_ok(x) for x in a.get('unified_menu_clicks'))),
]

print('=== Calibration status ===')
for k, ok in checks:
    print(('[OK]   ' if ok else '[MISS] ') + k)
base_ok = all(ok for _, ok in checks)

full = [
    ('company_code_field', point_ok(a.get('company_code_field'))),
    ('submit_button', point_ok(a.get('submit_button'))),
]
print('\nExecution fields (needed later for REAL procedure creation):')
for k, ok in full:
    print(('[OK]   ' if ok else '[MISS] ') + k)

print('\nTEST READY:', 'YES' if base_ok else 'NO')
print('REAL EXECUTION READY:', 'YES' if base_ok and all(ok for _, ok in full) else 'NO')
raise SystemExit(0 if base_ok else 2)

from __future__ import annotations
import json
import sys
from pathlib import Path

BASE=Path(__file__).resolve().parent
for stream in (sys.stdout,sys.stderr):
    try: stream.reconfigure(encoding='utf-8',errors='replace')
    except Exception: pass
path=BASE/'screen-memory.json'
if not path.exists():
    print('Hybrid intelligence memory is empty.')
    raise SystemExit(0)
data=json.loads(path.read_text(encoding='utf-8'))
print('Hybrid intelligence memory')
print('  observed screens :',len(data.get('screens',{})))
print('  taught screens   :',len(data.get('teachings',{})))
print('  transitions      :',len(data.get('transitions',[])))
for fp,item in list(data.get('teachings',{}).items())[-10:]:
    print(f'  teaching {fp}: state={item.get("state")} action={item.get("operation")} note={item.get("note","")}')

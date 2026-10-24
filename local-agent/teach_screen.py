from __future__ import annotations

import sys
from pathlib import Path

from action_guard import semantic_safe
from jab_client import JABClient
from navigation import detect_state, norm, subtree
from screen_memory import ScreenMemory

BASE = Path(__file__).resolve().parent
for stream in (sys.stdout, sys.stderr):
    try: stream.reconfigure(encoding='utf-8', errors='replace')
    except Exception: pass


def choice(prompt, valid):
    while True:
        value = input(prompt).strip()
        if value in valid: return value
        print('Invalid choice. Try again.')


def ancestor_popup(nodes, target):
    by_id = {n['id']: n for n in nodes}
    cur = target
    while cur and cur.get('parent') is not None:
        cur = by_id.get(cur.get('parent'))
        if cur and cur.get('role') in ('alert', 'dialog'):
            return cur
    return None


def popup_fragment(nodes, popup):
    if not popup: return ''
    names = [n.get('name','').strip() for n in subtree(nodes, popup)
             if n.get('role') in ('label','alert','dialog') and n.get('name','').strip()]
    text = ' '.join(names)
    # Keep a short semantic phrase; dynamic numbers are normalized by ScreenMemory.
    return text[:220]


def pick_by_mouse(actionable):
    try:
        import pyautogui
    except Exception:
        print('Mouse selection is unavailable. Use element number mode.')
        return None
    input('Move the mouse over the SAFE control in ASYCUDA, then press Enter here...')
    pos = pyautogui.position()
    matches=[]
    for n in actionable:
        b=n.get('bounds') or {}
        x,y,w,h=(int(b.get('x',-1)),int(b.get('y',-1)),int(b.get('width',-1)),int(b.get('height',-1)))
        if w>0 and h>0 and x <= pos.x <= x+w and y <= pos.y <= y+h:
            matches.append(n)
    if len(matches)==1:
        return matches[0]
    print(f'Could not map mouse position to exactly one safe JAB element (matches={len(matches)}).')
    return None


def main():
    helper = JABClient(BASE)
    try:
        result = helper.call('snapshot', timeout=30)
        snapshot = result['snapshot']
        nodes = snapshot['nodes']
        detected = result.get('state') or detect_state(snapshot)['state']
        print('Current detected state:', detected)
        actionable = [n for n in nodes if 'showing' in n.get('states', []) and 'enabled' in n.get('states', []) and n.get('action') and semantic_safe(n)]
        print('\nSAFE visible actionable elements:')
        for i, n in enumerate(actionable):
            bounds = n.get('bounds') or {}
            name = n.get('name') or '(unnamed)'
            desc = n.get('description') or ''
            print(f'[{i}] role={n.get("role")} name={name!r} desc={desc!r} index={n.get("index_in_parent")} bounds={bounds}')
        print('\nTeaching is ONLY for navigation/popup dismissal. Production actions are blocked by ActionGuard.')
        state = input(f'State label [{detected}]: ').strip() or detected
        mode = choice('Action: 1=click safe element, 2=wait, 3=ready, 0=cancel: ', {'0','1','2','3'})
        if mode == '0': return
        operation = {'1':'click','2':'wait','3':'ready'}[mode]
        selector = None
        note = input('Short note (optional): ').strip()
        if operation == 'click':
            method = choice('Pick target: 1=element number, 2=mouse-over + Enter: ', {'1','2'})
            target=None
            if method=='2': target=pick_by_mouse(actionable)
            while target is None:
                raw=input('Element number: ').strip()
                try: target=actionable[int(raw)]
                except Exception: print('Invalid element number.')
            popup=ancestor_popup(nodes,target)
            parent_text=popup_fragment(nodes,popup)
            selector={
                'role':target.get('role'),'name':target.get('name') or '',
                'index_in_parent':target.get('index_in_parent'),'parent_text':parent_text,
            }
            print('Selector will be scoped to popup text:', parent_text or '(none)')
        fp=ScreenMemory(BASE).teach(snapshot,state,operation,selector,note)
        print('Saved teaching fingerprint:',fp)
    finally:
        helper.close()


if __name__=='__main__': main()

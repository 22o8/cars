from __future__ import annotations

import hashlib
import json
import re
import threading
import time
from pathlib import Path
from typing import Any

from navigation import norm


class ScreenMemory:
    """Small local memory for ASYCUDA accessibility screens.

    It stores only accessibility metadata/fingerprints and user-taught safe actions.
    It never stores text/password field values.
    """

    VERSION = 1

    def __init__(self, base: Path, filename: str = 'screen-memory.json'):
        self.path = Path(base) / filename
        self._lock = threading.Lock()
        self.data = self._load()
        self._mtime = self.path.stat().st_mtime_ns if self.path.exists() else 0

    def _load(self) -> dict[str, Any]:
        try:
            raw = json.loads(self.path.read_text(encoding='utf-8'))
            if isinstance(raw, dict) and raw.get('version') == self.VERSION:
                raw.setdefault('screens', {})
                raw.setdefault('teachings', {})
                raw.setdefault('transitions', [])
                return raw
        except Exception:
            pass
        return {'version': self.VERSION, 'screens': {}, 'teachings': {}, 'transitions': []}

    def _maybe_reload(self):
        try:
            mtime = self.path.stat().st_mtime_ns if self.path.exists() else 0
            if mtime and mtime != self._mtime:
                self.data = self._load()
                self._mtime = mtime
        except Exception:
            pass

    def _save(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix('.tmp')
        tmp.write_text(json.dumps(self.data, ensure_ascii=False, indent=2), encoding='utf-8')
        tmp.replace(self.path)
        try: self._mtime = self.path.stat().st_mtime_ns
        except Exception: pass

    @staticmethod
    def _safe_name(node: dict[str, Any]) -> str:
        # Never fingerprint editable/password contents. JAB helper already blanks text names,
        # but keep this fail-closed here too.
        if node.get('role') in ('text', 'password text'):
            return ''
        return re.sub(r'\d+', '<n>', norm(node.get('name', '')))[:180]

    @classmethod
    def signature(cls, snapshot: dict[str, Any]) -> dict[str, Any]:
        visible = [n for n in snapshot.get('nodes', []) if 'showing' in n.get('states', [])]
        tokens: list[str] = []
        for n in visible:
            role = str(n.get('role', '')).casefold()
            name = cls._safe_name(n)
            states = ','.join(sorted(s for s in n.get('states', []) if s in ('active', 'selected', 'expanded', 'checked')))
            index = n.get('index_in_parent', -1)
            if name or role in ('alert', 'dialog', 'internal frame', 'tree item', 'page tab', 'push button'):
                tokens.append(f'{role}|{name}|{index}|{states}')
        tokens.sort()
        digest = hashlib.sha256('\n'.join(tokens).encode('utf-8')).hexdigest()[:24]
        return {'fingerprint': digest, 'tokens': tokens[:400], 'node_count': len(visible)}

    def observe(self, snapshot: dict[str, Any], state: str, source: str = 'detector') -> str:
        sig = self.signature(snapshot)
        fp = sig['fingerprint']
        now = int(time.time())
        with self._lock:
            item = self.data['screens'].setdefault(fp, {
                'first_seen': now, 'last_seen': now, 'count': 0,
                'state_counts': {}, 'node_count': sig['node_count'], 'sample_tokens': sig['tokens'][:80],
            })
            item['last_seen'] = now
            item['count'] = int(item.get('count', 0)) + 1
            counts = item.setdefault('state_counts', {})
            counts[state] = int(counts.get(state, 0)) + 1
            item['last_source'] = source
            if item['count'] in (1, 2, 5, 10) or item['count'] % 25 == 0:
                self._save()
        return fp

    def teaching(self, snapshot: dict[str, Any]) -> dict[str, Any] | None:
        self._maybe_reload()
        sig = self.signature(snapshot)
        fp = sig['fingerprint']
        teachings = self.data.get('teachings', {})
        value = teachings.get(fp)
        if isinstance(value, dict):
            return {**value, '_match': 'exact', '_similarity': 1.0}

        # Conservative fuzzy retrieval: useful for counters/timestamps changing on the same screen.
        current = set(sig['tokens'])
        ranked = []
        for taught_fp, item in teachings.items():
            if not isinstance(item, dict):
                continue
            sample = set(item.get('sample_tokens') or [])
            if not sample or not current:
                continue
            score = len(current & sample) / max(1, len(current | sample))
            ranked.append((score, taught_fp, item))
        ranked.sort(reverse=True, key=lambda x: x[0])
        if not ranked or ranked[0][0] < 0.90:
            return None
        if len(ranked) > 1 and ranked[0][0] - ranked[1][0] < 0.08:
            return None
        score, _, item = ranked[0]
        return {**item, '_match': 'similar', '_similarity': round(score, 4)}

    def teach(self, snapshot: dict[str, Any], state: str, operation: str, selector: dict[str, Any] | None, note: str = '') -> str:
        sig = self.signature(snapshot)
        fp = sig['fingerprint']
        entry = {
            'state': state,
            'operation': operation,
            'selector': selector or {},
            'note': note[:300],
            'created_at': int(time.time()),
            'sample_tokens': sig['tokens'][:120],
        }
        with self._lock:
            self.data.setdefault('teachings', {})[fp] = entry
            self._save()
        return fp

    def record_transition(self, before_fp: str, after_fp: str, action: dict[str, Any], success: bool):
        if not before_fp or not after_fp or before_fp == after_fp:
            return
        event = {
            'at': int(time.time()), 'before': before_fp, 'after': after_fp,
            'operation': action.get('operation', ''), 'target_role': action.get('target_role', ''),
            'target_name': action.get('target_name', ''), 'success': bool(success),
        }
        with self._lock:
            transitions = self.data.setdefault('transitions', [])
            transitions.append(event)
            del transitions[:-250]
            self._save()

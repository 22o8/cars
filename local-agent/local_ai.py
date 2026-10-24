"""Optional LOCAL AI classification hook.

This module deliberately does not execute UI actions. It is kept separate so a local model
(Ollama/other localhost provider) can later classify unknown screens without sending ASYCUDA
screens or business data to an external service. ActionGuard remains authoritative.
"""
from __future__ import annotations

import json
from typing import Any


def sanitize_snapshot(snapshot: dict[str, Any]) -> dict[str, Any]:
    rows = []
    for n in snapshot.get('nodes', []):
        if 'showing' not in n.get('states', []):
            continue
        role = n.get('role', '')
        name = '' if role in ('text', 'password text') else str(n.get('name', ''))[:160]
        if name or role in ('alert', 'dialog', 'internal frame', 'tree item', 'page tab', 'push button'):
            rows.append({'id': n.get('id'), 'role': role, 'name': name, 'states': n.get('states', [])[:8]})
    return {'nodes': rows[:600], 'truncated': bool(snapshot.get('truncated'))}


class LocalAIPlanner:
    """Reserved local-only planner interface. Disabled unless explicitly wired by the operator."""

    def __init__(self, enabled: bool = False):
        self.enabled = bool(enabled)

    def classify(self, snapshot: dict[str, Any]) -> dict[str, Any] | None:
        # Intentionally no cloud call and no automatic action in v8.
        # The sanitized structure is ready for a localhost model in a later opt-in revision.
        if not self.enabled:
            return None
        return {'state': 'UNKNOWN', 'confidence': 0.0, 'reason': 'No local model configured'}

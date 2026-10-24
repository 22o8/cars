from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from action_guard import resolve_selector, validate_navigation_action
from navigation import NavigationError, detect_state, plan as rule_plan
from screen_memory import ScreenMemory


class IntelligentPlanner:
    """Hybrid planner: deterministic rules first, learned local memory second.

    Optional local-model hooks can be added later without granting the model direct control.
    All actions still pass ActionGuard.
    """

    def __init__(self, base: Path):
        self.base = Path(base)
        self.memory = ScreenMemory(self.base)
        self.last_fp = ''
        self.last_action: dict[str, Any] | None = None

    def _state(self, snapshot: dict) -> str:
        return detect_state(snapshot)['state']

    def decide(self, snapshot: dict) -> dict:
        state = self._state(snapshot)
        fp = self.memory.observe(snapshot, state)
        if self.last_fp and self.last_action:
            self.memory.record_transition(self.last_fp, fp, self.last_action, success=(self.last_fp != fp))
        self.last_fp = fp
        self.last_action = None

        try:
            action = rule_plan(snapshot)
            action = validate_navigation_action(snapshot, action, source='rule')
            action['source'] = 'rule'
            action['fingerprint'] = fp
            self.last_action = action
            return action
        except NavigationError as exc:
            # Only memory may recover unknown/ambiguous UI. Safety errors never fall through.
            if exc.code not in ('unknown_popup', 'manual_intervention_required'):
                raise
            teaching = self.memory.teaching(snapshot)
            if not teaching:
                raise
            target = resolve_selector(snapshot, teaching.get('selector', {}))
            if teaching.get('operation') in ('wait', 'ready'):
                action = {'state': teaching.get('state', state), 'operation': teaching['operation']}
            elif target:
                action = {
                    'state': teaching.get('state', state), 'operation': teaching.get('operation', 'click'),
                    'target': target['id'], 'safety_tag': 'dismiss_known_popup',
                }
            else:
                raise NavigationError('manual_intervention_required', 'A learned ASYCUDA screen changed and needs re-teaching.')
            action = validate_navigation_action(snapshot, action, source='memory')
            action['source'] = 'memory'
            action['fingerprint'] = fp
            self.last_action = action
            return action

    def teach(self, snapshot: dict, state: str, operation: str, selector: dict | None, note: str = '') -> str:
        return self.memory.teach(snapshot, state, operation, selector, note)

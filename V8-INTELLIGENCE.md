# ASYCUDA Hybrid Intelligent Agent v8

## What changed
The agent no longer treats ASYCUDA as a fixed sequence of screen coordinates. The v8 candidate uses four layers:

1. **Java Access Bridge (JAB 32-bit)** reads the actual Java accessibility tree.
2. **Deterministic state detector** recognizes login, main screen, declarations, unified procedure and known/unknown dialogs.
3. **Local screen memory** fingerprints accessibility metadata, remembers repeated states and can retrieve user-taught safe actions conservatively.
4. **Action Guard** is authoritative. Memory or future AI suggestions cannot execute production actions in navigation/test mode.

Real unified-procedure creation remains disabled.

## Local learning / teaching
Run `local-agent\teach-screen.bat` only when ASYCUDA is showing a screen the agent cannot safely handle.

The tool:
- reads the current JAB screen;
- lists **safe** actionable elements only;
- lets you pick an element by number, or move the mouse over the real control and press Enter;
- stores a semantic selector (role/name/index/popup text), not a click coordinate;
- saves the teaching to `local-agent\screen-memory.json`.

The running helper reloads teachings automatically. You normally do not need to restart the agent.

### Important safety rule
Never teach a Save/Create/Submit/Register/Pay/Delete/Approve action. ActionGuard blocks those terms anyway, but the teaching workflow is intended only for navigation and safe popup dismissal.

## Example: unread-mail popup
If the alert text is like:

`لديك 13 رسالة غير مقروءة. هل تريد فتح صندوق البريد?`

and its buttons have no accessible names, use `teach-screen.bat`, choose the safe **No** button by mouse-over, and save it as a click teaching. Dynamic numbers are normalized, so the memory also recognizes the same popup with a different unread count.

## Intelligence status
Run:

`local-agent\intelligence-status.bat`

It reports how many screen fingerprints, teachings and successful transitions have been recorded. It never prints credentials or tokens.

## Optional AI model
`local-agent\local_ai.py` contains an intentionally disabled local-model interface. v8 does **not** send ASYCUDA screenshots or accessibility data to an external AI provider. A localhost model can be added later, but it will remain advisory and all actions must still pass ActionGuard.

## Files added in v8
- `screen_memory.py` — local screen fingerprint/memory store.
- `intelligent_planner.py` — rules first, learned memory second.
- `action_guard.py` — production-action safety boundary.
- `teach_screen.py` / `teach-screen.bat` — one-time teaching workflow.
- `intelligence-status.py` / `.bat` — local learning diagnostics.
- `local_ai.py` — disabled local-AI extension point.

## Test status in this package
- Python compile check: passed.
- Navigation/intelligence safety tests: **16/16 passed**.
- Website source was not changed by v8; npm dependencies were not available in the packaging environment, so the Nuxt build was not re-run here.
- Live Windows/JAB End-to-End must still be tested on the authorized ASYCUDA workstation.

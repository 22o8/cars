from __future__ import annotations
import sys
import time
from pathlib import Path

# Reuse the exact production navigation code, but never submit anything.
import agent


def main():
    print('=== Tarabil ASYCUDA v7 Smart Navigation Probe ===')
    print('SAFE TEST: this will NOT enter a company code and will NOT create a procedure.')
    print()
    if not agent.JAB_AVAILABLE:
        print('[ERROR] pyjab is not installed. Run enable-smart-mode.bat first.')
        return 2

    launched = agent.launch_asycuda()
    agent.login_if_needed(launched)
    drv = agent._jab_driver(force_new=True)
    if not drv:
        print('[ERROR] Java Access Bridge could not attach to ASYCUDA.')
        print('Run enable-smart-mode.bat, close every ASYCUDA window, reopen ASYCUDA, then retry.')
        return 3

    before = agent._jab_screen_state(drv)
    print('Detected starting state:', before['state'])
    ok = agent._navigate_to_unified_jab()
    if not ok:
        print('[ERROR] Smart navigation could not find Unified Procedure in the accessibility tree.')
        print('Run inspect-asycuda.bat and send the generated asycuda-accessibility-tree.txt for locator tuning.')
        return 4

    time.sleep(1)
    after = agent._jab_screen_state(drv)
    print('Detected final state:', after['state'])
    shot = agent.take_screenshot('v7-smart-probe')
    print('Screenshot:', shot)
    if after['state'] != 'unified':
        print('[WARNING] Navigation ran but Unified Procedure was not confidently detected.')
        return 5
    print('SMART TEST PASSED. No procedure was created.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

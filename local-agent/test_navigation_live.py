import sys
import agent
if __name__ == '__main__':
    try:
        lock = agent.acquire_instance_lock()
        print('Test version: ' + agent.VERSION, flush=True)
        print(agent.run_navigation_test()['message'])
    except Exception as exc:
        code = getattr(exc, 'code', type(exc).__name__)
        agent.save_ui_state(step='navigation_test', error=code + ': ' + str(exc))
        shot = agent._safe_error_screenshot()
        print(code + ': ' + str(exc), flush=True)
        if shot: print('Screenshot: ' + shot.name)
        sys.exit(1)
    finally:
        agent.HELPER.close()

import agent
if __name__ == '__main__':
 try:
  print(agent.run_navigation_test()['message'])
 except Exception as exc:
  shot=agent._safe_error_screenshot()
  print(getattr(exc,'code','agent_error'))
  if shot: print('Screenshot: '+shot.name)
 finally: agent.HELPER.close()

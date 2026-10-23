"""Single-instance hidden supervisor, rotating logs, bounded restart backoff."""
import ctypes
from pathlib import Path
import subprocess
import time
BASE=Path(__file__).resolve().parent

def main():
 kernel=ctypes.WinDLL('kernel32',use_last_error=True)
 kernel.CreateMutexW.restype=ctypes.c_void_p
 mutex=kernel.CreateMutexW(None,False,'Local\\TarabilAgentWatchdog')
 if not mutex or ctypes.get_last_error()==183: return
 delay=2
 logs=BASE/'logs'; logs.mkdir(exist_ok=True)
 while not (BASE/'STOP_AGENT').exists():
  path=logs/'agent.log'
  if path.exists() and path.stat().st_size>5_000_000:
   path.replace(logs/'agent.previous.log')
  started=time.monotonic()
  with path.open('ab') as output:
   process=subprocess.Popen([str(BASE/'.venv/Scripts/python.exe'),'-X','utf8',str(BASE/'agent.py')],cwd=BASE,stdout=output,stderr=output,creationflags=subprocess.CREATE_NO_WINDOW)
   while process.poll() is None:
    if (BASE/'STOP_AGENT').exists():
     # Agent observes STOP_AGENT between jobs; never terminate during an action.
     process.wait()
     return
    time.sleep(.5)
  if process.returncode==23: return
  delay=2 if time.monotonic()-started>60 else min(delay*2,60)
  time.sleep(delay)

if __name__=='__main__': main()

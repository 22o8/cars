"""Restore an explicit local backup; preserve config and environments."""
from pathlib import Path
import shutil
import socket
import sys
BASE=Path(__file__).resolve().parent
backup=Path(sys.argv[1]).resolve()
if not backup.is_relative_to((BASE/'backups').resolve()) or not (backup/'agent.py').is_file():
 raise SystemExit('Select a valid backup below this agent backups directory.')
lock=socket.socket()
try: lock.bind(('127.0.0.1',47621))
except OSError: raise SystemExit('Agent is running. Stop it between jobs before rollback.')
for source in backup.iterdir():
 if source.is_file() and source.name not in ('config.json','desktop.ini'):
  shutil.copy2(source,BASE/source.name)
print('Original files restored. Config and environments preserved. Review before restarting.')

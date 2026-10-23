import json
import os
from pathlib import Path
import queue
import subprocess
import threading
from navigation import NavigationError

class JABClient:
    def __init__(self, base):
        self.base, self.process = Path(base), None
    def start(self):
        if self.process and self.process.poll() is None: return
        python = self.base / '.venv32' / 'Scripts' / 'python.exe'
        self.process = subprocess.Popen([str(python), '-u', str(self.base / 'jab_helper.py')],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            encoding='utf-8', env={**os.environ, 'PYTHONUTF8': '1'},
            creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        self.responses = queue.Queue()
        process, responses = self.process, self.responses
        def read():
            for line in process.stdout: responses.put(line)
            responses.put(None)
        threading.Thread(target=read, daemon=True).start()
    def call(self, command, timeout=30, **kwargs):
        self.start()
        try:
            self.process.stdin.write(json.dumps({'command': command, **kwargs}) + '\n')
            self.process.stdin.flush()
            line = self.responses.get(timeout=timeout)
            if line is None: raise RuntimeError('helper exited')
            response = json.loads(line)
        except Exception:
            self.close()
            raise NavigationError('helper_unavailable', 'تعذر الاتصال بمساعد Java Access Bridge') from None
        if not response['ok']: raise NavigationError(response['code'], response['message'])
        return response['result']
    def close(self):
        if self.process:
            try:
                self.process.stdin.close()
                self.process.wait(timeout=2)
            except Exception: self.process.kill()
            self.process = None

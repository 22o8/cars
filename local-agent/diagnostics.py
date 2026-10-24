"""Secret-free diagnostics. Read-only: does not claim cloud jobs or click Java."""
import json
import os
import platform
from pathlib import Path
import struct
import subprocess
import sys
BASE=Path(__file__).resolve().parent
sys.stdout.reconfigure(encoding='utf-8',errors='replace')

def version(path):
 try:
  r=subprocess.run([str(path),'-c','import sys,struct; print(sys.version.split()[0], struct.calcsize("P")*8)'],capture_output=True,text=True,timeout=10)
  return r.stdout.strip() if r.returncode==0 else 'unavailable'
 except Exception: return 'unavailable'

def find_jab():
 home=os.environ.get('JAB_HOME','').strip()
 candidates=[]
 if home: candidates.append(Path(home)/'WindowsAccessBridge-32.dll')
 base=Path(r'C:\Program Files (x86)\Java')
 if base.exists(): candidates += sorted(base.glob(r'jre*\bin\WindowsAccessBridge-32.dll'),reverse=True)
 for c in candidates:
  if c.exists(): return c
 return None

def run():
 import agent
 jab=find_jab()
 java_bin=jab.parent if jab else None
 report={'agent_version':agent.VERSION,'windows':platform.platform(),
  'python64':{'path':sys.executable,'bits':struct.calcsize('P')*8,'version':platform.python_version()},
  'python32':{'path':str(BASE/'.venv32/Scripts/python.exe'),'version_bits':version(BASE/'.venv32/Scripts/python.exe')},
  'jab_dll':str(jab) if jab else 'not_found',
  'jp2launcher':'not_detected'}
 try:
  ps=subprocess.run(['powershell','-NoProfile','-Command',"(Get-Process jp2launcher -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty Path)"],capture_output=True,text=True,timeout=10)
  if ps.stdout.strip(): report['jp2launcher']=ps.stdout.strip()
 except Exception: pass
 props=Path.home()/'.accessibility.properties'
 report['jab_enabled_setting']=props.exists() and 'com.sun.java.accessibility.AccessBridge' in props.read_text(errors='replace')
 if java_bin:
  try:
   r=subprocess.run([str(java_bin/'java.exe'),'-version'],capture_output=True,text=True,timeout=10)
   report['java_version']=r.stderr.splitlines()[0] if r.stderr else 'unavailable'
  except Exception: report['java_version']='unavailable'
 report['asycuda_window_detected']=bool(agent.find_asycuda_window())
 try:
  memory_path=BASE/'screen-memory.json'
  if memory_path.exists():
   memory=json.loads(memory_path.read_text(encoding='utf-8'))
   report['intelligence']={'memory_screens':len(memory.get('screens',{})),'teachings':len(memory.get('teachings',{})),'transitions':len(memory.get('transitions',[]))}
  else: report['intelligence']={'memory_screens':0,'teachings':0,'transitions':0}
 except Exception: report['intelligence']='unavailable'
 report['credentials_present']={}
 for n in ('agent_device_token','asycuda_username','asycuda_password'):
  try: report['credentials_present'][n]=bool(agent.secret(n))
  except Exception: report['credentials_present'][n]='access_denied'
 try:
  r=agent.requests.get(agent.api_url('/api/agent/health'),headers=agent.cloud_headers(),timeout=15)
  report['authenticated_api_redis_http']=r.status_code
  report['authenticated_api_redis_ok']=r.status_code==200 and r.json().get('ok') is True
 except Exception: report['authenticated_api_redis_http']='unavailable'
 try:
  result=agent.HELPER.call('snapshot',timeout=25)
  report['current_state']=result['state']; report['jab_helper']='connected'; report['accessible_node_count']=len(result['snapshot']['nodes'])
 except Exception as e:
  report['jab_helper']=getattr(e,'code','unavailable'); report['current_state']='UNKNOWN'
 finally: agent.HELPER.close()
 folder=BASE/'logs'; folder.mkdir(exist_ok=True)
 (folder/'diagnostics.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
 print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=='__main__': run()

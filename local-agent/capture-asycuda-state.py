from pathlib import Path
import json, subprocess, time
BASE=Path(__file__).resolve().parent
helper=BASE/'.venv32'/'Scripts'/'python.exe'
script=BASE/'jab_helper.py'
if not helper.exists():
    raise SystemExit('Missing .venv32. Run install-agent.bat first.')
p=subprocess.Popen([str(helper),'-u',str(script)],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,encoding='utf-8',errors='replace')
try:
    p.stdin.write(json.dumps({'command':'snapshot'})+'\n'); p.stdin.flush()
    line=p.stdout.readline()
    data=json.loads(line)
    out=BASE/'diagnostics'; out.mkdir(exist_ok=True)
    path=out/f"asycuda-state-{time.strftime('%Y%m%d-%H%M%S')}.json"
    path.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
    result=data.get('result') or {}
    print('State:', result.get('state'))
    snap=result.get('snapshot') or {}
    print('PID:', snap.get('pid'))
    print('Java windows:', len(snap.get('javaWindows') or []))
    for w in snap.get('javaWindows') or []: print(w)
    print('Saved:', path)
finally:
    try: p.terminate()
    except: pass

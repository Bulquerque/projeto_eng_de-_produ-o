from pathlib import Path
import subprocess
ROOT=Path(__file__).resolve().parents[2]
files=sorted((ROOT/'assets/js/phase5').glob('*.js'))
assert files, 'no phase5 js files'
for f in files:
    res=subprocess.run(['node','--check',str(f)],cwd=ROOT,text=True,capture_output=True,timeout=30)
    assert res.returncode==0, f'{f}: {res.stderr}{res.stdout}'
print('PHASE5_JS_SYNTAX_OK')

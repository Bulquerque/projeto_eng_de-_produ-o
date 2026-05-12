from pathlib import Path
import subprocess
ROOT=Path(__file__).resolve().parents[2]
for path in sorted((ROOT/'assets/js/phase4').glob('*.js')):
    res=subprocess.run(['node','--check',str(path)],cwd=ROOT,text=True,capture_output=True)
    assert res.returncode==0, f'{path}: {res.stderr}{res.stdout}'
print('PHASE4_JS_SYNTAX_OK')

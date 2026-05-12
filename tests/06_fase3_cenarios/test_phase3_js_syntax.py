from pathlib import Path
import subprocess
ROOT=Path(__file__).resolve().parents[2]
files=sorted((ROOT/'assets/js/phase3').glob('*.js'))
assert files
for f in files:
    subprocess.run(['node','--check',str(f)],check=True,cwd=ROOT)
print('PHASE3_JS_SYNTAX_OK')

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / 'tests/06_fase3_cenarios/baseline_modes.mjs'

result = subprocess.run(['node', str(SCRIPT)], cwd=ROOT, text=True, capture_output=True, check=False)
assert result.returncode == 0, result.stderr + result.stdout
assert result.stdout.strip().endswith('BASELINE_MODES_OK')
print(result.stdout.strip())

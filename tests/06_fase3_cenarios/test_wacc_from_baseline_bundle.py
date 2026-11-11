import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / 'tests/06_fase3_cenarios/wacc_from_baseline_bundle.mjs'
result = subprocess.run(['node', str(SCRIPT)], cwd=ROOT, text=True, capture_output=True, check=False)
assert result.returncode == 0, result.stderr + result.stdout
assert result.stdout.strip().endswith('WACC_FROM_BUNDLE_OK')
print(result.stdout.strip())

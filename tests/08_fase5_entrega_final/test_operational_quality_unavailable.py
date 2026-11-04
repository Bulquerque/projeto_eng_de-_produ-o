import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / 'tests/08_fase5_entrega_final/operational_quality_unavailable.mjs'

result = subprocess.run(['node', str(SCRIPT)], cwd=ROOT, text=True, capture_output=True, check=False)
assert result.returncode == 0, result.stderr + result.stdout
assert result.stdout.strip().endswith('OPERATIONAL_QUALITY_UNAVAILABLE_OK')
print(result.stdout.strip())

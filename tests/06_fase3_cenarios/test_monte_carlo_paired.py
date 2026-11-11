import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / 'tests/06_fase3_cenarios/monte_carlo_paired.mjs'

result = subprocess.run(['node', str(SCRIPT)], cwd=ROOT, text=True, capture_output=True)
assert result.returncode == 0, result.stderr + result.stdout
assert 'MONTE_CARLO_PAIRED_OK' in result.stdout
print(result.stdout.strip())

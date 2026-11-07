import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / 'tests/09_quality_checks/physical_storage_fallback_diagnostics.mjs'

result = subprocess.run(['node', str(SCRIPT)], cwd=ROOT, text=True, capture_output=True, check=False)
assert result.returncode == 0, result.stderr + result.stdout
assert result.stdout.strip().endswith('PHYSICAL_STORAGE_FALLBACK_DIAGNOSTICS_OK')
print(result.stdout.strip())

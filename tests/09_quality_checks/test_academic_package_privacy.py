import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / 'tests/09_quality_checks/academic_package_privacy.mjs'

result = subprocess.run(['node', str(SCRIPT)], cwd=ROOT, text=True, capture_output=True)
assert result.returncode == 0, result.stderr + result.stdout
assert result.stdout.strip().endswith('ACADEMIC_PACKAGE_PRIVACY_OK')
print(result.stdout.strip())

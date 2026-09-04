import subprocess
import sys
from pathlib import Path

from suite_manifest import PUBLIC_TESTS

ROOT = Path(__file__).resolve().parents[1]

for rel in PUBLIC_TESTS:
    print(f'\n>>> {rel}', flush=True)
    result = subprocess.run(
        [sys.executable, str(ROOT / rel)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        timeout=300,
    )
    if result.stdout:
        print(result.stdout, end='')
    if result.stderr:
        print(result.stderr, end='', file=sys.stderr)
    if result.returncode != 0:
        raise SystemExit(result.returncode)

print('\nPUBLIC_TEST_SUITE_OK')
print('PROTECTED_TESTS_NOT_RUN: requerem VISAGIO_DATA_PASSWORD e são executados por tests/run_all_tests.py.')

import os
import subprocess
import sys
from pathlib import Path

from suite_manifest import PROTECTED_TESTS, PUBLIC_TESTS

ROOT = Path(__file__).resolve().parents[1]


def has_data_password() -> bool:
    if os.environ.get('VISAGIO_DATA_PASSWORD'):
        return True
    env_path = ROOT / '.env.local'
    if not env_path.exists():
        return False
    return any(
        line.startswith('VISAGIO_DATA_PASSWORD=') and line.split('=', 1)[1].strip().strip('\'"')
        for line in env_path.read_text(encoding='utf-8').splitlines()
    )


if not has_data_password():
    raise SystemExit(
        'FULL_SUITE_BLOCKED: VISAGIO_DATA_PASSWORD ausente. '
        'Nenhum teste protegido foi declarado aprovado. Use `npm run test:public` '
        'para a suíte sem segredo ou configure .env.local conforme .env.example.'
    )

TESTS = [*PUBLIC_TESTS, *PROTECTED_TESTS]

for rel in TESTS:
    print(f'\n>>> {rel}', flush=True)
    res = subprocess.run([sys.executable, str(ROOT / rel)], cwd=ROOT, text=True, capture_output=True, timeout=300)
    if res.stdout:
        print(res.stdout, end='')
    if res.stderr:
        print(res.stderr, end='', file=sys.stderr)
    if res.returncode != 0:
        raise SystemExit(res.returncode)

print('\nFULL_TEST_SUITE_OK')

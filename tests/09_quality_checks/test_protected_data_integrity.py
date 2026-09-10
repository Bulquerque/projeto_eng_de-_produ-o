import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_protected_data_policy():
    verification = subprocess.run(
        [sys.executable, str(ROOT / 'scripts/verify_encrypted_build.py')],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert verification.returncode == 0, verification.stderr or verification.stdout
    report = json.loads((ROOT / 'data/validation/protected-data-integrity.json').read_text(encoding='utf-8'))
    assert report['status'] == 'OK_PROTECTED_DATA_UNCHANGED'
    assert report['protected_paths'] == [
        'data/empresa1',
        'data/empresa2',
        'data/encrypted_manifest.json',
        'references/raw_sources',
    ]


if __name__ == '__main__':
    test_protected_data_policy()
    print('PROTECTED_DATA_INTEGRITY_OK')

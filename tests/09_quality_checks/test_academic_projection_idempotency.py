import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_academic_projection_idempotency():
    result = subprocess.run(
        ['node', str(ROOT / 'tests/09_quality_checks/academic_projection_idempotency.mjs')],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert 'ACADEMIC_PROJECTION_IDEMPOTENCY_OK' in result.stdout


if __name__ == '__main__':
    test_academic_projection_idempotency()
    print('ACADEMIC_PROJECTION_IDEMPOTENCY_OK')

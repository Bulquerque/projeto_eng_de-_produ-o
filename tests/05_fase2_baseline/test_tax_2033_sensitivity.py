import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_tax_2033_sensitivity():
    result = subprocess.run(
        ['node', str(ROOT / 'tests/05_fase2_baseline/tax_2033_sensitivity.mjs')],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert 'TAX_2033_SENSITIVITY_OK' in result.stdout


if __name__ == '__main__':
    test_tax_2033_sensitivity()
    print('TAX_2033_SENSITIVITY_OK')

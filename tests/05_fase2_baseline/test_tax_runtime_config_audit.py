import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_tax_runtime_config_audit():
    result = subprocess.run(
        ['node', str(ROOT / 'tests/05_fase2_baseline/tax_runtime_config_audit.mjs')],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert 'TAX_RUNTIME_CONFIG_AUDIT_OK' in result.stdout


if __name__ == '__main__':
    test_tax_runtime_config_audit()
    print('TAX_RUNTIME_CONFIG_AUDIT_OK')

import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_monte_carlo_battery():
    result = subprocess.run(
        ['node', str(ROOT / 'tests/06_fase3_cenarios/monte_carlo_battery.mjs')],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert 'MONTE_CARLO_BATTERY_OK' in result.stdout


if __name__ == '__main__':
    test_monte_carlo_battery()
    print('MONTE_CARLO_BATTERY_OK')

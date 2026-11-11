import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_phase5_physical_comparison():
    result = subprocess.run(
        ['node', str(ROOT / 'tests/07_fase4_score_otimizador/phase5_physical_comparison.mjs')],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert 'PHASE5_PHYSICAL_COMPARISON_OK' in result.stdout


if __name__ == '__main__':
    test_phase5_physical_comparison()
    print('PHASE5_PHYSICAL_COMPARISON_OK')

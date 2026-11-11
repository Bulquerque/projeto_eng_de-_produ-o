import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_optimizer_comparability():
    result = subprocess.run(
        ['node', str(ROOT / 'tests/07_fase4_score_otimizador/optimizer_comparability.mjs')],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert 'OPTIMIZER_COMPARABILITY_OK' in result.stdout


if __name__ == '__main__':
    test_optimizer_comparability()
    print('OPTIMIZER_COMPARABILITY_OK')

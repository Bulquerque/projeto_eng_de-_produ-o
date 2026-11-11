import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / 'tests/07_fase4_score_otimizador/refinement_search_space.mjs'


def test_refinement_candidates_are_counted_against_declared_domain():
    result = subprocess.run(
        ['node', str(SCRIPT)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert 'REFINEMENT_SEARCH_SPACE_OK' in result.stdout


if __name__ == '__main__':
    test_refinement_candidates_are_counted_against_declared_domain()
    print('REFINEMENT_SEARCH_SPACE_OK')

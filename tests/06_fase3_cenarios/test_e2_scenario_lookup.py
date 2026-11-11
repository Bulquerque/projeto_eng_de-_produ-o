import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def run_tests():
    result = subprocess.run(
        ['node', 'tests/06_fase3_cenarios/e2_scenario_lookup.test.mjs'],
        cwd=ROOT,
        check=False,
        text=True,
        capture_output=True,
        timeout=30,
    )
    if result.stdout:
        print(result.stdout, end='')
    if result.stderr:
        print(result.stderr, end='')
    if result.returncode:
        raise SystemExit(result.returncode)


if __name__ == '__main__':
    run_tests()

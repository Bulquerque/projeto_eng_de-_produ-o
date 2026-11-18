import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_decision_optimizer_flow_contracts():
    result = subprocess.run(
        ['node', str(ROOT / 'tests/12_network_intelligence/decision_optimizer_flow.mjs')],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
    )
    assert 'DECISION_OPTIMIZER_FLOW_OK' in result.stdout


if __name__ == '__main__':
    test_decision_optimizer_flow_contracts()
    print('DECISION_OPTIMIZER_FLOW_TEST_OK')

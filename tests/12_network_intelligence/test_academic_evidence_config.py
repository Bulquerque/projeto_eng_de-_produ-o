import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = [
    (ROOT / 'tests/academic_evidence_config_contract.mjs', 'ACADEMIC_EVIDENCE_CONFIG_CONTRACT_OK'),
    (ROOT / 'tests/12_network_intelligence/academic_scenario_plan.test.mjs', 'ACADEMIC_SCENARIO_PLAN_OK'),
]

for script, expected_marker in SCRIPTS:
    result = subprocess.run(['node', str(script)], cwd=ROOT, text=True, capture_output=True, check=False)
    assert result.returncode == 0, result.stderr + result.stdout
    assert result.stdout.strip().endswith(expected_marker), result.stdout
    print(result.stdout.strip())

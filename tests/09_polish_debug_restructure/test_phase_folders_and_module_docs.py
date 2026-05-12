import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
PHASES=['phase-01-data-validation','phase-02-baseline-parity','phase-03-scenario-arena','phase-04-scoring-optimizer','phase-05-final-delivery']
def test_phase_folders_exist_with_module_docs():
    contracts=json.loads((ROOT/'data/contracts/module_contracts_all_phases.json').read_text(encoding='utf-8'))
    assert (ROOT/'phases/README.md').exists()
    for slug in PHASES:
        p=ROOT/'phases'/slug; assert p.exists(); assert (p/'README.md').exists(); assert (p/'modules').exists()
    for m in contracts['modules']:
        mod=ROOT/'phases'/PHASES[int(m['phase'])-1]/'modules'/m['id']
        assert (mod/'README.md').exists(), m['id']; assert (mod/'contract.json').exists(), m['id']; assert (mod/'tests.md').exists(), m['id']
if __name__=='__main__': test_phase_folders_exist_with_module_docs(); print('PHASE_FOLDER_MODULE_DOCS_OK')

from pathlib import Path
import json
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tests.crypto_helpers import decrypt_json
ROOT=Path(__file__).resolve().parents[2]
for company in ['empresa1','empresa2']:
    samples=decrypt_json(f'data/{company}/phase3/sample_scenarios.json')
    bundle=decrypt_json(f'data/{company}/phase2/phase2_bundle.json')
    assert samples, f'No samples for {company}'
    for s in samples:
        assert s['company_id']==company
        assert s['base_scenario_id']==bundle['model']['scenario_id']
        assert s['metadata']['phase']==3
        assert 'changes' in s and isinstance(s['changes'],dict)
        assert 'active_cds' in s['changes'] and s['changes']['active_cds']
        assert s['changes']['tax_mode'] in ['current','disabled']
report=json.load(open(ROOT/'data/validation/phase3_implementation_report.json',encoding='utf-8'))
assert report['result']=='OK'
assert len(report['modules'])>=11
print('PHASE3_CONTRACTS_OK')

import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
from tests.crypto_helpers import NODE_DECRYPT_HELPER, decrypt_json


def find_project_root() -> Path:
    here = Path(__file__).resolve()
    for candidate in [here.parent, *here.parents]:
        if (candidate / 'index.html').exists() and (candidate / 'data').exists():
            return candidate
    raise RuntimeError('Project root not found')


ROOT = find_project_root()


def load(rel):
    if rel.startswith('data/empresa'):
        return decrypt_json(rel)
    return json.loads((ROOT / rel).read_text(encoding='utf-8'))


def load_runtime_bundle(company_id: str):
    code = (
        NODE_DECRYPT_HELPER
        + r"""
import fs from 'fs';
import { recomputePhase2Baseline } from './assets/js/shared/phase2-baseline-deriver.js';

const companyId = __COMPANY_ID__;
const bundle = decryptJson(`data/${companyId}/phase2/phase2_bundle.json`);

if (companyId === 'empresa1') {
  bundle.core_data = {
    distance_matrix: decryptJson('data/empresa1/core/distance_matrix.json'),
    aux_custo_transferencia: decryptJson('data/empresa2/core/aux_custo_transferencia.json'),
    tax_data: JSON.parse(fs.readFileSync('data/complements/shared/tax_reference/icms_interstate_matrix.json', 'utf8')),
  };
}

const derived = recomputePhase2Baseline(bundle, companyId);
console.log(JSON.stringify(derived));
""".replace('__COMPANY_ID__', json.dumps(company_id))
    )
    res = subprocess.run(
        ['node', '--input-type=module', '-e', code],
        cwd=ROOT,
        text=True,
        capture_output=True,
        timeout=120,
    )
    assert res.returncode == 0, res.stderr + res.stdout
    return json.loads(res.stdout)


def test_phase2_files_exist():
    required = []
    for c in ['empresa1', 'empresa2']:
        for n in ['baseline_model', 'baseline_flows', 'baseline_costs', 'tax_results', 'base_fit', 'phase2_bundle']:
            required.append(f'data/{c}/phase2/{n}.json.enc.json')
    required += [
        'fase-2-baseline/index.html',
        'assets/js/phase2/main.js',
        'data/validation/phase2_implementation_report.json',
    ]
    missing = [p for p in required if not (ROOT / p).exists()]
    assert not missing, missing


def test_empresa1_baseline_contract():
    b = load_runtime_bundle('empresa1')
    assert b['model']['company_id'] == 'empresa1'
    assert b['model']['baseline_ready'] is True
    assert b['flow_summary']['total_flows'] > 0
    assert b['base_fit']['status'] == 'benchmark_pending'
    assert b['base_fit']['base_fit_score'] is None
    costs = b['costs']['costs']
    raw_costs = b['phase2_raw']['costs']['costs']
    assert raw_costs['tax_impact'] == 0
    assert raw_costs['transfer_cost'] == 0
    assert costs['transfer_cost'] > 0
    assert costs['distribution_cost'] > 0
    assert costs['storage_cost'] > 0
    assert costs['inventory_cost'] > 0
    assert costs['tax_impact'] > 0
    assert costs['total_logistics_cost'] > 0
    assert abs(costs['total_logistics_cost'] + costs['tax_impact'] - costs['total_with_tax']) < 0.05
    breakdown_by_metric = {row['metric']: row for row in b['costs']['cost_breakdown']}
    assert breakdown_by_metric['transfer_cost']['source'] == 'distance_matrix_recomputed_with_transfer_proxy'
    assert breakdown_by_metric['distribution_cost']['source'] == 'distance_matrix_recomputed'
    tax = b['tax_results']
    assert tax['tax_results']['total_tax_impact'] > 0
    assert tax['tax_coverage']['coverage_pct'] > 0


def test_empresa2_baseline_contract():
    b = load('data/empresa2/phase2/phase2_bundle.json')
    assert b['model']['company_id'] == 'empresa2'
    assert b['model']['baseline_ready'] is True
    assert b['flow_summary']['total_flows'] > 0
    assert b['base_fit']['status'] == 'benchmark_pending'
    assert b['base_fit']['base_fit_score'] is None
    assert b['base_fit']['reference_source'] is None
    costs = b['costs']['costs']
    assert costs['transfer_cost'] > 0
    assert costs['distribution_cost'] > 0
    assert costs['tax_impact'] > 0
    assert costs['total_with_tax'] > costs['total_logistics_cost']
    tax = b['tax_results']
    assert tax['tax_reconciliation']['status'] == 'within_tolerance'
    assert abs(tax['tax_reconciliation']['difference_pct']) < 0.001
    assert abs(tax['tax_reconciliation']['raw_difference_pct']) > 1
    assert tax['tax_reconciliation']['adjustment_factor'] is not None
    assert any('conciliada' in w.lower() for w in tax['warnings'])


def test_cost_totals_close():
    for c in ['empresa1', 'empresa2']:
        b = load(f'data/{c}/phase2/phase2_bundle.json')
        costs = b['costs']['costs']
        total = costs['transfer_cost'] + costs['distribution_cost'] + costs['storage_cost'] + costs['inventory_cost']
        assert abs(total - costs['total_logistics_cost']) < 0.05
        assert abs(costs['total_logistics_cost'] + costs['tax_impact'] - costs['total_with_tax']) < 0.05


def test_phase2_catalog_paths_exist():
    cat = load('data/catalog.json')
    assert cat['phase2']['status'] == 'implemented'
    missing = []
    for company, info in cat['phase2']['companies'].items():
        for k, v in info.items():
            if isinstance(v, str) and v.startswith('data/empresa') and not (ROOT / f'{v}.enc.json').exists():
                missing.append((company, k, v))
            elif (
                isinstance(v, str)
                and v.startswith('data/')
                and not v.startswith('data/empresa')
                and not (ROOT / v).exists()
            ):
                missing.append((company, k, v))
    assert not missing, missing


if __name__ == '__main__':
    test_phase2_files_exist()
    test_empresa1_baseline_contract()
    test_empresa2_baseline_contract()
    test_cost_totals_close()
    test_phase2_catalog_paths_exist()
    print('PHASE2_DATA_CONTRACTS_OK')

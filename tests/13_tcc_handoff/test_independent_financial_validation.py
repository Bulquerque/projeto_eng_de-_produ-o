import runpy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
validate = runpy.run_path(str(ROOT / 'scripts/audit/validate_tcc_handoff.py'))['validate_numeric_rows']

scenario = {
    'run_id': 'run-1',
    'company_id': 'empresa1',
    'scenario_id': 'example',
    'baseline_comparable_id': 'baseline',
    'transfer_brl': '10',
    'distribution_brl': '20',
    'storage_brl': '30',
    'inventory_brl': '40',
    'logistics_brl': '100',
    'tax_impact_brl': '20',
    'total_with_tax_brl': '120',
    'baseline_total_brl': '150',
    'saving_total_pct': '20',
    'baseline_logistics_brl': '125',
    'saving_logistics_pct': '20',
    'source_classification': 'PARAMETRIC_EXPLORATORY',
}
path = '04_CENARIOS_E_OTIMIZACAO/scenario_summary_all.csv'
assert not validate(path, [scenario], 'run-1')
assert validate(path, [{**scenario, 'total_with_tax_brl': '121'}], 'run-1')
assert validate(path, [{**scenario, 'saving_total_pct': 'NaN'}], 'run-1')
assert validate(path, [{**scenario, 'run_id': 'other'}], 'run-1')
mc = {
    'run_id': 'run-1',
    'company_id': 'empresa1',
    'scenario_id': 'example',
    'baseline_scenario_id': 'baseline',
    'paired_method': 'common_random_numbers_v1',
    'iterations_requested': '300',
    'iterations_valid': '295',
    'iterations_invalid': '5',
    'prob_candidate_cheaper': '0.5',
    'prob_tie': '0.1',
    'p10_delta_cost_brl': '-2',
    'p50_delta_cost_brl': '0',
    'p90_delta_cost_brl': '2',
}
mc_path = '05_MONTE_CARLO/monte_carlo_paired_summary.csv'
assert not validate(mc_path, [mc], 'run-1')
assert validate(mc_path, [{**mc, 'iterations_invalid': '6'}], 'run-1')
assert validate(mc_path, [{**mc, 'p10_delta_cost_brl': '3'}], 'run-1')
print('INDEPENDENT_FINANCIAL_VALIDATION_OK')

import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('handoff_builder_mc', ROOT / 'scripts/audit/build_tcc_handoff.py')
BUILDER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILDER)


def test_monte_carlo_projection_keeps_scenario_identity_and_seed_provenance_without_private_names():
    def entry(key, seed):
        return {
            'scenario_key': key,
            'seed': seed,
            'profile': 'balanced',
            'tax_year': 2033,
            'tax_mode': 'reform_full_2033',
            'iterations_requested': 300,
            'monte_carlo_status': 'success',
            'data_quality_status': 'limited_fiscal_coverage',
            'pairing': {
                'status': 'paired',
                'method': 'common_random_numbers_v1',
                'baseline_mode': 'physical_unanchored',
            },
            'summary': {
                'seed_effective': 999 + seed,
                'rng_algorithm': 'mulberry32-v1',
                'iterations_valid': 300,
                'mean_delta_cost_brl': -123.5,
                'uncertainty_source': 'parametric_assumptions',
            },
            'location': 'PRIVATE_SENTINEL',
        }

    evidence = {
        'companies': {
            'empresa2': {
                'monte_carlo_battery': [
                    entry('single_cd_es_2033', 42),
                    entry('single_cd_es_2033', 43),
                    entry('single_cd_es', 42),
                    entry('PRIVATE_SENTINEL', 42),
                ]
            }
        }
    }
    headers = BUILDER.CSV_HEADERS['05_MONTE_CARLO/monte_carlo_paired_summary.csv']
    rows = [dict(zip(headers, row, strict=True)) for row in BUILDER.projected_monte_carlo_rows(evidence, 'run')]
    assert len(rows) == 3
    assert rows[0]['scenario_id'] == rows[1]['scenario_id'] != rows[2]['scenario_id']
    assert rows[0]['baseline_scenario_id'] == rows[1]['baseline_scenario_id']
    assert rows[0]['seed_effective'] == 1041
    assert rows[0]['rng_algorithm'] == 'mulberry32-v1'
    assert rows[0]['mean_delta_cost_brl'] == -123.5
    assert rows[0]['tax_year'] == 2033 and rows[0]['tax_mode'] == 'reform_full_2033'
    assert rows[0]['sampling_source'] == 'parametric_assumptions'
    assert 'PRIVATE_SENTINEL' not in str(rows)


if __name__ == '__main__':
    test_monte_carlo_projection_keeps_scenario_identity_and_seed_provenance_without_private_names()
    print('MONTE_CARLO_PROJECTION_OK')

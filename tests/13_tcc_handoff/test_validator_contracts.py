import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC = importlib.util.spec_from_file_location('handoff_validator', ROOT / 'scripts/audit/validate_tcc_handoff.py')
validator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(validator)


def test_scenario_csv_rejects_missing_required_fields():
    errors = validator.validate_numeric_rows(
        '04_CENARIOS_E_OTIMIZACAO/scenario_summary_all.csv',
        [{'run_id': 'run', 'logistics_brl': '123'}],
        'run',
        ['run_id', 'logistics_brl'],
    )
    assert any('missing required columns' in error for error in errors)


def test_blocked_placeholder_schema_remains_allowed():
    fields = ['status', 'reason_code', 'blocking_reason']
    rows = [{'status': 'BLOCKED_SOURCE', 'reason_code': 'NO_DATA', 'blocking_reason': 'source unavailable'}]
    assert not validator.validate_numeric_rows('03_TRIBUTACAO/2033_scenario_comparison.csv', rows, 'run', fields)


def test_authorized_docx_hash_must_match_manifest():
    data = b'example docx payload'
    assert not validator.validate_manuscript_hash(data, {'authorized_manuscript_sha256': validator.sha256(data)})
    assert validator.validate_manuscript_hash(data, {'authorized_manuscript_sha256': '0' * 64})
    assert validator.validate_manuscript_hash(data, {})


def test_privacy_warning_alone_does_not_imply_scientific_block():
    assert validator.scientific_readiness('UNASSESSED', blocked=False, errors=[]) == 'UNASSESSED'
    assert (
        validator.scientific_readiness('BLOCKED_FOR_FINAL_NUMERICAL_CLAIMS', blocked=False, errors=[])
        == 'BLOCKED_FOR_FINAL_NUMERICAL_CLAIMS'
    )
    assert validator.scientific_readiness('UNASSESSED', blocked=True, errors=[]) == 'BLOCKED_FOR_FINAL_NUMERICAL_CLAIMS'


if __name__ == '__main__':
    test_scenario_csv_rejects_missing_required_fields()
    test_blocked_placeholder_schema_remains_allowed()
    test_authorized_docx_hash_must_match_manifest()
    test_privacy_warning_alone_does_not_imply_scientific_block()
    print('VALIDATOR_CONTRACTS_OK')

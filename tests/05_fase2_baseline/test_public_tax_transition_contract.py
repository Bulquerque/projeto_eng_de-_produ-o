import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TAX_REFERENCE = ROOT / 'data/complements/shared/tax_reference'


def _read_json(name):
    return json.loads((TAX_REFERENCE / name).read_text(encoding='utf-8'))


def test_published_transition_calendar_matches_legal_schedule_summary():
    periods = _read_json('tax_reform_timeline.json')
    by_year = {row['ano']: row for row in periods}
    expected = {
        2029: (0.9, 0.1),
        2030: (0.8, 0.2),
        2031: (0.7, 0.3),
        2032: (0.6, 0.4),
        2033: (0.0, 1.0),
    }
    for year, (legacy_share, ibs_summary) in expected.items():
        assert year in by_year
        assert by_year[year]['peso_icms_iss_regime_atual'] == legacy_share
        assert by_year[year]['peso_ibs_regime_novo'] == ibs_summary


def test_metadata_and_checklist_separate_model_parameters_from_company_tax_validation():
    fields = _read_json('model_fields_required.json')
    by_name = {row['campo']: row for row in fields}
    for name in ('ibs_weight', 'current_tax_weight'):
        assert by_name[name]['fonte_preferencial'] == 'parâmetro do modelo'
        assert 'Variável operacional do modelo' in by_name[name]['descricao']
        assert 'não é alíquota legal' in by_name[name]['descricao']
        assert 'documentar hipótese e fórmula' in by_name[name]['validacao']

    checklist = _read_json('validation_checklist.json')
    transition_check = next(item for item in checklist if item['grupo'] == 'reforma')
    assert 'Consistência estrutural' in transition_check['checagem']
    assert '90%' in transition_check['criterio_de_ok']
    assert '2033' in transition_check['criterio_de_ok']
    assert 'não alíquotas, créditos ou carga tributária da empresa' in transition_check['criterio_de_ok']
    assert 'não usar esta checagem como validação fiscal empresarial' in transition_check['acao_se_falhar']

    sources = _read_json('source_catalog.json')
    rf_source = next(item for item in sources if item['source_id'] == 'rf_entenda_reforma')
    assert 'não fornece pesos da carga tributária empresarial' in rf_source['uso_no_modelo']
    with (TAX_REFERENCE / 'source_catalog.csv').open(encoding='utf-8', newline='') as handle:
        csv_source = next(row for row in csv.DictReader(handle) if row['source_id'] == 'rf_entenda_reforma')
    assert csv_source['uso_no_modelo'] == rf_source['uso_no_modelo']


if __name__ == '__main__':
    test_published_transition_calendar_matches_legal_schedule_summary()
    test_metadata_and_checklist_separate_model_parameters_from_company_tax_validation()
    print('PUBLIC_TAX_TRANSITION_CONTRACT_OK')

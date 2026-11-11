import importlib.util
import sys
from pathlib import Path

MODULE_PATH = Path(__file__).resolve().parents[2] / 'scripts' / 'audit' / 'diagnose_tax_c01_c04_c08.py'
SPEC = importlib.util.spec_from_file_location('tax_audit_diagnostics', MODULE_PATH)
tax_audit = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = tax_audit
SPEC.loader.exec_module(tax_audit)


def run_tests():
    test_c08_exclusion_summary_excludes_nonbaseline_rows_and_reports_blank_rows()
    test_c08_exclusion_summary_counts_a_real_baseline_tax_contribution()
    test_private_tax_number_parser_handles_locale_and_rejects_placeholders()
    test_c08_bridge_marks_residual_unexplained_when_no_exclusion_bridge_closes_it()
    test_c01_same_network_with_anchored_and_recalculated_tax_is_not_method_comparable()
    test_c04_without_flow_to_cd_allocation_is_not_equivalent_scenario()
    test_c08_counts_duplicate_core_ids_instead_of_hiding_them()
    print('TAX_AUDIT_DIAGNOSTICS_OK')


def test_c08_exclusion_summary_excludes_nonbaseline_rows_and_reports_blank_rows():
    source_rows = [
        {'row_id': '1', 'scenario': 'baseline', 'debit': '10.00', 'credit': '2.00', 'other': 'x'},
        {'row_id': '2', 'scenario': 'other', 'debit': '500.00', 'credit': '0.00', 'other': 'x'},
        {'row_id': '3', 'scenario': '', 'debit': '', 'credit': '', 'other': ''},
    ]
    result = tax_audit.classify_c08_exclusions(
        source_rows,
        {'1'},
        row_id_field='row_id',
        scenario_field='scenario',
        debit_field='debit',
        credit_field='credit',
        baseline_scenario='baseline',
    )

    assert result['source_rows'] == 3
    assert result['core_rows'] == 1
    assert result['missing_rows'] == 2
    assert result['classes']['blank']['row_count'] == 1
    assert result['classes']['non_baseline']['row_count'] == 1
    assert result['baseline_missing_rows'] == 0
    assert result['missing_baseline_tax_contribution'] == 0


def test_c08_exclusion_summary_counts_a_real_baseline_tax_contribution():
    result = tax_audit.classify_c08_exclusions(
        [{'row_id': '7', 'scenario': 'baseline', 'debit': 'R$ 1.234,56', 'credit': '234,56'}],
        set(),
        row_id_field='row_id',
        scenario_field='scenario',
        debit_field='debit',
        credit_field='credit',
        baseline_scenario='baseline',
    )

    assert result['baseline_missing_rows'] == 1
    assert result['missing_baseline_tax_contribution'] == 1000.0


def test_private_tax_number_parser_handles_locale_and_rejects_placeholders():
    from decimal import Decimal

    assert tax_audit._parse_tax_number('R$ 1.234,56') == Decimal('1234.56')
    assert tax_audit._parse_tax_number('(234,50)') == Decimal('-234.50')
    assert tax_audit._parse_tax_number('0.25') == Decimal('0.25')
    assert tax_audit._parse_tax_number('n/a') is None


def test_c08_bridge_marks_residual_unexplained_when_no_exclusion_bridge_closes_it():
    result = tax_audit.reconcile_c08_totals(
        canonical_total=130.0,
        matrix_total=100.0,
        explained_adjustments=0.0,
        tolerance_brl=0.01,
    )

    assert result['delta_brl'] == -30.0
    assert result['bridge_residual_brl'] == -30.0
    assert result['status'] == 'unexplained_delta'


def test_c01_same_network_with_anchored_and_recalculated_tax_is_not_method_comparable():
    result = tax_audit.classify_c01_comparability(
        same_network=True,
        left_method='canonical_baseline_reference',
        right_method='physical_distance_matrix_kilometric',
    )

    assert result['status'] == 'NOT_COMPARABLE_METHOD'
    assert result['same_network'] is True


def test_c04_without_flow_to_cd_allocation_is_not_equivalent_scenario():
    result = tax_audit.classify_c04_comparability(
        has_flow_to_cd_allocation=False,
        same_tax_regime=None,
        same_demand_basis=None,
    )

    assert result['status'] == 'NOT_EQUIVALENT_SCENARIO'
    assert result['reason_code'] == 'MISSING_FLOW_TO_CD_ALLOCATION'
    assert result['same_tax_regime'] is None
    assert result['same_demand_basis'] is None


def test_c08_counts_duplicate_core_ids_instead_of_hiding_them():
    report = tax_audit.classify_c08_exclusions(
        [{'row_id': '1', 'scenario': 'baseline'}],
        ['1', '1'],
        row_id_field='row_id',
        scenario_field='scenario',
        debit_field='debit',
        credit_field='credit',
        baseline_scenario='baseline',
    )
    assert report['core_duplicate_id_count'] == 1


if __name__ == '__main__':
    run_tests()

import json
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BUILDER = ROOT / 'scripts/audit/build_tcc_handoff.py'
VALIDATOR = ROOT / 'scripts/audit/validate_tcc_handoff.py'


def test_builder_creates_blocked_status_package_and_validator_accepts_structure():
    with tempfile.TemporaryDirectory() as directory:
        temp = Path(directory)
        package = temp / 'handoff.zip'
        report = temp / 'validation.json'
        subprocess.run(
            [sys.executable, str(BUILDER), '--output', str(package), '--evidence', str(temp / 'missing-evidence.json')],
            check=True,
            capture_output=True,
            text=True,
        )
        result = subprocess.run(
            [sys.executable, str(VALIDATOR), str(package), '--write-report', str(report)],
            check=False,
            capture_output=True,
            text=True,
        )
        assert result.returncode == 0, result.stdout + result.stderr
        validation = json.loads(report.read_text())
        assert validation['structural_status'] == 'PASS'
        assert validation['scientific_status'] == 'BLOCKED_FOR_FINAL_NUMERICAL_CLAIMS'
        with zipfile.ZipFile(package) as archive:
            members = archive.namelist()
            assert len({name.split('/')[0] for name in members}) == 1
            manifest = json.loads(
                archive.read(next(name for name in members if name.endswith('/00_MANIFESTO/run_manifest.json')))
            )
            assert manifest['overall_status'] == 'BLOCKED_FOR_FINAL_NUMERICAL_CLAIMS'
            assert manifest['p0_fail_count'] is None
            assert manifest['p0_blocked_count'] is None
            readme = archive.read(next(name for name in members if name.endswith('/LEIA_ME_PRIMEIRO.md')))
            assert b'Achados que afetam a reda' in readme
            registry = archive.read(next(name for name in members if name.endswith('/00_MANIFESTO/file_registry.csv')))
            assert b'BLOCKED_SOURCE' in registry
            assert not any(name.endswith(('.docx', '.png', '.enc.json')) for name in members)


def test_validator_rejects_tampered_member():
    with tempfile.TemporaryDirectory() as directory:
        temp = Path(directory)
        package = temp / 'handoff.zip'
        tampered = temp / 'tampered.zip'
        subprocess.run(
            [sys.executable, str(BUILDER), '--output', str(package), '--evidence', str(temp / 'missing-evidence.json')],
            check=True,
            capture_output=True,
            text=True,
        )
        with zipfile.ZipFile(package) as original, zipfile.ZipFile(tampered, 'w', zipfile.ZIP_DEFLATED) as target:
            for name in original.namelist():
                data = original.read(name)
                if name.endswith('/STATUS_FINAL.md'):
                    data += b'\nTAMPER\n'
                target.writestr(name, data)
        result = subprocess.run(
            [sys.executable, str(VALIDATOR), str(tampered)],
            check=False,
            capture_output=True,
            text=True,
        )
        assert result.returncode == 1
        assert 'Checksum mismatch' in result.stdout


def test_scenarios_use_physical_reference_and_keep_incomparable_saving_empty():
    import importlib.util

    spec = importlib.util.spec_from_file_location('handoff_builder', BUILDER)
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    company = {
        'baseline': {'costs': {'total_logistics_cost': 200}},
        'baseline_physical': {'costs': {'total_logistics_cost': 100}},
        'academic_comparison_type': 'different_network_same_engine_physical_unanchored',
        'academic_scenario_results': [
            {
                'scenario': {'scenario_kind': 'e1_single_cd_anonymized'},
                'deterministic': {'costs': {'total_logistics_cost': 80}},
            },
            {
                'scenario': {'scenario_kind': 'e1_single_cd_anonymized'},
                'deterministic': {'costs': {'total_logistics_cost': 90}},
            },
        ],
    }
    header = builder.CSV_HEADERS['04_CENARIOS_E_OTIMIZACAO/scenario_summary_all.csv']
    rows = [
        dict(zip(header, row, strict=False))
        for row in builder.projected_scenario_rows({'companies': {'empresa1': company}}, 'run')
    ]
    scenarios = rows[2:]
    assert len({row['scenario_id'] for row in scenarios}) == 2
    assert scenarios[0]['baseline_comparable_id'] == 'empresa1-baseline_physical'
    assert scenarios[0]['baseline_logistics_brl'] == 100
    assert scenarios[0]['saving_logistics_pct'] == 20
    company['academic_comparison_type'] = 'unknown'
    rows = [
        dict(zip(header, row, strict=False))
        for row in builder.projected_scenario_rows({'companies': {'empresa1': company}}, 'run')
    ]
    assert rows[2]['saving_logistics_pct'] == ''
    assert rows[2]['baseline_comparable_id'] == ''
    assert builder.as_number(float('nan')) == ''
    assert builder.as_number(float('inf')) == ''


def test_authorized_docx_is_copied_exactly_and_marked_private():
    import csv
    import hashlib
    import io

    with tempfile.TemporaryDirectory() as directory:
        temp = Path(directory)
        source = temp / 'authorized.docx'
        # A minimal DOCX container tests that the ZIP embeds the original bytes.
        with zipfile.ZipFile(source, 'w') as doc:
            doc.writestr('[Content_Types].xml', '<Types/>')
            doc.writestr('word/document.xml', '<document/>')
            doc.writestr('word/comments.xml', '<comments/>')
        package = temp / 'handoff.zip'
        subprocess.run(
            [
                sys.executable,
                str(BUILDER),
                '--output',
                str(package),
                '--evidence',
                str(temp / 'missing-evidence.json'),
                '--reviewer-docx',
                str(source),
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        with zipfile.ZipFile(package) as archive:

            def get(suffix):
                return archive.read(next(name for name in archive.namelist() if name.endswith('/' + suffix)))

            payload = get('11_DOCUMENTOS_TCC/TCC_BASE_PARA_REVISAO.docx')
            assert payload == source.read_bytes()
            registry = list(csv.DictReader(io.StringIO(get('00_MANIFESTO/file_registry.csv').decode())))
            row = next(row for row in registry if row['path'].endswith('.docx'))
            assert row['produced'] == 'true'
            assert row['sensitivity'] == 'PRIVATE_REVIEWER_ONLY'
            inventory = get('11_DOCUMENTOS_TCC/INVENTARIO_DOCUMENTAL.md').decode()
            assert hashlib.sha256(payload).hexdigest() in inventory
            assert 'PRIVATE_REVIEWER_ONLY' in inventory


def test_traceable_evidence_requires_current_clean_commit():
    import importlib.util
    from unittest.mock import patch

    spec = importlib.util.spec_from_file_location('handoff_builder', BUILDER)
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    evidence = {'commit_final': 'a' * 40, 'run_id': 'run', 'run_key': 'b' * 64, 'dirty_worktree': False}
    with patch.object(builder, 'git_value', side_effect=lambda *args: 'a' * 40 if args[0] == 'rev-parse' else ''):
        assert builder.evidence_is_traceable(evidence)
    with patch.object(builder, 'git_value', side_effect=lambda *args: 'c' * 40 if args[0] == 'rev-parse' else ''):
        assert not builder.evidence_is_traceable(evidence)
    with patch.object(
        builder, 'git_value', side_effect=lambda *args: 'a' * 40 if args[0] == 'rev-parse' else ' M changed'
    ):
        assert not builder.evidence_is_traceable(evidence)


def test_e2_subsets_and_tax_disabled_profiles_are_projected_without_sensitive_ids():
    import importlib.util

    spec = importlib.util.spec_from_file_location('handoff_builder', BUILDER)
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    evidence = {
        'companies': {
            'empresa1': {
                'optimization_tax_disabled': {'balanced': {'best': [{'total_with_tax': 50}], 'search_completeness': {}}}
            },
            'empresa2': {
                'baseline_physical': {'costs': {'total_logistics_cost': 100}},
                'academic_comparison_type': 'different_network_same_engine_physical_unanchored',
                'empresa2_subsets': [
                    {'subset_id': 'secret_identifier', 'result': {'costs': {'total_logistics_cost': 80}}}
                ],
                'empresa2_one_cd_es': {
                    'current': {'costs': {'total_logistics_cost': 70}},
                    'comparison_to_workbook': 'NOT_EQUIVALENT_SCENARIO',
                },
            },
        }
    }
    scenario = builder.projection_content('04_CENARIOS_E_OTIMIZACAO/scenario_summary_all.csv', evidence, 'run').decode()
    assert 'secret_identifier' not in scenario
    assert 'empresa2-subset_001' in scenario
    assert 'empresa2-one_cd_es' in scenario
    profiles = builder.projection_content(
        '04_CENARIOS_E_OTIMIZACAO/tabela_4_5_e1_sem_tributo.csv', evidence, 'run'
    ).decode()
    assert 'balanced' in profiles
    assert 'tax_disabled' in profiles


def test_fiscal_sensitivity_projection_is_aggregate_and_explicitly_exploratory():
    import importlib.util

    spec = importlib.util.spec_from_file_location('handoff_builder', BUILDER)
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    rows = [
        {
            'scenario': scenario,
            'assumption': assumption,
            'tax_year': 2033,
            'tax_regime': 'reform_full_2033',
            'simulation_status': 'success',
            'logistics_brl': 100,
            'cbs_brl': 4,
            'ibs_brl': 5,
            'selective_tax_brl': 1,
            'credits_brl': 0,
            'current_tax_brl': 0,
            'tax_impact_brl': 10,
            'total_with_tax_brl': 110,
            'secret_location': 'DO_NOT_EXPORT',
        }
        for assumption in ('configured_selective_tax', 'no_selective_tax')
        for scenario in ('baseline', 'candidate')
    ]
    evidence = {'companies': {'empresa2': {'empresa2_one_cd_es': {'tax_2033_sensitivity': rows}}}}
    output = builder.projection_content('03_TRIBUTACAO/tax_2033_sensitivity.csv', evidence, 'run').decode()
    assert 'no_selective_tax' in output
    assert 'PARAMETRIC_EXPLORATORY' in output
    assert 'DO_NOT_EXPORT' not in output
    assert 'PENDING' in output
    for path in ('03_TRIBUTACAO/2033_scenario_comparison.csv', '03_TRIBUTACAO/2033_tax_breakdown.csv'):
        output = builder.projection_content(path, evidence, 'run').decode()
        assert 'baseline' in output and 'candidate' in output
        assert 'PARAMETRIC_EXPLORATORY' in output
        assert 'DO_NOT_EXPORT' not in output
    rows[1]['simulation_status'] = 'error'
    assert builder.projection_content('03_TRIBUTACAO/2033_scenario_comparison.csv', evidence, 'run') is None
    assert builder.projection_content('03_TRIBUTACAO/2033_tax_breakdown.csv', evidence, 'run') is None
    remaining = builder.projection_content('03_TRIBUTACAO/tax_2033_sensitivity.csv', evidence, 'run').decode()
    assert 'configured_selective_tax' not in remaining
    assert 'no_selective_tax' in remaining


def test_fiscal_diagnostics_require_matching_run_and_export_only_allowlisted_aggregates():
    import importlib.util

    spec = importlib.util.spec_from_file_location('handoff_builder', BUILDER)
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    with tempfile.TemporaryDirectory() as directory:
        folder = Path(directory)
        data = {
            'schema_version': 'tax-audit-aggregate-1.0',
            'run_id': 'good-run',
            'issue_id': 'C08',
            'status': 'unexplained_delta',
            'company_id': 'empresa2',
            'aggregate_metrics': {'delta_brl': 42, 'secret_route': 'DO_NOT_EXPORT'},
            'row_counts': {'source_rows': 10, 'secret_identifier': 'DO_NOT_EXPORT'},
        }
        (folder / 'c08_shareable_tax_summary.json').write_text(json.dumps(data))
        output = builder.project_fiscal_diagnostics(folder, 'good-run')
        encoded = b'\n'.join(output.values())
        assert b'42' in encoded and b'DO_NOT_EXPORT' not in encoded
        assert b'unexplained_delta' in encoded
        try:
            builder.project_fiscal_diagnostics(folder, 'wrong-run')
        except ValueError:
            pass
        else:
            raise AssertionError('Mismatching diagnostic run must be rejected')


def test_traceable_summary_counts_only_paired_entries_and_uses_nested_e2():
    import importlib.util

    spec = importlib.util.spec_from_file_location('handoff_builder', BUILDER)
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    evidence = {
        'companies': {
            'empresa2': {
                'empresa2_one_cd_es': {'status': 'resolved'},
                'monte_carlo_battery': [
                    {'pairing': {'status': 'legacy'}, 'summary': {}},
                    {
                        'scenario_key': 'baseline_self',
                        'pairing': {
                            'status': 'paired',
                            'method': 'common_random_numbers_v1',
                            'baseline_mode': 'physical_unanchored',
                        },
                        'monte_carlo_status': 'success',
                        'summary': {'iterations_valid': 1},
                    },
                ],
            }
        }
    }
    readme = builder.traceable_readme(evidence, 'run').decode()
    status = builder.traceable_status(evidence, 'run').decode()
    assert 'Casos Monte Carlo pareados aptos à projeção: 1' in readme
    assert '1 casos pareados qualificados' in status
    assert 'PRESENTE, verificar status da fonte' in status


def test_traceable_matrix_reports_projection_without_inventing_test_results():
    import csv
    import importlib.util
    import io

    spec = importlib.util.spec_from_file_location('handoff_builder', BUILDER)
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    evidence = {
        'companies': {
            'empresa1': {
                'baseline': {'costs': {'total_logistics_cost': 100}},
                'baseline_physical': {'costs': {'total_logistics_cost': 90}},
                'optimization': {'balanced': {'best': [{'total_with_tax': 80}]}},
                'monte_carlo_battery': [
                    {
                        'scenario_key': 'baseline_self',
                        'pairing': {
                            'status': 'paired',
                            'method': 'common_random_numbers_v1',
                            'baseline_mode': 'physical_unanchored',
                        },
                        'monte_carlo_status': 'success',
                        'summary': {'iterations_valid': 1},
                    }
                ],
            }
        }
    }
    content = builder.traceable_critique_matrix(evidence, 'run')
    rows = {row['issue_id']: row for row in csv.DictReader(io.StringIO(content.decode()))}
    for issue in ('C02', 'C10', 'C12'):
        assert rows[issue]['status'] == 'WARN'
        assert 'pending' not in rows[issue]['root_cause'].lower()
        assert rows[issue]['tests_passed'] == ''
        assert rows[issue]['tests_failed'] == ''
    assert '1' in rows['C12']['numeric_impact']


if __name__ == '__main__':
    test_builder_creates_blocked_status_package_and_validator_accepts_structure()
    test_validator_rejects_tampered_member()
    test_scenarios_use_physical_reference_and_keep_incomparable_saving_empty()
    test_authorized_docx_is_copied_exactly_and_marked_private()
    test_traceable_evidence_requires_current_clean_commit()
    test_e2_subsets_and_tax_disabled_profiles_are_projected_without_sensitive_ids()
    test_fiscal_sensitivity_projection_is_aggregate_and_explicitly_exploratory()
    test_fiscal_diagnostics_require_matching_run_and_export_only_allowlisted_aggregates()
    test_traceable_summary_counts_only_paired_entries_and_uses_nested_e2()
    test_traceable_matrix_reports_projection_without_inventing_test_results()
    print('TCC_HANDOFF_TEST_OK')

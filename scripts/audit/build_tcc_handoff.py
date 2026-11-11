#!/usr/bin/env python3
"""Build a safe, explicitly blocked TCC handoff ZIP skeleton.

This utility packages only generated status documents. It never copies repository
data, workbook contents, DOCX files, screenshots, encrypted sources, or secrets.
Real evidence can be added by a separately authorized pipeline in the future.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import subprocess
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCHEMA_VERSION = 'tcc-handoff-1.0'

REQUIRED_FILES = [
    'LEIA_ME_PRIMEIRO.md',
    'STATUS_FINAL.md',
    '00_MANIFESTO/run_manifest.json',
    '00_MANIFESTO/MANIFESTO.csv',
    '00_MANIFESTO/CHECKSUMS.sha256',
    '00_MANIFESTO/input_sources_manifest.json',
    '00_MANIFESTO/environment.json',
    '00_MANIFESTO/execution_commands.csv',
    '00_MANIFESTO/package_validation.json',
    '00_MANIFESTO/file_registry.csv',
    '01_AUDITORIA/MATRIZ_CRITICAS_C01_C15.csv',
    '01_AUDITORIA/AUDITORIA_H1_H12.md',
    '01_AUDITORIA/CAUSAS_RAIZ.md',
    '01_AUDITORIA/DECISOES_METODOLOGICAS.md',
    '01_AUDITORIA/PENDENCIAS_EXTERNAS.md',
    '01_AUDITORIA/MODELO_ANTES_DEPOIS.md',
    '01_AUDITORIA/impact_matrix.csv',
    '02_BASELINE_E_DADOS/tabela_4_2_baseline_reconciliation.csv',
    '02_BASELINE_E_DADOS/baseline_anchored_vs_unanchored.csv',
    '02_BASELINE_E_DADOS/e1_baseline_decomposition.csv',
    '02_BASELINE_E_DADOS/e1_wacc_source_audit.md',
    '02_BASELINE_E_DADOS/e1_transfer_methodology.md',
    '02_BASELINE_E_DADOS/e1_transfer_calibration.csv',
    '02_BASELINE_E_DADOS/e1_transfer_sensitivity.csv',
    '02_BASELINE_E_DADOS/origin_16_investigation.md',
    '02_BASELINE_E_DADOS/etl_count_reconciliation.csv',
    '02_BASELINE_E_DADOS/etl_row_exclusion_audit.csv',
    '02_BASELINE_E_DADOS/data_lineage.csv',
    '03_TRIBUTACAO/e1_tax_baseline_ab_test.csv',
    '03_TRIBUTACAO/e1_tax_explanation.md',
    '03_TRIBUTACAO/e2_tax_reconciliation.csv',
    '03_TRIBUTACAO/e2_tax_delta_root_cause.md',
    '03_TRIBUTACAO/tax_transition_2026_2033.csv',
    '03_TRIBUTACAO/tax_assumptions_register.md',
    '03_TRIBUTACAO/fiscal_config_runtime.json',
    '03_TRIBUTACAO/tax_config_diff.json',
    '03_TRIBUTACAO/2033_scenario_comparison.csv',
    '03_TRIBUTACAO/2033_tax_breakdown.csv',
    '03_TRIBUTACAO/tax_2033_sensitivity.csv',
    '03_TRIBUTACAO/3_71_percent_trace.md',
    '04_CENARIOS_E_OTIMIZACAO/tabela_4_3_empresa1.csv',
    '04_CENARIOS_E_OTIMIZACAO/tabela_4_4_empresa2_workbook_reference.csv',
    '04_CENARIOS_E_OTIMIZACAO/tabela_4_5_12_perfis.csv',
    '04_CENARIOS_E_OTIMIZACAO/tabela_4_5_e1_sem_tributo.csv',
    '04_CENARIOS_E_OTIMIZACAO/tabela_4_6_sintese.csv',
    '04_CENARIOS_E_OTIMIZACAO/e2_1cd_es_reconciliation.csv',
    '04_CENARIOS_E_OTIMIZACAO/e2_1cd_es_root_cause.md',
    '04_CENARIOS_E_OTIMIZACAO/scenario_n_reproducibility.json',
    '04_CENARIOS_E_OTIMIZACAO/optimizer_candidates.csv',
    '04_CENARIOS_E_OTIMIZACAO/optimizer_search_coverage.json',
    '04_CENARIOS_E_OTIMIZACAO/optimizer_winners_changed.md',
    '04_CENARIOS_E_OTIMIZACAO/optimizer_sensitivity.csv',
    '04_CENARIOS_E_OTIMIZACAO/optimizer_frontier.csv',
    '04_CENARIOS_E_OTIMIZACAO/fallback_incidence_by_scenario.csv',
    '04_CENARIOS_E_OTIMIZACAO/fallback_sensitivity.csv',
    '04_CENARIOS_E_OTIMIZACAO/scenario_summary_all.csv',
    '05_MONTE_CARLO/monte_carlo_paired_summary.csv',
    '05_MONTE_CARLO/monte_carlo_seed_manifest.json',
    '05_MONTE_CARLO/monte_carlo_convergence.csv',
    '05_MONTE_CARLO/monte_carlo_robustness.csv',
    '05_MONTE_CARLO/monte_carlo_legacy_comparison.md',
    '06_TESTES_E_QA/TEST_REPORT.md',
    '06_TESTES_E_QA/test_results.json',
    '06_TESTES_E_QA/junit.xml',
    '06_TESTES_E_QA/regression_matrix.csv',
    '06_TESTES_E_QA/security_scan.json',
    '06_TESTES_E_QA/baseline_and_tax_properties.json',
    '06_TESTES_E_QA/package_schema_validation.json',
    '07_SITE_DEMO/site_identity_audit.md',
    '07_SITE_DEMO/site_url_verified.txt',
    '07_SITE_DEMO/site_smoke_tests.json',
    '08_ATUALIZACAO_TCC/GUIA_ATUALIZACAO_TCC.md',
    '08_ATUALIZACAO_TCC/TABELAS_FINAIS.md',
    '08_ATUALIZACAO_TCC/TEXTO_SUGERIDO_SECAO_3.md',
    '08_ATUALIZACAO_TCC/TEXTO_SUGERIDO_SECAO_4.md',
    '08_ATUALIZACAO_TCC/TEXTO_SUGERIDO_SECAO_5.md',
    '08_ATUALIZACAO_TCC/EDITORIAL_PENDENCIAS.md',
    '08_ATUALIZACAO_TCC/mapa_numero_para_fonte.csv',
    '09_CODIGO_E_REVISAO/CHANGELOG_AUDITORIA.md',
    '09_CODIGO_E_REVISAO/DIFF_SUMMARY.md',
    '09_CODIGO_E_REVISAO/commit_range.txt',
    '09_CODIGO_E_REVISAO/tests_added.md',
    '10_TCC_HANDOFF/RESUMO_EXECUTIVO_PARA_REVISOR.md',
    '10_TCC_HANDOFF/VEREDITO_POR_CONCLUSAO.csv',
    '10_TCC_HANDOFF/TABELAS_PRONTAS_PUBLICACAO.md',
    '10_TCC_HANDOFF/TABELAS_PRONTAS_PUBLICACAO.csv',
    '10_TCC_HANDOFF/CATALOGO_FIGURAS.csv',
    '10_TCC_HANDOFF/CATALOGO_REFERENCIAS_E_FONTES.csv',
    '10_TCC_HANDOFF/EQUACOES_E_PREMISSAS.md',
    '10_TCC_HANDOFF/GUIA_REESCRITA_CAPITULO_1.md',
    '10_TCC_HANDOFF/GUIA_REESCRITA_CAPITULO_2.md',
    '10_TCC_HANDOFF/GUIA_REESCRITA_CAPITULO_3.md',
    '10_TCC_HANDOFF/GUIA_REESCRITA_CAPITULO_4.md',
    '10_TCC_HANDOFF/GUIA_REESCRITA_CAPITULO_5.md',
    '10_TCC_HANDOFF/REVISAR_RESUMO_ABSTRACT_E_CONCLUSOES.md',
    '10_TCC_HANDOFF/QUADRO_RESULTADOS_POR_EMPRESA.md',
    '10_TCC_HANDOFF/QUADRO_ANTES_DEPOIS_POR_CENARIO.csv',
    '10_TCC_HANDOFF/TEXTO_CIENTIFICO_LIMITE_INFERENCIA.md',
    '10_TCC_HANDOFF/AUDITORIA_TERMINOLOGIA_E_IDENTIDADE.md',
    '10_TCC_HANDOFF/MAPA_REVISAO_PARAGRAFO_A_PARAGRAFO.csv',
    '10_TCC_HANDOFF/PERGUNTAS_QUE_EXIGEM_AUTOR_OU_ORIENTADOR.md',
    '10_TCC_HANDOFF/ENTRADAS_DOCUMENTAIS_NECESSARIAS.md',
    '10_TCC_HANDOFF/BIBLIOGRAFIA_PARA_CONFERENCIA.md',
    '11_DOCUMENTOS_TCC/INVENTARIO_DOCUMENTAL.md',
]

CONDITIONAL_FILES = [
    '07_SITE_DEMO/screenshots/demo_overview.png',
    '07_SITE_DEMO/screenshots/demo_scenarios.png',
    '07_SITE_DEMO/screenshots/demo_results.png',
    '07_SITE_DEMO/screenshots/demo_optimizer.png',
    '09_CODIGO_E_REVISAO/source_patch.patch',
    '11_DOCUMENTOS_TCC/TCC_BASE_PARA_REVISAO.docx',
]

CSV_HEADERS = {
    '00_MANIFESTO/MANIFESTO.csv': ['path', 'sha256', 'size_bytes', 'classification', 'source', 'sensitivity'],
    '00_MANIFESTO/execution_commands.csv': [
        'run_id',
        'step_id',
        'command_sanitized',
        'working_directory',
        'tool_version',
        'started_at_utc',
        'finished_at_utc',
        'exit_code',
        'log_path',
        'status',
    ],
    '00_MANIFESTO/file_registry.csv': [
        'path',
        'obligation',
        'produced',
        'status',
        'source',
        'run_id',
        'sensitivity',
        'blocking_reason',
        'effect_on_tcc',
    ],
    '01_AUDITORIA/MATRIZ_CRITICAS_C01_C15.csv': [
        'issue_id',
        'priority',
        'category',
        'status',
        'root_cause',
        'source_path',
        'function',
        'input_dependency',
        'test_ids',
        'tests_passed',
        'tests_failed',
        'evidence_paths',
        'numeric_impact',
        'editorial_action',
        'external_dependency',
        'limitations',
    ],
    '01_AUDITORIA/impact_matrix.csv': ['artifact', 'dependency', 'status', 'run_id', 'reason_code'],
    '08_ATUALIZACAO_TCC/mapa_numero_para_fonte.csv': [
        'tcc_chapter',
        'section',
        'table_or_figure',
        'cell_or_sentence',
        'field_name',
        'scenario_id',
        'run_id',
        'source_csv',
        'row_filter',
        'status',
        'unit',
        'rounding',
        'limitations',
    ],
    '10_TCC_HANDOFF/VEREDITO_POR_CONCLUSAO.csv': [
        'claim_id',
        'chapter',
        'section',
        'claim_text',
        'admissible_in_tcc',
        'evidence_class',
        'status',
        'confidence',
        'source_file',
        'source_key',
        'run_id',
        'reason',
        'alternative_wording',
        'limitation',
        'reviewer_action',
    ],
    '10_TCC_HANDOFF/TABELAS_PRONTAS_PUBLICACAO.csv': ['table_id', 'status', 'source_file', 'reason'],
    '10_TCC_HANDOFF/CATALOGO_FIGURAS.csv': [
        'figure_id',
        'chapter',
        'title',
        'source_type',
        'source_csv',
        'source_columns',
        'scenario_ids',
        'run_id',
        'unit',
        'image_png',
        'image_svg',
        'caption',
        'methodological_note',
        'privacy_review',
        'status',
        'issue_ids',
    ],
    '10_TCC_HANDOFF/CATALOGO_REFERENCIAS_E_FONTES.csv': [
        'claim_or_method_id',
        'source_title',
        'author_year',
        'source_kind',
        'verified',
        'original_identifier',
        'local_evidence_file',
        'citation_needed',
        'notes',
    ],
    '10_TCC_HANDOFF/QUADRO_ANTES_DEPOIS_POR_CENARIO.csv': [
        'company_id',
        'scenario_id',
        'year',
        'metric_name',
        'unit',
        'old_reported_value',
        'old_source',
        'new_value',
        'new_source',
        'absolute_delta',
        'pct_delta',
        'change_reason',
        'run_id',
        'status',
        'admissible_in_tcc',
    ],
    '10_TCC_HANDOFF/MAPA_REVISAO_PARAGRAFO_A_PARAGRAFO.csv': [
        'chapter',
        'section',
        'source_anchor',
        'old_claim',
        'new_claim_or_removal',
        'reason',
        'source_artifact',
        'status',
        'confidence',
        'external_validation_needed',
        'suggested_wording',
        'table_or_figure_affected',
        'related_issue_ids',
        'editorial_action',
        'order',
    ],
    '04_CENARIOS_E_OTIMIZACAO/scenario_summary_all.csv': [
        'run_id',
        'company_id',
        'scenario_id',
        'scenario_name',
        'scenario_source',
        'scenario_status',
        'tax_year',
        'tax_mode',
        'active_cd_ids',
        'active_cd_count',
        'freight_multiplier',
        'demand_multiplier',
        'inventory_days',
        'wacc',
        'transfer_brl',
        'distribution_brl',
        'storage_brl',
        'inventory_brl',
        'logistics_brl',
        'current_tax_brl',
        'cbs_brl',
        'ibs_brl',
        'selective_tax_brl',
        'credits_brl',
        'tax_impact_brl',
        'total_with_tax_brl',
        'baseline_comparable_id',
        'baseline_logistics_brl',
        'baseline_total_brl',
        'saving_logistics_pct',
        'saving_total_pct',
        'tax_coverage_flow_pct',
        'tax_coverage_value_pct',
        'fallback_cost_share',
        'quality_score',
        'risk_level',
        'source_classification',
        'validation_status',
        'warnings',
    ],
    '04_CENARIOS_E_OTIMIZACAO/tabela_4_5_12_perfis.csv': [
        'run_id',
        'company_id',
        'profile_id',
        'profile_label',
        'tax_mode',
        'tax_year',
        'candidate_universe_id',
        'candidate_space_base',
        'candidate_space_extended',
        'candidates_generated',
        'candidates_simulated',
        'candidates_valid',
        'search_complete',
        'winner_scenario_id',
        'winner_cd_ids',
        'winner_cd_count',
        'winner_logistics_brl',
        'winner_tax_impact_brl',
        'winner_total_brl',
        'winner_saving_logistics_pct',
        'winner_saving_total_pct',
        'winner_score',
        'winner_risk',
        'weights_json',
        'constraints_json',
        'winner_changes_vs_balanced',
        'methodology_status',
    ],
    '05_MONTE_CARLO/monte_carlo_paired_summary.csv': [
        'run_id',
        'company_id',
        'scenario_id',
        'baseline_scenario_id',
        'tax_year',
        'tax_mode',
        'profile',
        'seed',
        'seed_effective',
        'rng_algorithm',
        'iterations_requested',
        'iterations_valid',
        'iterations_invalid',
        'sampling_source',
        'baseline_shock_mode',
        'mean_delta_cost_brl',
        'p10_delta_cost_brl',
        'p50_delta_cost_brl',
        'p90_delta_cost_brl',
        'prob_candidate_cheaper',
        'prob_tie',
        'mc_standard_error',
        'paired_method',
        'robustness_score',
        'robustness_policy',
        'data_quality_status',
        'model_validity_note',
    ],
}

SENSITIVE_PARTS = {
    '.env',
    '.enc.json',
    'secret',
    'token',
    'password',
    'credential',
    'private_key',
    'id_rsa',
    'id_ed25519',
    'cliente',
    'cpf',
    'cnpj',
    'nota_fiscal',
    'invoice',
}
PACKAGE_ROOT_PREFIX = 'TCC_HANDOFF_AUDITADO_'


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00', 'Z')


def git_value(*args: str) -> str:
    try:
        return subprocess.check_output(['git', *args], cwd=ROOT, text=True, stderr=subprocess.DEVNULL).strip()
    except (OSError, subprocess.CalledProcessError):
        return 'unavailable'


def csv_text(headers: list[str], rows: list[list[object]] | None = None) -> str:
    from io import StringIO

    output = StringIO(newline='')
    writer = csv.writer(output, lineterminator='\n')
    writer.writerow(headers)
    for row in rows or []:
        writer.writerow(row)
    return output.getvalue()


def blocker(path: str, run_id: str) -> str:
    return (
        '# BLOCKED_SOURCE — evidência não produzida\n\n'
        f'- Artefato solicitado: `{path}`\n'
        '- Estado: `BLOCKED_SOURCE`\n'
        '- Motivo: esta infraestrutura apenas cria o contrato e verifica o pacote. '
        'Não houve execução canônica com fontes reais autorizadas; nenhum resultado foi criado.\n'
        f'- run_id: `{run_id}`\n'
        '- Ação necessária: gerar este artefato a partir de execução rastreada com fontes autorizadas; '
        'preservar ausências como null/razão de bloqueio.\n'
        '- Efeito no TCC: não usar números inferidos deste arquivo.\n'
    )


def content_for(path: str, run_id: str, timestamp: str, commit: str) -> bytes:
    if path in CSV_HEADERS:
        return csv_text(CSV_HEADERS[path]).encode()
    if path.endswith('.csv'):
        return csv_text(
            ['status', 'reason_code', 'blocking_reason'],
            [['BLOCKED_SOURCE', 'NO_FINAL_AUDITED_RUN', 'No final audited consolidated execution supplied.']],
        ).encode()
    if path.endswith('.json'):
        data = {
            'status': 'BLOCKED_SOURCE',
            'artifact': path,
            'run_id': run_id,
            'reason': 'No final audited consolidated execution supplied; no result is fabricated.',
        }
        if path == '00_MANIFESTO/input_sources_manifest.json':
            data = {
                'status': 'BLOCKED_FOR_FINAL_NUMERICAL_CLAIMS',
                'run_id': run_id,
                'sources': [
                    {
                        'source_id': 'empresa1_protected_premises',
                        'availability': 'protected_local_source_exists',
                        'sensitivity': 'confidential',
                        'field': 'WACC',
                        'value': None,
                        'value_status': 'WITHHELD_CONFIDENTIAL',
                        'unit': None,
                        'periodicity': None,
                        'periodicity_status': 'BLOCKED_SOURCE',
                        'sharing_authorized': False,
                        'note': 'The source and field were identified locally; numeric value is omitted pending disclosure review, and unit/periodicity are not established here.',
                    }
                ],
                'other_inputs': 'No final audited consolidated execution was supplied.',
            }
        if path.endswith('run_manifest.json'):
            data = {
                'schema_version': SCHEMA_VERSION,
                'run_id': run_id,
                'created_at_utc': timestamp,
                'project': 'logistica_reforma_tcc',
                'model_commit_initial': commit,
                'model_commit_final': commit,
                'input_hashes': {},
                'params_hash': None,
                'tax_config_hash': None,
                'output_hashes': {},
                'source_class': 'NOT_REPRODUCIBLE',
                'privacy_classification': 'SHAREABLE_STATUS_ONLY',
                'sharing_authorized': False,
                'contains_real_individual_data': False,
                'overall_status': 'BLOCKED_FOR_FINAL_NUMERICAL_CLAIMS',
                'p0_fail_count': None,
                'p0_blocked_count': None,
                'test_status': 'NOT_RUN_BY_BUILDER',
                'reproducibility_status': 'BLOCKED_SOURCE',
                'note': 'Status-only scaffold. Historical/private runs may exist, but no final audited consolidated execution was supplied for this package.',
            }
        elif path.endswith('environment.json'):
            data = {
                'status': 'BLOCKED_SOURCE',
                'python': sys.version.split()[0],
                'platform': sys.platform,
                'note': 'Environment snapshot only; does not attest to the model execution environment.',
            }
        elif path.endswith('execution_commands.csv'):
            return csv_text(
                CSV_HEADERS[path],
                [
                    [
                        run_id,
                        'package_generation',
                        'python scripts/audit/build_tcc_handoff.py',
                        str(ROOT),
                        sys.version.split()[0],
                        timestamp,
                        timestamp,
                        '0',
                        '',
                        'SCAFFOLD_ONLY',
                    ]
                ],
            ).encode()
        elif path.endswith('package_validation.json'):
            data = {
                'status': 'PENDING_INDEPENDENT_VALIDATION',
                'validator': 'scripts/audit/validate_tcc_handoff.py',
                'run_id': run_id,
                'note': 'This file is excluded from CHECKSUMS.sha256 because validation writes its own result here.',
            }
        return (json.dumps(data, indent=2, sort_keys=True) + '\n').encode()
    if path.endswith('.txt'):
        return (blocker(path, run_id)).encode()
    if path.endswith('.xml'):
        return b'<?xml version="1.0" encoding="UTF-8"?>\n<testsuites status="BLOCKED_SOURCE" tests="0" failures="0" errors="0"/>\n'
    return blocker(path, run_id).encode()


def safe_relative(path: str) -> bool:
    p = Path(path)
    return not p.is_absolute() and '..' not in p.parts and bool(p.parts)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def build_package(output: Path, timestamp: str | None = None) -> Path:
    timestamp = timestamp or utc_now()
    date = timestamp[:10].replace('-', '')
    commit = git_value('rev-parse', 'HEAD')
    config_hash = sha256((SCHEMA_VERSION + '\n' + '\n'.join(REQUIRED_FILES)).encode())
    run_id = f'{date}-{commit[:12]}-{config_hash[:12]}'
    root_name = f'{PACKAGE_ROOT_PREFIX}{date}_{commit[:12]}'
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        raise FileExistsError(f'Refusing to overwrite existing package: {output}')

    all_paths = sorted(set(REQUIRED_FILES + CONDITIONAL_FILES))
    files: dict[str, bytes] = {}
    registry_rows: list[list[object]] = []
    for relative in all_paths:
        if not safe_relative(relative):
            raise ValueError(f'Unsafe package path: {relative}')
        conditional = relative in CONDITIONAL_FILES
        if conditional:
            status = 'BLOCKED_AUTHORIZATION' if relative.endswith(('.docx', '.patch')) else 'BLOCKED_SOURCE'
            registry_rows.append(
                [
                    relative,
                    'conditional',
                    'false',
                    status,
                    'not_included',
                    run_id,
                    'not_included',
                    'Source/authorization required; no placeholder binary is emitted.',
                    'Provide only after source availability and sharing approval.',
                ]
            )
            continue
        content = content_for(relative, run_id, timestamp, commit)
        status = 'BLOCKED_SOURCE'
        if relative == '11_DOCUMENTOS_TCC/INVENTARIO_DOCUMENTAL.md':
            content = (
                '# Inventário documental\n\n'
                '- `TCC_BASE_PARA_REVISAO.docx`: não incluído (`BLOCKED_AUTHORIZATION`); o plano condiciona a cópia à autorização expressa de redistribuição.\n'
                '- Nenhum documento fonte, dado empresarial, captura de tela, base criptografada ou segredo foi copiado.\n'
                f'- run_id: `{run_id}`\n'
            ).encode()
        if relative == 'LEIA_ME_PRIMEIRO.md':
            content = (
                '# Handoff de auditoria — scaffold de status\n\n'
                'Este ZIP registra a estrutura e os bloqueios de evidência. Pode haver execuções privadas/históricas, mas não foi fornecida uma execução final auditada consolidada. O ZIP não contém resultados quantitativos validados.\n\n'
                f'- Estado geral: `BLOCKED_FOR_FINAL_NUMERICAL_CLAIMS`\n- run_id: `{run_id}`\n'
                '- Uso: confirmar presença/estrutura e testar o validador independente. Não usar como versão final de tabelas do TCC.\n'
            ).encode()
        if relative == '02_BASELINE_E_DADOS/e1_wacc_source_audit.md':
            content = (
                '# Auditoria de proveniência do WACC E1\n\n'
                '- Há uma fonte local protegida da Empresa 1 e o campo WACC foi identificado.\n'
                '- O valor numérico foi omitido deste pacote por confidencialidade e por não haver decisão de divulgação registrada.\n'
                '- Unidade e periodicidade: `BLOCKED_SOURCE`; não presumir taxa anual ou mensal.\n'
                '- O valor do campo, a unidade, a periodicidade e a relação com o custo de estoque requerem extração autorizada, registro de proveniência e conferência antes de uso no TCC.\n'
                '- Estado: `BLOCKED_AUTHORIZATION` para divulgação e `BLOCKED_SOURCE` para periodicidade/unidade.\n'
                '- Nenhuma conclusão quantitativa de custo de estoque deve ser publicada a partir deste scaffold.\n'
            ).encode()
        if relative == 'STATUS_FINAL.md':
            content = (
                '# Status final\n\n'
                'Veredito: `BLOCKED_FOR_FINAL_NUMERICAL_CLAIMS`. A infraestrutura de pacote foi criada, mas não foi fornecida uma execução final auditada consolidada após as últimas alterações.\n\n'
                'Perguntas sobre WACC, custos, tributos, 2033, busca, Monte Carlo, origem 16, site e reunião permanecem `BLOCKED_SOURCE` ou `BLOCKED_AUTHORIZATION`; este pacote não inventa respostas.\n'
            ).encode()
        files[relative] = content
        registry_rows.append(
            [
                relative,
                'conditional' if conditional else 'required',
                'true',
                status,
                'generated_status_scaffold',
                run_id,
                'public_status_only',
                'No authorized canonical result available.'
                if status != 'BLOCKED_AUTHORIZATION'
                else 'Explicit redistribution authorization/source document unavailable.',
                'Do not use as quantitative evidence; produce from a traceable authorized run.',
            ]
        )

    registry_path = '00_MANIFESTO/file_registry.csv'
    files[registry_path] = csv_text(CSV_HEADERS[registry_path], registry_rows).encode()
    # Registry itself is present and blocked as a data registry: all evidence outputs are blocked.
    manifest_rows = []
    for name, data in sorted(files.items()):
        if name in (
            '00_MANIFESTO/MANIFESTO.csv',
            '00_MANIFESTO/CHECKSUMS.sha256',
            '00_MANIFESTO/package_validation.json',
        ):
            continue
        manifest_rows.append(
            [name, sha256(data), len(data), 'status_scaffold', 'generated_by_builder', 'public_status_only']
        )
    files['00_MANIFESTO/MANIFESTO.csv'] = csv_text(CSV_HEADERS['00_MANIFESTO/MANIFESTO.csv'], manifest_rows).encode()
    checksums = []
    for name, data in sorted(files.items()):
        if name in ('00_MANIFESTO/CHECKSUMS.sha256', '00_MANIFESTO/package_validation.json'):
            continue
        checksums.append(f'{sha256(data)}  {name}')
    files['00_MANIFESTO/CHECKSUMS.sha256'] = ('\n'.join(checksums) + '\n').encode()

    with zipfile.ZipFile(output, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, data in sorted(files.items()):
            archive.writestr(f'{root_name}/{name}', data)
    return output


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        '--output', type=Path, required=True, help='Output ZIP path; existing file is never overwritten.'
    )
    args = parser.parse_args()
    try:
        result = build_package(args.output.resolve())
    except (OSError, ValueError) as error:
        print(f'BUILD_FAILED: {error}', file=sys.stderr)
        return 2
    print(f'PACKAGE_CREATED: {result}')
    print('STATUS: BLOCKED_FOR_FINAL_NUMERICAL_CLAIMS (status scaffold; no real results included)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

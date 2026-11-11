#!/usr/bin/env python3
"""Build a safe TCC handoff ZIP with substantive editorial content and explicit blockers.

An explicitly supplied DOCX is copied byte for byte for private reviewer use.
Numeric deliverables unavailable as a final audited run are marked BLOCKED.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import re
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
    '02_BASELINE_E_DADOS/baseline_anchored_vs_unanchored.csv': [
        'run_id',
        'company_id',
        'component',
        'anchored_value_brl',
        'physical_unanchored_value_brl',
        'delta_brl',
        'anchored_source_class',
        'physical_source_class',
        'status',
        'limitation',
    ],
    '02_BASELINE_E_DADOS/e1_baseline_decomposition.csv': [
        'run_id',
        'company_id',
        'component',
        'anchored_value_brl',
        'physical_unanchored_value_brl',
        'delta_brl',
        'status',
        'source_classification',
    ],
    '02_BASELINE_E_DADOS/tabela_4_2_baseline_reconciliation.csv': [
        'run_id',
        'company_id',
        'component',
        'anchored_value_brl',
        'physical_unanchored_value_brl',
        'delta_brl',
        'status',
        'source_classification',
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
    '03_TRIBUTACAO/tax_transition_2026_2033.csv': [
        'year',
        'tax_component',
        'reported_legal_transition',
        'source_url',
        'source_class',
        'company_specific_validation',
        'modeling_note',
    ],
}

CSV_ROWS = {
    '01_AUDITORIA/MATRIZ_CRITICAS_C01_C15.csv': [
        [
            f'C{index:02d}',
            'P0' if index <= 10 else 'P1',
            category,
            status,
            root_cause,
            source,
            function,
            dependency,
            test_ids,
            'not_run_in_final_bundle',
            'not_run_in_final_bundle',
            evidence,
            'not quantified in final audited run',
            editorial,
            external,
            limitation,
        ]
        for index, category, status, root_cause, source, function, dependency, test_ids, evidence, editorial, external, limitation in [
            (
                1,
                'baseline',
                'BLOCKED_SOURCE',
                'No final side-by-side anchored/unanchored export.',
                'scenario-simulator.js',
                'baseline modes',
                'authorized inputs and rerun',
                'BASE_001;BASE_002',
                '02_BASELINE_E_DADOS/baseline_anchored_vs_unanchored.csv',
                'Separate reference from independent calculation.',
                'authorized execution',
                'Anchoring is not independent validation.',
            ),
            (
                2,
                'financial_identity',
                'BLOCKED_SOURCE',
                'Final component identities have not been re-exported.',
                'physical-cost-engine.js',
                'component aggregation',
                'scenario outputs',
                'FIN_001;FIN_002',
                '02_BASELINE_E_DADOS/e1_baseline_decomposition.csv',
                'Do not publish unreconciled totals.',
                'none identified',
                'Historical values are not a current execution.',
            ),
            (
                3,
                'comparability',
                'BLOCKED_SOURCE',
                'Comparable scenario and baseline scope not certified.',
                'scenario-simulator.js',
                'scenario comparison',
                'same period, tax mode and flow scope',
                'FIN_003;COMP_001;COMP_002',
                '04_CENARIOS_E_OTIMIZACAO/scenario_summary_all.csv',
                'Qualify or omit savings.',
                'author decision',
                'No final comparability audit.',
            ),
            (
                4,
                'tax_e1',
                'BLOCKED_SOURCE',
                'Fiscal coverage and baseline transition remain unresolved.',
                'assets/js/core/tax/',
                'tax orchestrator',
                'fiscal source and regime review',
                'TAX_001;E1_001',
                '03_TRIBUTACAO/e1_tax_explanation.md',
                'Call it exploratory fiscal indicator.',
                'tax specialist',
                'No operation-level causal bridge.',
            ),
            (
                5,
                'wacc_e1',
                'BLOCKED_AUTHORIZATION',
                'Field identified in protected source; unit and period unresolved.',
                'protected source; not exported',
                'inventory cost derivation',
                'disclosure decision and unit metadata',
                'UNIT_002;E1_004',
                '02_BASELINE_E_DADOS/e1_wacc_source_audit.md',
                'Withhold number and conclusions dependent on it.',
                'source owner',
                'Protected numeric value omitted.',
            ),
            (
                6,
                'transfer_e1',
                'BLOCKED_SOURCE',
                'Transfer proxy does not establish supplier-to-CD physical route.',
                'physical-cost-engine.js',
                'transfer calculation',
                'route and compatible rate',
                'UNIT_001;E1_002;E1_003',
                '02_BASELINE_E_DADOS/e1_transfer_methodology.md',
                'Do not describe proxy as observed transfer cost.',
                'data owner',
                'Recalibration requires authorized source.',
            ),
            (
                7,
                'fallbacks',
                'BLOCKED_SOURCE',
                'Fallback incidence by value not consolidated after rerun.',
                'physical-cost-engine.js',
                'fallback accounting',
                'scenario diagnostics',
                'C07;FLOW_002',
                '04_CENARIOS_E_OTIMIZACAO/fallback_incidence_by_scenario.csv',
                'Disclose fallback and its denominator.',
                'none identified',
                'Fallback coverage is not observation.',
            ),
            (
                8,
                'tax_e2',
                'BLOCKED_SOURCE',
                'Historical tax delta has no operation-level reconciliation.',
                'ETL and tax export',
                'tax aggregation',
                'private row bridge',
                'TAX_004;E2_002',
                '03_TRIBUTACAO/e2_tax_delta_root_cause.md',
                'Keep definitions separate; no forced reconciliation.',
                'authorized tax data',
                'Root cause remains unexplained.',
            ),
            (
                9,
                'tax_2033',
                'BLOCKED_SOURCE',
                'Scenario parameters lack specialist validation.',
                'tax-reform-config.js',
                'reform tax engine',
                'versioned assumptions and review',
                'TAX_003;TAX_005',
                '03_TRIBUTACAO/tax_assumptions_register.md',
                'Label as parametric exploratory scenario.',
                'tax specialist',
                'Not a business forecast.',
            ),
            (
                10,
                'e2_scenario',
                'BLOCKED_SOURCE',
                'Workbook and simulator allocation equivalence unproven.',
                'scenario-flow-rebuilder.js',
                'flow allocation',
                'workbook assignment matrix',
                'E2_001;E2_003',
                '04_CENARIOS_E_OTIMIZACAO/e2_1cd_es_root_cause.md',
                'Use distinct source class and scenario IDs.',
                'authorized workbook',
                'Scenario N remains unreproducible.',
            ),
            (
                11,
                'optimizer',
                'IN_PROGRESS',
                'Refinement count semantics corrected; final integrated rerun pending.',
                'scenario-optimizer.js',
                'search-space accounting',
                'full test suite and final run',
                'OPT_001;SCORE_002;C02',
                '04_CENARIOS_E_OTIMIZACAO/optimizer_search_coverage.json',
                'Report best in catalog, not global optimum.',
                'none identified',
                'Coverage depends on declared domain.',
            ),
            (
                12,
                'profile_scores',
                'BLOCKED_SOURCE',
                'Final same-universe profile exports unavailable.',
                'scenario-scoring.js',
                'profile scoring',
                'final optimizer outputs',
                'OPT_002;SCORE_001',
                '04_CENARIOS_E_OTIMIZACAO/tabela_4_5_12_perfis.csv',
                'Do not name final winners yet.',
                'none identified',
                'Scores are catalog-conditional.',
            ),
            (
                13,
                'monte_carlo',
                'IN_PROGRESS',
                'Paired method is under active correction; current bundle is not final.',
                'monte-carlo-engine.js',
                'shock coupling',
                'post-change rerun and self-test',
                'MC_001;MC_004;MC_006',
                '05_MONTE_CARLO/monte_carlo_paired_summary.csv',
                'Withdraw legacy probabilities as paired robustness.',
                'none identified',
                'Distribution validity remains conditional.',
            ),
            (
                14,
                'data_lineage',
                'BLOCKED_SOURCE',
                'Origin/count lineage not reconciled in final output.',
                'ETL modules',
                'source row lineage',
                'authorized source inventory',
                'C11;FLOW_001',
                '02_BASELINE_E_DADOS/data_lineage.csv',
                'Do not infer physical meaning from counts.',
                'data owner',
                'No confidential identifiers in this package.',
            ),
            (
                15,
                'publication',
                'BLOCKED_AUTHORIZATION',
                'Brand, partner, URL and document release approvals absent.',
                'TCC and demo materials',
                'release review',
                'written authorizations',
                'SEC_003;DOC_001',
                '07_SITE_DEMO/site_identity_audit.md',
                'Use generic names and no real screenshots.',
                'author/orientador',
                'DOCX review is also blocked.',
            ),
        ]
    ],
    '10_TCC_HANDOFF/VEREDITO_POR_CONCLUSAO.csv': [
        [
            'CLAIM-BASELINE',
            '4',
            '4.2',
            'Baseline totals are independently validated.',
            'false',
            'ANCHORED_REFERENCE',
            'BLOCKED',
            'low',
            '02_BASELINE_E_DADOS/baseline_anchored_vs_unanchored.csv',
            'validation_status',
            '',
            'No final independent reconciliation supplied.',
            'Treat anchored values as reference and separate unanchored calculation.',
            'Anchor agreement is not validation.',
            'Do not publish as independently validated.',
        ],
        [
            'CLAIM-SAVINGS',
            '4',
            '4.3-4.6',
            'Network alternatives demonstrate net business savings.',
            'false',
            'PARAMETRIC_EXPLORATORY',
            'BLOCKED',
            'low',
            '04_CENARIOS_E_OTIMIZACAO/scenario_summary_all.csv',
            'saving_total_pct',
            '',
            'Transfer, fiscal and operational evidence remain incomplete.',
            'Report conditional logistics sensitivity only after comparable rerun.',
            'No net benefit or operating feasibility proved.',
            'Remove or qualify.',
        ],
        [
            'CLAIM-TAX2033',
            '4-5',
            '4.7-5',
            'The 2033 scenario predicts company tax cost.',
            'false',
            'PARAMETRIC_EXPLORATORY',
            'BLOCKED',
            'low',
            '03_TRIBUTACAO/2033_scenario_comparison.csv',
            'tax_impact_brl',
            '',
            'Fiscal parameters are not professionally validated.',
            'Call it an exploratory parameter scenario.',
            'No company forecast.',
            'Remove predictive phrasing.',
        ],
        [
            'CLAIM-OPTIMAL',
            '4',
            '4.5',
            'Optimizer identified the global optimum.',
            'false',
            'REPRODUCED_MODEL',
            'BLOCKED',
            'low',
            '04_CENARIOS_E_OTIMIZACAO/optimizer_search_coverage.json',
            'search_complete',
            '',
            'Search coverage is partial for E1.',
            'Say best among evaluated candidates.',
            'Catalog is not full feasible set.',
            'Replace wording.',
        ],
        [
            'CLAIM-ROBUSTNESS',
            '4-5',
            '4.8',
            'Monte Carlo probability is real-world probability of savings.',
            'false',
            'PARAMETRIC_EXPLORATORY',
            'BLOCKED',
            'low',
            '05_MONTE_CARLO/monte_carlo_paired_summary.csv',
            'prob_candidate_cheaper',
            '',
            'Legacy baseline comparison was not paired.',
            'Use conditional paired sensitivity after final rerun.',
            'Distribution and shock assumptions remain model-dependent.',
            'Withdraw legacy probability.',
        ],
    ],
    '03_TRIBUTACAO/tax_transition_2026_2033.csv': [
        [
            2027,
            'CBS',
            'CBS integral a partir de 2027',
            'https://legis.senado.gov.br/norma/40180341/publicacao/40181429',
            'OFFICIAL_LEGAL_SOURCE',
            'BLOCKED',
            'Legal transition only; not an effective company-specific rate.',
        ],
        [
            '2029–2032',
            'ICMS_ISS_IBS',
            'Transition phase; ICMS/ISS reduced while IBS rises',
            'https://legis.senado.gov.br/norma/40180341/publicacao/40181429',
            'OFFICIAL_LEGAL_SOURCE',
            'BLOCKED',
            'Do not infer a model alpha schedule or company effective tax without specialist review.',
        ],
        [
            2033,
            'IBS',
            'IBS integral from 2033',
            'https://legis.senado.gov.br/norma/40180341/publicacao/40181429',
            'OFFICIAL_LEGAL_SOURCE',
            'BLOCKED',
            'The legal schedule does not validate company-specific model taxes.',
        ],
    ],
    '10_TCC_HANDOFF/CATALOGO_REFERENCIAS_E_FONTES.csv': [
        [
            'TAX-TRANSITION',
            'Lei Complementar 214/2025, texto atualizado',
            'Brasil, 2025 (texto atualizado)',
            'official_legislation',
            'source_link_provided_by_audit_orchestrator',
            'https://legis.senado.gov.br/norma/40180341/publicacao/40181429',
            '03_TRIBUTACAO/tax_transition_2026_2033.csv',
            'yes',
            'Use for the transition schedule; this does not validate company-specific model assumptions.',
        ],
        [
            'TAX-CBS-IBS',
            'Reforma tributária: documentos fiscais e destaque da CBS',
            'Receita Federal, 2026-10',
            'official_agency_update',
            'source_link_provided_by_audit_orchestrator',
            'https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/outubro/reforma-tributaria-86-dos-documentos-fiscais-de-empresas-obrigadas-ja-trazem-destaque-da-cbs',
            '03_TRIBUTACAO/tax_assumptions_register.md',
            'yes',
            'Reports CBS integral in 2027 and IBS integral in 2033; cite with access date and verify current text.',
        ],
        [
            'TAX-SELECTIVE',
            'Governo federal define alíquotas do Imposto Seletivo para 2027',
            'Ministério da Fazenda, 2026-11',
            'official_agency_update',
            'source_link_provided_by_audit_orchestrator',
            'https://www.gov.br/fazenda/pt-br/assuntos/noticias/2026/novembro/governo-federal-define-aliquotas-do-imposto-seletivo-para-2027-por-meio-de-medida-provisoria',
            '03_TRIBUTACAO/tax_assumptions_register.md',
            'yes',
            'Do not infer applicability without product classification and specialist review.',
        ],
    ],
    '10_TCC_HANDOFF/MAPA_REVISAO_PARAGRAFO_A_PARAGRAFO.csv': [
        [
            '4',
            '4.3',
            'Candidate DOCX paragraphs 122–123; caption anchor “Tabela 4.3 – Cenários simulados da cadeia de varejo”; repeated in DOCX-B/C/D/E.',
            'Existing scenario table values and labels require source/version verification.',
            'Replace only with synchronized, status-qualified output from the final run.',
            'Older table captions and numeric outputs may be stale; no authoritative DOCX selected.',
            'candidate TCC DOCX; see 11_DOCUMENTOS_TCC/INVENTARIO_DOCUMENTAL.md',
            'CANDIDATE_DOCX_UNCONFIRMED',
            'high for anchor; none for current values',
            'yes — confirm manuscript version and authorize sharing',
            'Use aggregate CSV and preserve the evidence class per row.',
            'Table 4.3',
            'C01;C02;C04;C05;C06;C08',
            'REPLACE',
            '1',
        ],
        [
            '4',
            '4.5',
            'Candidate DOCX paragraphs 124–125; caption anchor “Tabela 4.5 – cenário favorecido por perfil”; repeated in DOCX-B/C/D/E.',
            'Profile winners/qualitative reading are not synchronized with the corrected space accounting.',
            'Replace with 12 profile rows; if any company/profile is missing, mark BLOCKED rather than infer.',
            'Old labels may imply optimum beyond evaluated catalog.',
            'candidate TCC DOCX; see 11_DOCUMENTOS_TCC/INVENTARIO_DOCUMENTAL.md',
            'CANDIDATE_DOCX_UNCONFIRMED',
            'high for anchor; none for final winners',
            'yes — confirm manuscript version',
            'Say best among evaluated candidates and state coverage.',
            'Table 4.5',
            'C02;C11;C12;OPT_001;OPT_002;SCORE_003',
            'REPLACE',
            '2',
        ],
        [
            '3–5',
            'Methods/results/conclusion',
            'Candidate DOCX-B/C/D: paragraph near 158 includes WACC; figures/table mentions occur elsewhere.',
            'Claims relying on WACC and inventory carry an unresolved period/unit and protected value.',
            'Withhold numeric rate; describe the inventory proxy and its limitations pending authorization.',
            'Do not infer annual or monthly periodicity from formatting.',
            'candidate TCC DOCX; see 11_DOCUMENTOS_TCC/INVENTARIO_DOCUMENTAL.md',
            'CANDIDATE_DOCX_UNCONFIRMED',
            'high for keyword anchor; exact claims need selected DOCX review',
            'yes — author/source owner and reviewer',
            'Remove rate-specific conclusion until source metadata and release approval are available.',
            'WACC statements and stock-cost discussion',
            'C05;UNIT_002;E1_004',
            'QUALIFY',
            '3',
        ],
        [
            '4–5',
            'E2 scenario discussion',
            'Candidate DOCX-A–G contain “Cenário N”; occurrence anchors vary by version (for example first hit in DOCX-C paragraph 46; results discussion appears later).',
            'Cenário N is not reproducible without observed flow-to-CD allocation.',
            'Remove numerical recommendation or label workbook-only reference; do not reconstruct allocation from aggregates.',
            'Occurrence alone is not proof of the exact claim or its page.',
            'candidate TCC DOCX; see 11_DOCUMENTOS_TCC/INVENTARIO_DOCUMENTAL.md',
            'CANDIDATE_DOCX_UNCONFIRMED',
            'high for keyword presence; low for claim interpretation',
            'yes — confirm manuscript version and provide allocation if authorized',
            'State that scenario is not reproducible from currently available allocation evidence.',
            'Cenário N tables and discussion',
            'C08;C10;E2_003',
            'QUALIFY',
            '4',
        ],
        [
            '4–5',
            'Robustness/results',
            'Candidate DOCX-A–G contain Monte Carlo and 2033 anchors; structured headings are absent in TCC files.',
            'Legacy probability and 2033 statements need source class and matched configuration.',
            'Replace only from paired MC outputs and qualified 2033 scenario exports; otherwise remove predictive interpretation.',
            'Candidate-version ambiguity and missing external fiscal review remain.',
            'candidate TCC DOCX; see 11_DOCUMENTOS_TCC/INVENTARIO_DOCUMENTAL.md',
            'CANDIDATE_DOCX_UNCONFIRMED',
            'high for keyword presence; exact text pending selected file',
            'yes — confirm manuscript version and tax review',
            'Describe MC as conditional sensitivity; 2033 as parameterized exploratory analysis.',
            'Monte Carlo and 2033 discussion',
            'C09;C13;MC_001;TAX_003',
            'QUALIFY',
            '5',
        ],
    ],
}

# Priority/status mapping follows C01–C15 in the supplied plan. A BLOCKED final
# run remains different from a test failure; failure counts are left unknown.
CSV_ROWS['01_AUDITORIA/MATRIZ_CRITICAS_C01_C15.csv'] = [
    [
        'C01',
        'P0',
        'E1 baseline tax',
        'BLOCKED_SOURCE',
        'Tax preserved by anchor is not an independent non-anchored result; causal bridge absent.',
        'scenario-simulator.js; tax modules',
        'baseline tax route',
        'authorized fiscal flows and final rerun',
        'TAX_001;E1_001',
        '',
        '',
        '03_TRIBUTACAO/e1_tax_explanation.md',
        'not quantified in audited final run',
        'Separate anchored reference from non-anchored indicator; no causal attribution.',
        'authorized data owner/tax reviewer',
        'Historical run exists but final post-change reconciliation not supplied.',
    ],
    [
        'C02',
        'P0',
        '12 optimizer profiles and no-tax E1',
        'BLOCKED_FINAL_RUN',
        'Refinement denominator semantics corrected; final integrated generation and profile export pending.',
        'assets/js/phase4/scenario-optimizer.js',
        'profile optimization and search-space accounting',
        'final clean run and approved aggregate projection',
        'OPT_001;OPT_002;SCORE_002;C02 synthetic overlap/extension',
        'synthetic unit test passed',
        'integrated suite/final run pending',
        '04_CENARIOS_E_OTIMIZACAO/tabela_4_5_12_perfis.csv',
        'final counts/winners pending',
        'Publish six profiles per company and separate no-tax E1; best in tested catalog.',
        'none identified',
        'No global-optimum claim; include coverage and extension count.',
    ],
    [
        'C03',
        'P0',
        '2033 and 3.71 percent trace',
        'BLOCKED_SOURCE',
        'Model parameters and source trace for the historical percentage are not consolidated.',
        'tax-reform-config.js; tax engine',
        '2033 comparison and cited percentage',
        'same-year baseline/candidate and source-cell trace',
        'TAX_003;TAX_005',
        '',
        '',
        '03_TRIBUTACAO/2033_scenario_comparison.csv;03_TRIBUTACAO/3_71_percent_trace.md',
        'not available in final audited run',
        'Treat 2033 as parameterized exploratory; remove unsupported percentage.',
        'tax specialist',
        'Legal transition does not validate company-specific rates.',
    ],
    [
        'C04',
        'P0',
        'E2 one CD ES',
        'BLOCKED_SOURCE',
        'Workbook and simulator allocation equivalence is not established.',
        'scenario-flow-rebuilder.js; workbook source',
        'one-CD ES comparison',
        'same allocation, scope and period',
        'E2_001',
        '',
        '',
        '04_CENARIOS_E_OTIMIZACAO/e2_1cd_es_reconciliation.csv',
        'not decomposed in final audited run',
        'Separate workbook-only value from simulator result.',
        'authorized allocation matrix',
        'No attribution to a single cost component.',
    ],
    [
        'C05',
        'P0',
        'E1 WACC',
        'BLOCKED_AUTHORIZATION',
        'Protected WACC field identified; value disclosure, unit and periodicity unresolved.',
        'protected source; model config',
        'inventory cost proxy',
        'source metadata and disclosure review',
        'UNIT_002;E1_004',
        '',
        '',
        '02_BASELINE_E_DADOS/e1_wacc_source_audit.md',
        'numeric source value withheld',
        'Do not publish the rate; qualify inventory as revenue-based proxy.',
        'source owner',
        'Periodicity remains BLOCKED.',
    ],
    [
        'C06',
        'P0',
        'E1 transfer unit and route',
        'BLOCKED_SOURCE',
        'Proxy distance/rate does not prove supplier/factory-to-CD physical leg or compatible unit.',
        'physical-cost-engine.js',
        'transfer cost',
        'authorized route and R$/kg-km calibration',
        'UNIT_001;E1_002;E1_003',
        '',
        '',
        '02_BASELINE_E_DADOS/e1_transfer_methodology.md',
        'proxy effect not validated',
        'Do not present as observed transfer expense.',
        'data owner',
        'Keep sensitivity exploratory pending compatible source.',
    ],
    [
        'C07',
        'P0/P1',
        'Fallback and contingencies',
        'BLOCKED_SOURCE',
        'Fallback incidence by value and final flow denominators not exported.',
        'physical-cost-engine.js',
        'contingency and fallback calculations',
        'final diagnostic outputs',
        'FLOW_002;C07',
        '',
        '',
        '04_CENARIOS_E_OTIMIZACAO/fallback_incidence_by_scenario.csv',
        'not quantified in final audited run',
        'Report fallback counts and value share separately.',
        'none identified',
        'Fallback is not observed coverage.',
    ],
    [
        'C08',
        'P0',
        'E2 tax matrix delta',
        'BLOCKED_SOURCE',
        'Historical tax difference has no operation-level reason-code bridge.',
        'ETL and tax export',
        'tax aggregation',
        'private row reconciliation and reviewed aggregation',
        'TAX_004;E2_002',
        '',
        '',
        '03_TRIBUTACAO/e2_tax_delta_root_cause.md',
        'unexplained',
        'Keep source definitions distinct; do not force alignment.',
        'authorized tax data owner',
        'Root cause remains unexplained.',
    ],
    [
        'C09',
        'P0',
        'Reform assumptions and alpha',
        'BLOCKED_SOURCE',
        'Model tax assumptions are not validated as legal schedule or company-specific effective rates.',
        'tax config and tax engines',
        'tax transition and credits',
        'official source version and professional review',
        'TAX_003;TAX_005;TAX_007',
        '',
        '',
        '03_TRIBUTACAO/tax_assumptions_register.md',
        'not quantified as company liability',
        'Label as exploratory sensitivity, not forecast.',
        'tax specialist',
        'Avoid unsupported selective-tax incidence.',
    ],
    [
        'C10',
        'P0/P1',
        'E1 baseline components',
        'BLOCKED_FINAL_RUN',
        'Anchored and non-anchored component decomposition is not yet consolidated for final rerun.',
        'physical-cost-engine.js; baseline builder',
        'baseline component calculation',
        'same inputs and method audit',
        'FIN_001;FIN_002;LARGE_001',
        '',
        '',
        '02_BASELINE_E_DADOS/e1_baseline_decomposition.csv',
        'final reconciliation pending',
        'Keep anchor separate from physical computation.',
        'none identified',
        'Do not infer target component values from scenarios.',
    ],
    [
        'C11',
        'P1',
        '16th origin and ETL counts',
        'BLOCKED_SOURCE',
        'Origin identity and record-count definitions are not reconciled with source lineage.',
        'ETL modules',
        'source and row lineage',
        'authorized source manifest and count bridge',
        'FLOW_001;C11',
        '',
        '',
        '02_BASELINE_E_DADOS/origin_16_investigation.md;02_BASELINE_E_DADOS/etl_count_reconciliation.csv',
        'not quantified in shareable final export',
        'Do not infer physical type from active-CD count.',
        'data owner',
        'No IDs/routes exported.',
    ],
    [
        'C12',
        'P1',
        'Monte Carlo pairing and robust scenarios',
        'BLOCKED_FINAL_RUN',
        'Paired method is under change; only validated pairs may be projected.',
        'monte-carlo-engine.js',
        'shared shock and seed handling',
        'clean final execution and self-vs-self tests',
        'MC_001;MC_002;MC_004;MC_006',
        '',
        'final integrated run pending',
        '05_MONTE_CARLO/monte_carlo_paired_summary.csv',
        'conditional outputs pending',
        'Withdraw nominal-baseline probabilities; describe paired sensitivity conditionally.',
        'none identified',
        'Seed and distributions do not establish empirical probability.',
    ],
    [
        'C13',
        'P1',
        'Demo site and brand',
        'BLOCKED_AUTHORIZATION',
        'URL, screenshot safety and partner brand approval are not documented in this bundle.',
        'site/demo materials',
        'demo audit',
        'safe synthetic dataset and written authorization',
        'SEC_002;SEC_003',
        '',
        '',
        '07_SITE_DEMO/site_identity_audit.md',
        'not applicable',
        'Use generic names; no real session screenshots.',
        'author and partner',
        'No brand or deployment claim.',
    ],
    [
        'C14',
        'P2/EXTERNAL',
        'Meeting date',
        'BLOCKED_SOURCE',
        'No documentary proof of the referenced meeting/date is present.',
        'author correspondence',
        'meeting evidence',
        'authorized written record',
        'external fact check',
        '',
        '',
        '01_AUDITORIA/PENDENCIAS_EXTERNAS.md',
        'not applicable',
        'Do not state a date or agreement.',
        'author/orientador',
        'Absent record is not proof no meeting occurred.',
    ],
    [
        'C15',
        'P0',
        'Final data handoff and academic delivery',
        'BLOCKED_FINAL_RUN',
        'One synchronized final aggregate ZIP is waiting for final execution and independent validation.',
        'audit builder and independent validator',
        'package integration',
        'clean run, tests, privacy scan, independent validator',
        'PKG_001;SEC_001;DOC_001',
        '',
        '',
        '00_MANIFESTO/package_validation.json;STATUS_FINAL.md',
        'final handoff pending',
        'Use only outputs with run ID and evidence class.',
        'source and publication approvals',
        'Scientific status stays blocked for unresolved P0 gates.',
    ],
]

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
        '- Motivo: este artefato específico não foi produzido a partir de evidências rastreáveis suficientes. '
        'A existência de outros resultados não preenche esta lacuna.\n'
        f'- run_id: `{run_id}`\n'
        '- Ação necessária: gerar este artefato a partir de execução rastreada com fontes autorizadas; '
        'preservar ausências como null/razão de bloqueio.\n'
        '- Efeito no TCC: não usar números inferidos deste arquivo.\n'
    )


EDITORIAL_DOCS = {
    '01_AUDITORIA/AUDITORIA_H1_H12.md': """# Auditoria H1–H12 — estado para revisão acadêmica

Este relatório distingue constatações estáticas, valores históricos e resultados de execução. A evidência atual não está consolidada após as alterações recentes; conclusões quantitativas dependentes dela permanecem bloqueadas.

| ID | Tema | Estado | Efeito editorial / prova necessária |
|---|---|---|---|
| H1 | Unidade e escopo do custo de transferência E1 | BLOCKED | Não chamar o proxy atual de tarifa observada; obter rota fornecedor/fábrica→CD e tarifa dimensionalmente compatível. |
| H2 | Custo de estoque e WACC | BLOCKED | A fonte protegida contém campo WACC, mas unidade/periodicidade e autorização de divulgação não estão estabelecidas. Não reproduzir o valor no TCC compartilhável. |
| H3 | Cobertura e fallback de frete | BLOCKED | Separar cobertura por fluxo e por valor; fallback não equivale a dado observado. |
| H4 | Comparabilidade baseline–alternativa | BLOCKED | Fixar período, escopo logístico/fiscal, premissas e regra de realocação iguais antes de calcular saving. |
| H5 | Ancoragem do baseline | BLOCKED | Publicar lado a lado modo ancorado e não ancorado; igualdade com referência contábil não prova validade independente. |
| H6 | Reconciliação tributária E2 | BLOCKED | A divergência histórica permanece sem ponte por operação/exclusão e sem causa reproduzida. |
| H7 | Configuração de Reforma e ano 2033 | BLOCKED | Tratar alíquotas/créditos do motor como hipótese paramétrica até fonte e validação fiscal profissional. |
| H8 | Cenário E2 de CD único ES | BLOCKED | Separar regra do simulador do cenário workbook; não alegar equivalência sem mesma alocação e base. |
| H9 | Cenário N | BLOCKED | Não reproduzível enquanto faltar matriz observada fluxo–CD; totais agregados não substituem alocação. |
| H10 | Busca e perfis do otimizador | BLOCKED | Melhor resultado significa melhor no conjunto testado; reportar universo, truncamento, candidatos e espaço contado. |
| H11 | Monte Carlo e robustez | BLOCKED | Resultados legados usam baseline nominal; não interpretar como comparação pareada nem probabilidade real de economia. |
| H12 | Identidade, marca e revisão documental | BLOCKED | Usar denominação acadêmica genérica; confirmar autorização de marca e revisar o DOCX antes de republicar. |

## Uso

Os estados acima não são aprovações nem falhas de código por si só. Cada bloqueio exige a fonte indicada, execução com `run_id` comum e atualização dos artefatos dependentes. Remover este aviso somente após validação documental e numérica.
""",
    '01_AUDITORIA/CAUSAS_RAIZ.md': """# Causas-raiz observadas e hipóteses ainda abertas

## Confirmado por inspeção do código/documentação

- O custo de estoque da E1 usa receita mensal multiplicada por WACC; é uma aproximação de estoque, não saldo físico observado.
- O motor de transferência E1 usa proxy associado à geografia de destino e a proveniência registra incompatibilidade histórica entre tarifa descrita em R$/kg e taxa exigida em R$/kg-km. Sem rota fornecedor–CD e recalibração, o custo não é observado.
- A cobertura fiscal por fluxo está incompleta e o motor classifica a decisão fiscal como exploratória.
- O catálogo limitado do otimizador não representa todos os subconjuntos de E1. A correção de contagem separa refinos já contidos no domínio dos que introduzem valores externos.
- Resultados anteriores de Monte Carlo não usavam o mesmo choque nos dois lados da comparação; a interpretação de `P(saving > 0)` contra baseline nominal deve ser retirada até nova execução pareada.

## Não demonstrado

Não há ainda execução final auditada consolidada pós-alterações; permanecem sem prova a causa da divergência tributária, a decomposição final de cenários, a calibração da transferência, os valores em 2033 e os vencedores finais dos perfis. Atribuição causal fica bloqueada onde faltam dados de origem.
""",
    '01_AUDITORIA/DECISOES_METODOLOGICAS.md': """# Decisões metodológicas requeridas

| Decisão | Estado | Regra provisória segura | Quem/que evidência desbloqueia |
|---|---|---|---|
| Transferência E1 é custo histórico ou proxy | BLOCKED | Identificar como proxy exploratório; não somar em saving validado | Fonte de rota fábrica/fornecedor→CD e taxa em R$/kg-km |
| WACC E1, unidade e periodicidade | BLOCKED | Não divulgar número ou afirmar anual/mensal | Workbook autorizado, metadados da célula e revisão de divulgação |
| Tributo é custo ou indicador fiscal | BLOCKED | Apresentar separado do custo logístico e não chamar economia líquida | Regime, créditos, repasse e parecer fiscal |
| Parâmetros tributários de 2033 | BLOCKED | Denominar cenário paramétrico exploratório | Fonte/versionamento de alíquotas e validação especializada |
| E2 workbook versus motor | BLOCKED | Manter classes `WORKBOOK_ONLY` e `REPRODUCED_MODEL` distintas | Cenário com mesma alocação e escopo |
| Robustez | IN_PROGRESS | Publicar legado separado; usar comparação pareada somente após teste e execução final | Nova execução MC rastreada |
| Viabilidade operacional | BLOCKED | Capacidade, SLA e implantação = desconhecidos | Dados operacionais e validação do operador |
| Marca/parceiros | BLOCKED | Denominação genérica | Autorização escrita |

Decisões pendentes não podem ser substituídas por defaults silenciosos. O revisor deve registrar decisão, responsável, data e documento de suporte.
""",
    '01_AUDITORIA/PENDENCIAS_EXTERNAS.md': """# Pendências externas que bloqueiam conclusões

- **Fonte fiscal e documental:** acesso autorizado a planilhas originais, período, filtros, linhas excluídas e campos de alocação por fluxo.
- **WACC E1:** validar unidade, periodicidade, escopo e autorização para divulgação; o valor não é reproduzido aqui.
- **Transferência E1:** confirmar origem física fornecedor/fábrica→CD, distância do trecho e taxa em unidade compatível.
- **Reforma tributária:** obter revisão de profissional tributário para calendário, incidência, créditos e categoria de produto.
- **Operação:** validar capacidade de CDs, SLA, implantação, risco e restrições físicas.
- **Cenário N:** fornecer matriz observada fluxo–CD, caso se deseje reproduzi-lo.
- **Marca e reunião:** autorização de marca/parceiro e confirmação documental de eventual reunião; não inferir nomes, datas ou acordos.
- **Documento TCC:** acesso ao DOCX autorizado para inventário editorial; até lá, o inventário parágrafo a parágrafo está bloqueado.

Sem esses itens, os artefatos dependentes permanecem `BLOCKED` e as afirmações correspondentes devem ser retiradas ou qualificadas como exploratórias.
""",
    '01_AUDITORIA/MODELO_ANTES_DEPOIS.md': """# Modelo antes/depois — limites da comparação

O pacote deve comparar a versão-base observada com a execução posterior usando o mesmo conjunto de dados, configuração, horizonte e cenário. A execução final pós-alterações ainda não foi consolidada; por isso não há valores novos atribuídos nem diferenças numéricas calculadas neste documento.

Mudanças metodológicas relevantes já identificadas para rastrear na próxima execução:

1. WACC precisa vir do bundle de baseline quando disponível; a periodicidade continua bloqueada.
2. O otimizador distingue refinamentos dentro do domínio discreto de extensões externas. Subconjuntos de CDs ausentes do catálogo limitado não aumentam o espaço teórico.
3. A comparação Monte Carlo deve aplicar choques comuns a baseline e candidato e exportar seed efetiva, algoritmo, N e perdas inválidas.
4. Resultados fiscais e transferência permanecem condicionais às fontes e hipóteses explicitadas.

Antes de publicar qualquer diferença, preencher `impact_matrix.csv`, recalcular saídas dependentes e anexar `run_id`/hashes correspondentes.
""",
    '02_BASELINE_E_DADOS/e1_wacc_source_audit.md': """# Auditoria de proveniência do WACC E1

- A fonte local protegida contém um campo WACC; o pacote não publica seu valor numérico.
- Unidade, periodicidade, período de referência e política de conversão não estão comprovados neste artefato.
- O ETL/modelo usa receita mensal multiplicada pelo WACC como aproximação de custo de estoque. Isso não representa saldo de estoque observado.
- O motor possui defaults que devem ser reconciliados com a fonte autorizada; a execução final e a conferência célula–parâmetro ainda são necessárias.
- Estado: `BLOCKED_AUTHORIZATION` para divulgar o valor e `BLOCKED_SOURCE` para unidade/periodicidade.
- Consequência: retirar qualquer conclusão quantitativa sobre custo de estoque ou diferença atribuída ao WACC até aprovação e reconciliação.
""",
    '02_BASELINE_E_DADOS/e1_transfer_methodology.md': """# Transferência E1 — método e validade

A implementação documentada utiliza um proxy de distância destino–CD com taxa cuja proveniência histórica não demonstra unidade compatível com R$/kg-km. Transferência física deveria representar fornecedor/fábrica→CD. Não há base para tratar o valor atual como frete de transferência observado.

**Classificação atual:** `PARAMETRIC_EXPLORATORY`; origem física e calibração `BLOCKED_SOURCE`.

Para desbloquear: obter rota autorizada, peso, distância, período e frete associados; calcular taxa ponderada como `Σ frete / Σ(peso × distância)`; separar distribuição de transferência; registrar cobertura em fluxo e valor; comparar o custo sem proxy e sob sensibilidades rotuladas. Não converter R$/kg em R$/kg-km sem dados de distância.
""",
    '02_BASELINE_E_DADOS/origin_16_investigation.md': """# Investigação da 16ª origem

Não atribuir a origem adicional a fábrica, fornecedor ou CD sem chave e tipo físico observados. A investigação precisa listar IDs anonimizados, categoria, presença em `distance_matrix`, `active_cds`, roteamento e contagem antes/depois de cada filtro.

**Estado:** `BLOCKED_SOURCE` para identificação e reconciliação das contagens. Não exportar códigos comerciais, rotas ou coordenadas. O TCC deve evitar afirmar que 15 CDs ativos implicam 15 origens totais.
""",
    '03_TRIBUTACAO/e1_tax_explanation.md': """# Tributação E1 — interpretação admissível

O tributo do modelo tem cobertura fiscal incompleta e permanece proxy exploratório. Um imposto preservado por referência canônica não é cálculo fiscal independente. A comparação entre modos deve mostrar, separadamente, impostos, créditos e cobertura por fluxo/valor; não chamar a diferença de economia líquida sem repasse e elegibilidade dos créditos.

O salto histórico entre versões do baseline não foi causalmente atribuído a mudanças de CDs nem reconciliado por operação. A execução final precisa registrar regime, ano, origem/destino, receita, classificação fiscal e regras de crédito. Até lá, retirar a afirmação causal e não usar a estimativa como resultado empresarial.
""",
    '03_TRIBUTACAO/e2_tax_delta_root_cause.md': """# Divergência tributária E2 — causa ainda não reconciliada

A diferença histórica entre matriz bruta e total canônico permanece `UNEXPLAINED` neste handoff. Não aplicar fator corretivo ou tolerância para forçar paridade. É necessária ponte privada por documento/operação com filtros, cancelamentos, sinais, colunas tributárias, duplicidade, data e arredondamento; exportar somente totais agregados aprovados.

**Estado:** `BLOCKED_SOURCE`. O TCC deve apresentar ambos como definições distintas ou omitir a comparação até fechar o resíduo ao centavo. Ausência de acesso à base granular não equivale a prova de ausência de diferença.
""",
    '03_TRIBUTACAO/tax_assumptions_register.md': """# Registro de hipóteses tributárias

| Premissa | Classe | Estado | Consequência |
|---|---|---|---|
| Calendário legal CBS/IBS/ICMS/ISS | `OBSERVED_SOURCE` (legislação oficial) | Referência legal; conferir versão e regras de transição | Não equivale a alíquota efetiva da empresa. |
| Alíquota efetiva por operação | `BLOCKED_SOURCE` | Não há validação fiscal completa no pacote | Não publicar previsão empresarial. |
| Créditos e elegibilidade | `PARAMETRIC_EXPLORATORY`/`BLOCKED` | Bases e elegibilidade precisam ser documentadas | Não chamar tributo bruto de economia líquida. |
| Imposto Seletivo | `PARAMETRIC_EXPLORATORY` | Aplicação depende da classificação do produto e norma vigente | Não presumir incidência sobre mercadoria genérica. |
| Regime/ano/UF por fluxo | `BLOCKED_SOURCE` | Cobertura incompleta | Cobertura zero não pode ser convertida em valor validado. |

Fontes legais para conferência incluem [LC 214/2025, texto atualizado](https://legis.senado.gov.br/norma/40180341/publicacao/40181429), [Receita Federal — destaque de CBS e transição](https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2026/outubro/reforma-tributaria-86-dos-documentos-fiscais-de-empresas-obrigadas-ja-trazem-destaque-da-cbs) e [Ministério da Fazenda — Imposto Seletivo](https://www.gov.br/fazenda/pt-br/assuntos/noticias/2026/novembro/governo-federal-define-aliquotas-do-imposto-seletivo-para-2027-por-meio-de-medida-provisoria). Parâmetros do motor permanecem exploratórios; parecer fiscal especializado está pendente.
""",
    '10_TCC_HANDOFF/EQUACOES_E_PREMISSAS.md': """# Equações e premissas a explicitar

- Custo de frete com tarifa por peso: `C = Σ peso × tarifa`, somente quando unidade e escopo da tarifa correspondem ao trecho.
- Transferência com tarifa por massa-distância: `C = Σ peso × distância × tarifa(R$/kg-km)`; requer origem e destino físicos do trecho.
- Custo de estoque no proxy implementado: receita mensal × WACC, com eventual ajuste temporal explicitado. O WACC da fonte permanece sem divulgação e sua periodicidade está bloqueada.
- Saving percentual: `100 × (custo_baseline − custo_cenário) / custo_baseline`; usar baseline comparável, precisão integral e mesma definição de escopo.
- Contagem de CDs com subconjuntos não vazios: `2^n − 1`; refinamentos internos ao domínio não elevam o denominador.
- Monte Carlo pareado: `ΔC_j = C_candidato,j − C_baseline,j` sob um mesmo vetor de choques `j`; interpretação condicionada às distribuições e ao modelo.

Cada fórmula deve vir acompanhada de unidade, fonte, denominador, tratamento de nulos, regra de arredondamento e status metodológico.
""",
    '04_CENARIOS_E_OTIMIZACAO/e2_1cd_es_root_cause.md': """# E2 um CD no ES — comparabilidade

O valor legado do workbook e o resultado do simulador devem usar IDs/classe de fonte distintos. O motor aplica sua própria regra de realocação; sem matriz de alocação equivalente, não é possível decompor a diferença como erro de tarifa ou erro de roteamento.

**Estado:** `NOT_COMPARABLE` até reproduzir a mesma alocação, escopo e período. Não afirmar que a diferença decorre de um único componente. Separar logística, tributo, fallback, fluxos descobertos e valor de referência do workbook.
""",
    '04_CENARIOS_E_OTIMIZACAO/optimizer_winners_changed.md': """# Mudança de vencedores por perfil

Não há vencedor final aprovado neste pacote. A tabela comparativa precisa usar os mesmos candidatos e a mesma normalização por empresa para todos os perfis, registrar pesos somando 1, restrições, empates e alterações contra o perfil de referência.

O melhor perfil é o melhor candidato no catálogo validado, não um ótimo global quando a busca é parcial. Após execução final, preencher IDs anonimizados, CDs em forma agregada se permitido, score, custos, status fiscal e cobertura; omitir este resultado até o `run_id` e o catálogo estarem sincronizados.
""",
    '05_MONTE_CARLO/monte_carlo_legacy_comparison.md': """# Monte Carlo legado e interpretação

Resultados legados comparavam candidatos com baseline nominal fixo. Essa estatística não estima a probabilidade condicional de o candidato superar o baseline sob o mesmo choque; não a denominar robustez nem probabilidade real de economia.

A nova execução deve parear cada amostra: mesmo vetor de choque para baseline e candidato, registrar seed solicitada/efetiva, algoritmo, N, distribuições, choques, invalidações e erro-padrão. Para o baseline comparado consigo mesmo, todos os deltas devem ser zero, `P(ΔC<0)=0` e empate igual a 1. Mesmo com esse teste, o resultado continua condicional ao modelo e às distribuições escolhidas.
""",
    '07_SITE_DEMO/site_identity_audit.md': """# Identidade e segurança da demonstração

Este pacote não certifica URL, identidade visual, autorização de marca ou sessão de demonstração. A validação deve usar somente dados fictícios de `data-demo`, sem sessão autenticada com informação empresarial.

**Estado:** `BLOCKED_SOURCE` para URL/smoke test e `BLOCKED_AUTHORIZATION` para marca/parceiros. Usar denominação genérica no TCC até existir autorização escrita. Capturas não foram incluídas.
""",
    '08_ATUALIZACAO_TCC/GUIA_ATUALIZACAO_TCC.md': """# Guia de atualização do TCC

## Sequência de revisão

1. Atualizar método e limitações antes de substituir qualquer resultado.
2. Não misturar valores `WORKBOOK_ONLY`, `ANCHORED_REFERENCE` e `REPRODUCED_MODEL` na mesma coluna ou como se fossem estimativas equivalentes.
3. Atualizar tabelas somente a partir dos CSVs com `run_id`, unidade, filtro, status e fonte; manter valores bloqueados vazios, nunca preenchidos com zero.
4. Separar custo logístico, indicador fiscal e eventual economia líquida; qualificar toda hipótese de Reforma e transferência.
5. Remover alegações de previsão/probabilidade, validação, reprodução perfeita e ótimo global sem prova correspondente.
6. Regerar figuras, chamadas no texto, resumo, abstract, conclusão, sumário e referências depois de decidir quais tabelas são admissíveis.

## Liberação atual

Nenhum resultado quantitativo deste pacote está liberado como conclusão final; este guia é editorial e metodológico. A execução final auditada e a revisão documental continuam pendentes.
""",
    '08_ATUALIZACAO_TCC/TABELAS_FINAIS.md': """# Tabelas finais — estado de liberação

As tabelas numéricas permanecem bloqueadas até a geração pós-alterações com `run_id` e hashes. Não transcrever tabelas antigas do TCC para preencher o handoff.

| Tabela | Uso agora | Ação antes de publicação |
|---|---|---|
| 4.2 Baseline | BLOCKED | Reconciliar ancorado vs não ancorado e decomposição por componente. |
| 4.3 E1 | BLOCKED | Reexecutar cenários e rebaixar custo de transferência/tributo não validados. |
| 4.4 E2 | WORKBOOK_ONLY / BLOCKED | Separar referência do workbook do motor e provar comparabilidade. |
| 4.5 Perfis | BLOCKED | Gerar 12 linhas; E1 sem tributo separada; registrar cobertura e busca. |
| 4.6 Síntese | BLOCKED | Só derivar de tabelas liberadas e fórmulas documentadas. |
""",
    '08_ATUALIZACAO_TCC/TEXTO_SUGERIDO_SECAO_3.md': """# Texto proposto — metodologia (seção 3)

O estudo deve ser descrito como avaliação computacional condicionada aos dados e às hipóteses implementadas. A malha é representada por fluxos e CDs disponíveis, com custos logísticos e indicadores fiscais calculados por regras explícitas. Os valores ancorados preservam uma referência de comparação e não constituem validação independente do motor.

Quando a cobertura de tarifas, fiscalidade ou rotas físicas for incompleta, classificar os componentes como proxies e reportar a cobertura por fluxo e valor. Os perfis de otimização exploram o catálogo definido pelo algoritmo; resultados não demonstram ótimo global se o espaço não foi enumerado integralmente. A análise Monte Carlo deve ser pareada e interpretada como sensibilidade às distribuições assumidas, não como probabilidade empírica.

Substituir este texto somente após conferir configuração final, fontes, período, unidades, critérios de exclusão e `run_id` da execução.
""",
    '08_ATUALIZACAO_TCC/TEXTO_SUGERIDO_SECAO_4.md': """# Texto proposto — resultados (seção 4)

Os resultados devem ser apresentados por empresa e por cenário com custos logísticos, indicador fiscal, total, variação frente a baseline comparável e status de evidência. Valores preservados por ancoragem devem ser identificados como referência; valores de workbook sem reprodução devem permanecer `WORKBOOK_ONLY`.

Não preencher nesta versão valores dependentes de execução final ainda ausente. Cenários com fluxo descoberto, fallback ou hipótese fiscal devem ser separados dos resultados reproduzidos e não podem sustentar recomendação operacional. A tabela de perfis deve indicar número de candidatos, cobertura, regra de desempate e escopo de busca.
""",
    '08_ATUALIZACAO_TCC/TEXTO_SUGERIDO_SECAO_5.md': """# Texto proposto — discussão e conclusão (seção 5)

As conclusões devem limitar-se ao comportamento do modelo sob as premissas implementadas. Sem validação externa de custos, dados fiscais completos, origem física de transferência e restrições operacionais, não se pode inferir economia empresarial líquida nem recomendar fechamento de CDs.

Resultados de Reforma são cenários paramétricos até revisão especializada. Robustez estocástica é condicional às distribuições e ao acoplamento dos choques. O principal produto desta etapa é uma estrutura auditável de decisão; as conclusões numéricas permanecem bloqueadas até reconciliar evidência e atualizar tabelas sincronizadas.
""",
    '08_ATUALIZACAO_TCC/EDITORIAL_PENDENCIAS.md': """# Pendências editoriais

- Conferir sobreposições, duplicações e placeholders nas tabelas 4.3 e 4.5.
- Alinhar resumo, abstract, discussão e conclusão com tabelas efetivamente aprovadas.
- Corrigir equações, unidades, numeração de tabelas/figuras e referências cruzadas.
- Excluir frases como “reprodução perfeita”, “modelo validado”, “economia tributária comprovada”, “cenário ótimo” e “probabilidade real” sem evidência específica.
- Separar efeitos operacionais, fiscais e de estoque; não atribuir causalidade a um componente sem reconciliação.
- Conferir referências e autorização de marca/parceiros.
- Inventário do DOCX V4 permanece `BLOCKED_SOURCE_DOCX`; não houve revisão parágrafo a parágrafo neste ambiente.
""",
    '10_TCC_HANDOFF/RESUMO_EXECUTIVO_PARA_REVISOR.md': """# Resumo executivo para o revisor

## Veredito

`BLOCKED_FOR_FINAL_NUMERICAL_CLAIMS`. Há evidência histórica e inspeções metodológicas úteis, mas nenhuma execução final auditada consolidada pós-alterações foi fornecida neste pacote.

## O que pode orientar a revisão agora

- Separar dados observados, referência ancorada, workbook não reproduzido, hipóteses paramétricas e itens não reproduzíveis.
- Tratar transferência E1, WACC/estoque e tributos como bloqueios que afetam conclusões de custo total.
- Não confundir catálogo parcial do otimizador com ótimo global; refinamentos internos ao domínio não ampliam seu denominador.
- Rejeitar interpretação de Monte Carlo legado como probabilidade pareada.
- Manter Cenário N bloqueado sem alocação fluxo–CD observada.

## Próxima ação

Após a execução final, conferir `run_id`, manifests, hashes, status científicos e células numéricas contra o mapa fonte. Até lá, usar os guias editoriais e retirar conclusões quantitativas não suportadas.
""",
    '10_TCC_HANDOFF/TEXTO_CIENTIFICO_LIMITE_INFERENCIA.md': """# Limites de inferência científica

O simulador representa custos condicionados a dados, regras de roteamento, parâmetros e fallbacks. Um resultado reproduzível dentro do software não demonstra que os dados descrevem a operação real. Paridade com um total ancorado também não é validação independente.

Sem custos observados por trecho, cobertura fiscal compatível, reconciliação por operação, capacidade, SLA e validação profissional tributária, resultados devem ser chamados de exploratórios. Otimização é relativa ao catálogo e restrições enumeradas. Monte Carlo mede variação sob distribuições postuladas; não estima frequência real sem amostra e desenho estatístico adequados.
""",
    '10_TCC_HANDOFF/AUDITORIA_TERMINOLOGIA_E_IDENTIDADE.md': """# Terminologia e identidade

Usar “indicador fiscal estimado” para saída tributária não validada; “proxy de transferência” para taxa sem trecho físico comprovado; “melhor cenário no catálogo” para busca parcial; e “sensibilidade estocástica condicional” para Monte Carlo sem distribuições empiricamente validadas.

Evitar “economia líquida”, “previsão”, “ótimo global”, “modelo validado” e “probabilidade real” sem evidência correspondente. Usar nomes genéricos para parceiros e empresas no pacote compartilhável até autorização escrita. Identificadores de CD, rota, cliente e tarifa negocial não devem ser exportados.
""",
    '10_TCC_HANDOFF/PERGUNTAS_QUE_EXIGEM_AUTOR_OU_ORIENTADOR.md': """# Perguntas para autor/orientador

1. Qual é a definição operacional de custo total que o TCC pretende comparar?
2. Existe autorização escrita para compartilhar dados agregados, nome de parceiros e marca?
3. A análise fiscal deve ser somente indicador bruto ou existe evidência de créditos/repasse que permita estimar benefício líquido?
4. Há documentação de fornecedor/fábrica para CD e tarifa em unidade compatível com distância?
5. O workbook contém alocação fluxo–CD do cenário N e do CD único no ES?
6. O revisor autoriza substituir conclusões por resultados exploratórios caso os bloqueios fiscais e de custo persistam?
7. É possível fornecer o DOCX V4 para inventário de comentários, sobreposições, tabelas e referências?
8. Há registro documental da reunião mencionada e da data correspondente?
""",
    '10_TCC_HANDOFF/ENTRADAS_DOCUMENTAIS_NECESSARIAS.md': """# Entradas documentais necessárias

- Workbook original autorizado com abas, fórmulas, unidade, período e trilha de alterações.
- Metadados aprovados da célula WACC E1, incluindo periodicidade e base de cálculo.
- Matriz de tarifas, pesos e distâncias de transferência por trecho físico, com escopo de divulgação.
- Ponte tributária E2 por operação/documento em ambiente privado, com agregação revisada para compartilhamento.
- Alocação fluxo–CD do workbook para cenário N e definição exata do caso de CD único no ES.
- Parâmetros tributários versionados e parecer/revisão especializada.
- Capacidade, SLA e custos de implantação para CDs considerados.
- DOCX V4 e pareceres anteriores autorizados para inventário editorial.
- Autorização escrita de uso de marca, URL e nome de parceiros, se aplicável.

Dados granulares devem permanecer em ambiente privado. A ausência de qualquer item deve permanecer como bloqueio, não ser preenchida por hipótese silenciosa.
""",
    '10_TCC_HANDOFF/BIBLIOGRAFIA_PARA_CONFERENCIA.md': """# Bibliografia e fontes para conferência

Esta lista é um roteiro de verificação, não uma bibliografia final validada. Para cada fonte, registrar título, autor/entidade, ano, edição/URL, data de acesso e qual afirmação sustenta.

- Literatura metodológica sobre otimização discreta e limites de busca heurística.
- Referências de simulação Monte Carlo, acoplamento de variáveis aleatórias e erro de Monte Carlo.
- Fontes oficiais e versionadas sobre calendário e incidência da Reforma Tributária.
- Documentação do workbook e do ETL interno, com classificação de confidencialidade.
- Documentação acadêmica do estudo de caso e dos critérios de validação de modelos.

Não citar fonte legal ou empresarial como validação sem conferir versão e aplicabilidade ao período estudado.
""",
    '11_DOCUMENTOS_TCC/INVENTARIO_DOCUMENTAL.md': """# Inventário dos documentos candidatos ao TCC

Foram localizados DOCX candidatos em Downloads. Nenhum nome contém “V4”, e metadados internos são vazios ou anteriores à data no nome do arquivo. Portanto nenhum candidato foi promovido a manuscrito autoritativo. Os arquivos não foram copiados para o ZIP.

| ID local | Descrição não identificadora | Sinais estruturais | Estado |
|---|---|---|---|
| DOCX-A | TCC MC, cópia numerada, arquivo do início de novembro | 836 parágrafos, 15 tabelas, comentários e marcação OOXML de inserções/exclusões; configuração track-revisions desligada | CANDIDATE_DOCX_UNCONFIRMED |
| DOCX-B | TCC MC, versão corrigida datada de 06/11 | 829 parágrafos, 13 tabelas, comentários; sem tags OOXML w:ins/w:del observadas | CANDIDATE_DOCX_UNCONFIRMED |
| DOCX-C | TCC MC, versão final datada de 06/11 | 825 parágrafos, 13 tabelas e comentários; sem tags OOXML w:ins/w:del observadas | CANDIDATE_DOCX_UNCONFIRMED |
| DOCX-D | TCC MC, versão revisada datada de 06/11 | 824 parágrafos, 13 tabelas e comentários; sem tags OOXML w:ins/w:del observadas | CANDIDATE_DOCX_UNCONFIRMED |
| DOCX-E | TCC MC, versão revisada datada de 05/11 | 818 parágrafos, 13 tabelas e comentários; sem tags OOXML w:ins/w:del observadas | CANDIDATE_DOCX_UNCONFIRMED |
| DOCX-F | TCC MC, versão sem sufixo de revisão | 836 parágrafos, 13 tabelas e comentários; sem tags OOXML w:ins/w:del observadas | CANDIDATE_DOCX_UNCONFIRMED |
| DOCX-G | Relatório TCC a modificar | 760 parágrafos, 17 tabelas e comentários; sem tags OOXML w:ins/w:del observadas | CANDIDATE_DOCX_UNCONFIRMED |
| DOCX-H | Base genérica intitulada “tcc 1 base” | 37 parágrafos, sem tabelas, contém marcação de revisão | CANDIDATE_DOCX_UNCONFIRMED |

As seis âncoras de pesquisa — Tabela 4.3, Tabela 4.5, Cenário N, 2033, WACC e Monte Carlo — foram encontradas nos candidatos A–G. Os documentos TCC não usam estilos de heading consistentes. Os números de parágrafo coletados servem como âncora temporária, não como página verificada. Tags de revisão e configuração do Word foram aferidas separadamente; comentários estruturais aparecem nos candidatos com `comments.xml`, mas sua resolução e significado exigem revisão visual/humana. O arquivo de revisão técnica datado de 04/11 é parecer separado, não manuscrito.

**Bloqueio:** `BLOCKED_SOURCE_DOCX_VERSION`. O autor precisa confirmar o arquivo-base. A inspeção de estrutura e texto não substitui renderização visual nem revisão humana de comentários e alterações. Nenhum DOCX, nome de autor, hash documental, tabela ou texto integral é incluído neste handoff.
""",
    '06_TESTES_E_QA/TEST_REPORT.md': """# Relatório de testes e QA

## Evidência deste pacote

Os testes do builder/validador verificam integridade estrutural do ZIP e rejeição de membro adulterado. Eles não demonstram correção científica do modelo nem substituem a suíte integrada.

## Gates pendentes

- A suíte integrada pós-alterações e a execução final agregada devem ser anexadas pelo orquestrador.
- Testes que dependem de fontes empresariais são `BLOCKED_SOURCE` ou executados em ambiente privado; não se convertem em PASS por ausência de dados.
- Scanner do pacote verifica padrões comuns de segredo e identificadores; revisão de confidencialidade humana continua necessária.

**Estado científico:** `BLOCKED_FOR_FINAL_NUMERICAL_CLAIMS` até integrar relatório de execução e proveniência.
""",
}


def content_for(path: str, run_id: str, timestamp: str, commit: str) -> bytes:
    if path in EDITORIAL_DOCS:
        return (EDITORIAL_DOCS[path] + f'\n\n---\n\nrun_id de empacotamento: `{run_id}`.\n').encode()
    if path in CSV_HEADERS:
        return csv_text(CSV_HEADERS[path], CSV_ROWS.get(path, [])).encode()
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
                'note': 'Editorial reports and blocker records are included. Historical/private runs may exist, but no final audited consolidated execution was supplied for this package.',
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


def project_fiscal_diagnostics(directory: Path, run_id: str) -> dict[str, bytes]:
    specs = {
        'C01': (
            '03_TRIBUTACAO/e1_tax_baseline_ab_test.csv',
            {'network_cd_count', 'canonical_baseline_tax_brl', 'physical_unanchored_same_network_tax_brl'},
            {'input_flows', 'proxy_flows'},
            'NOT_COMPARABLE_METHOD',
        ),
        'C04': (
            '04_CENARIOS_E_OTIMIZACAO/e2_1cd_es_reconciliation.csv',
            {'workbook_and_engine_values_retained_separately', 'component_deltas_published'},
            {'factory_to_cd_flows', 'selected_cd_flows'},
            'NOT_EQUIVALENT_SCENARIO',
        ),
        'C08': (
            '03_TRIBUTACAO/e2_tax_reconciliation.csv',
            {'canonical_tax_brl', 'matrix_tax_brl', 'delta_brl', 'delta_pct', 'source_to_core_delta_brl'},
            {'source_rows', 'core_rows', 'source_only_rows', 'baseline_source_only_rows'},
            'unexplained_delta',
        ),
    }
    outputs = {}
    for issue, (target, metrics, counts, status) in specs.items():
        source = directory / f'{issue.lower()}_shareable_tax_summary.json'
        if not source.is_file():
            continue
        data = load_evidence(source)
        if (
            not data
            or data.get('run_id') != run_id
            or data.get('issue_id') != issue
            or data.get('schema_version') != 'tax-audit-aggregate-1.0'
            or data.get('status') != status
        ):
            raise ValueError(f'Invalid or mismatched fiscal diagnostic: {issue}')
        rows = []
        for group, allowlist in (('aggregate_metrics', metrics), ('row_counts', counts)):
            values = data.get(group, {})
            if not isinstance(values, dict):
                continue
            for key in sorted(allowlist & values.keys()):
                value = values[key]
                if isinstance(value, bool):
                    value = str(value).lower()
                else:
                    value = as_number(value)
                if value != '':
                    rows.append(
                        [
                            run_id,
                            issue,
                            status,
                            group,
                            key,
                            value,
                            'PRIVATE_REVIEWER_ONLY',
                            'Aggregate diagnostic; no independent fiscal validation; no comparison beyond stated status.',
                        ]
                    )
        outputs[target] = csv_text(
            ['run_id', 'issue_id', 'status', 'group', 'metric', 'value', 'sensitivity', 'limitation'], rows
        ).encode()
    return outputs


def load_evidence(path: Path | None) -> dict[str, object] | None:
    if path is None or not path.is_file():
        return None
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return None
    return data if isinstance(data, dict) else None


def manuscript_map(docx_bytes: bytes) -> bytes:
    import xml.etree.ElementTree as ET
    from io import BytesIO

    ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
    with zipfile.ZipFile(BytesIO(docx_bytes)) as archive:
        document = ET.fromstring(archive.read('word/document.xml'))
    paragraphs = document.findall('./w:body/w:p', ns)
    texts = [''.join(node.text or '' for node in para.findall('.//w:t', ns)) for para in paragraphs]
    tokens = ('Tabela 4.3', 'Tabela 4.5', 'WACC', 'cenário N', 'Monte Carlo')
    rows = []
    for token, original in zip(tokens, CSV_ROWS['10_TCC_HANDOFF/MAPA_REVISAO_PARAGRAFO_A_PARAGRAFO.csv'], strict=False):
        row = list(original)
        hits = [str(i) for i, text in enumerate(texts) if token.casefold() in text.casefold()]
        row[2] = (
            f'DOCX autorizado SHA-256 {sha256(docx_bytes)}; palavra-chave ‘{token}’; parágrafos diretos do corpo OOXML, índice zero: {", ".join(hits) if hits else "não localizada"}'
        )
        row[5] = 'Âncora verificada na cópia indicada; conclusão e valor exigem confronto com os artefatos vinculados.'
        row[6] = '11_DOCUMENTOS_TCC/TCC_BASE_PARA_REVISAO.docx'
        row[7] = 'ANCHOR_VERIFIED_REVIEW_REQUIRED' if hits else 'BLOCKED_ANCHOR_NOT_FOUND'
        row[8] = 'high for keyword location; no automatic claim validation' if hits else 'no matching anchor'
        row[9] = 'yes — revisão humana e validação externa das premissas aplicáveis'
        rows.append(row)
    return csv_text(CSV_HEADERS['10_TCC_HANDOFF/MAPA_REVISAO_PARAGRAFO_A_PARAGRAFO.csv'], rows).encode()


def evidence_is_traceable(evidence: dict[str, object] | None) -> bool:
    if not evidence:
        return False
    commit = str(evidence.get('commit_final') or '')
    run_id = str(evidence.get('run_id') or '')
    run_key = str(evidence.get('run_key') or '')
    return (
        len(commit) == 40
        and all(char in '0123456789abcdef' for char in commit.lower())
        and bool(run_id)
        and len(run_key) == 64
        and all(char in '0123456789abcdef' for char in run_key.lower())
        and evidence.get('dirty_worktree') is False
        and commit == git_value('rev-parse', 'HEAD')
        and git_value('status', '--porcelain', '--untracked-files=all') == ''
    )


def as_number(value: object) -> object:
    if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value):
        return value
    return ''


def projected_scenario_rows(evidence: dict[str, object], run_id: str) -> list[list[object]]:
    headers = CSV_HEADERS['04_CENARIOS_E_OTIMIZACAO/scenario_summary_all.csv']
    rows: list[list[object]] = []
    companies = evidence.get('companies', {})
    if not isinstance(companies, dict):
        return rows
    for company_id in ('empresa1', 'empresa2'):
        company = companies.get(company_id)
        if not isinstance(company, dict):
            continue
        baseline = company.get('baseline')
        candidates: list[tuple[str, dict[str, object], str, object]] = []
        if isinstance(baseline, dict):
            candidates.append(('baseline', baseline, 'ANCHORED_REFERENCE', baseline.get('active_cds_count')))
        physical_baseline = company.get('baseline_physical')
        if isinstance(physical_baseline, dict):
            candidates.append(
                (
                    'baseline_physical',
                    physical_baseline,
                    'PARAMETRIC_EXPLORATORY',
                    physical_baseline.get('active_cds_count'),
                )
            )
        results = company.get('academic_scenario_results', [])
        if isinstance(results, list):
            for index, result in enumerate(results, 1):
                if not isinstance(result, dict):
                    continue
                deterministic = result.get('deterministic')
                if isinstance(deterministic, dict):
                    scenario_meta = result.get('scenario', {})
                    active_count = scenario_meta.get('active_cd_count') if isinstance(scenario_meta, dict) else None
                    scenario_kind = scenario_meta.get('scenario_kind', '') if isinstance(scenario_meta, dict) else ''
                    safe_kinds = {'e1_exclusion_a', 'e1_exclusion_b', 'e1_single_cd_anonymized'}
                    scenario_key = (
                        f'{scenario_kind}_{index:03d}' if scenario_kind in safe_kinds else f'scenario_{index:03d}'
                    )
                    candidates.append(
                        (
                            scenario_key,
                            deterministic,
                            str(deterministic.get('source_class') or 'PARAMETRIC_EXPLORATORY'),
                            active_count,
                        )
                    )
        if company_id == 'empresa2':
            subsets = company.get('empresa2_subsets', [])
            if isinstance(subsets, list):
                for index, item in enumerate(subsets, 1):
                    if isinstance(item, dict) and isinstance(item.get('result'), dict):
                        candidates.append((f'subset_{index:03d}', item['result'], 'PARAMETRIC_EXPLORATORY', None))
            one_cd = company.get('empresa2_one_cd_es', {})
            if isinstance(one_cd, dict) and isinstance(one_cd.get('current'), dict):
                candidates.append(('one_cd_es', one_cd['current'], 'PARAMETRIC_EXPLORATORY', 1))
        for scenario_id, scenario, source_class, declared_active_count in candidates:
            costs = scenario.get('costs', {})
            if not isinstance(costs, dict):
                costs = {}
            data_quality = scenario.get('data_quality', {})
            coverage = data_quality.get('coverage', {}) if isinstance(data_quality, dict) else {}
            diagnostics = scenario.get('diagnostics', {})
            diagnostics.get('fallback_counts', {}) if isinstance(diagnostics, dict) else {}
            active_count = (
                declared_active_count if declared_active_count is not None else scenario.get('active_cds_count')
            )
            if active_count in (None, 0) and scenario_id == 'baseline' and isinstance(baseline, dict):
                active_count = baseline.get('active_cds_count')
            logistics = costs.get('total_logistics_cost')
            total = costs.get('total_with_tax', scenario.get('total_with_tax'))
            comparison_type = company.get('academic_comparison_type')
            is_physical_comparison = (
                scenario_id not in ('baseline', 'baseline_physical')
                and comparison_type == 'different_network_same_engine_physical_unanchored'
                and isinstance(physical_baseline, dict)
            )
            reference = (
                physical_baseline
                if is_physical_comparison
                else (scenario if scenario_id in ('baseline', 'baseline_physical') else None)
            )
            base_costs = reference.get('costs', {}) if isinstance(reference, dict) else {}
            baseline_logistics = (
                as_number(base_costs.get('total_logistics_cost')) if isinstance(base_costs, dict) else ''
            )
            baseline_total = as_number(base_costs.get('total_with_tax')) if isinstance(base_costs, dict) else ''
            logistics = as_number(logistics)
            total_saving = as_number(scenario.get('saving_pct')) if is_physical_comparison else ''
            logistics_saving = (
                100 * (float(baseline_logistics) - float(logistics)) / float(baseline_logistics)
                if reference is not None
                and isinstance(baseline_logistics, (int, float))
                and isinstance(logistics, (int, float))
                and baseline_logistics
                else ''
            )
            row = {
                'run_id': run_id,
                'company_id': company_id,
                'scenario_id': f'{company_id}-{scenario_id}',
                'scenario_name': {
                    'baseline': 'Baseline ancorado',
                    'baseline_physical': 'Baseline físico não ancorado',
                }.get(scenario_id, 'Cenário agregado'),
                'scenario_source': source_class,
                'scenario_status': scenario.get('simulation_status', 'success'),
                'tax_year': scenario.get('tax_year', ''),
                'tax_mode': scenario.get('tax_mode', ''),
                'active_cd_ids': '',
                'active_cd_count': as_number(active_count),
                'freight_multiplier': as_number(scenario.get('freight_multiplier')),
                'demand_multiplier': as_number(scenario.get('demand_multiplier')),
                'inventory_days': as_number(scenario.get('inventory_days')),
                'wacc': '',
                'transfer_brl': as_number(costs.get('transfer_cost')),
                'distribution_brl': as_number(costs.get('distribution_cost')),
                'storage_brl': as_number(costs.get('storage_cost')),
                'inventory_brl': as_number(costs.get('inventory_cost')),
                'logistics_brl': as_number(logistics),
                'current_tax_brl': '',
                'cbs_brl': '',
                'ibs_brl': '',
                'selective_tax_brl': '',
                'credits_brl': '',
                'tax_impact_brl': as_number(costs.get('tax_impact')),
                'total_with_tax_brl': as_number(total),
                'baseline_comparable_id': f'{company_id}-baseline_physical'
                if is_physical_comparison
                else (f'{company_id}-{scenario_id}' if reference is not None else ''),
                'baseline_logistics_brl': as_number(baseline_logistics),
                'baseline_total_brl': as_number(baseline_total),
                'saving_logistics_pct': as_number(logistics_saving),
                'saving_total_pct': as_number(total_saving),
                'tax_coverage_flow_pct': as_number(coverage.get('complete_fiscal_coverage_ratio') * 100)
                if isinstance(coverage, dict)
                and isinstance(as_number(coverage.get('complete_fiscal_coverage_ratio')), (int, float))
                else '',
                'tax_coverage_value_pct': '',
                'fallback_cost_share': '',
                'quality_score': as_number((scenario.get('quality') or {}).get('quality_score'))
                if isinstance(scenario.get('quality'), dict)
                else '',
                'risk_level': (scenario.get('quality') or {}).get('risk_level', '')
                if isinstance(scenario.get('quality'), dict)
                else '',
                'source_classification': source_class,
                'validation_status': scenario.get('calculation_status', scenario.get('simulation_status', 'BLOCKED')),
                'warnings': 'aggregate_allowlisted_projection; values require scientific qualification',
            }
            rows.append([row.get(column, '') for column in headers])
    return rows


def projected_profile_rows(evidence: dict[str, object], run_id: str, tax_disabled: bool = False) -> list[list[object]]:
    headers = CSV_HEADERS['04_CENARIOS_E_OTIMIZACAO/tabela_4_5_12_perfis.csv']
    rows: list[list[object]] = []
    companies = evidence.get('companies', {})
    if not isinstance(companies, dict):
        return rows
    for company_id in ('empresa1', 'empresa2'):
        if tax_disabled and company_id != 'empresa1':
            continue
        company = companies.get(company_id)
        if not isinstance(company, dict):
            continue
        optimization = company.get('optimization_tax_disabled' if tax_disabled else 'optimization', {})
        if not isinstance(optimization, dict):
            continue
        for profile_id in ('balanced', 'cfo', 'supply', 'fiscal', 'conservative', 'growth'):
            profile = optimization.get(profile_id)
            if not isinstance(profile, dict):
                continue
            complete = profile.get('search_completeness', {})
            if not isinstance(complete, dict):
                complete = {}
            best = profile.get('best', [])
            winner = best[0] if isinstance(best, list) and best and isinstance(best[0], dict) else {}
            values = {
                'run_id': run_id,
                'company_id': company_id,
                'profile_id': profile_id,
                'profile_label': profile.get('profile_name', profile_id),
                'tax_mode': 'tax_disabled' if tax_disabled else '',
                'tax_year': '',
                'candidate_universe_id': f'{company_id}-declared-catalog',
                'candidate_space_base': as_number(
                    complete.get('base_candidate_space_size') or complete.get('candidate_space_size')
                ),
                'candidate_space_extended': as_number(complete.get('candidate_space_size')),
                'candidates_generated': as_number(complete.get('simulated_candidates')),
                'candidates_simulated': as_number(complete.get('simulated_candidates')),
                'candidates_valid': as_number(complete.get('valid_candidates')),
                'search_complete': bool(complete.get('search_complete', complete.get('exact_search_space', False))),
                'winner_scenario_id': f'{company_id}-{profile_id}-winner' if winner else '',
                'winner_cd_ids': '',
                'winner_cd_count': as_number(winner.get('active_cd_count')),
                'winner_logistics_brl': '',
                'winner_tax_impact_brl': '',
                'winner_total_brl': as_number(winner.get('total_with_tax')),
                'winner_saving_logistics_pct': '',
                'winner_saving_total_pct': as_number(winner.get('saving_pct')),
                'winner_score': as_number(winner.get('score')),
                'winner_risk': winner.get('risk_level', ''),
                'weights_json': json.dumps(profile.get('weights', {}), sort_keys=True),
                'constraints_json': json.dumps(profile.get('constraints', {}), sort_keys=True),
                'winner_changes_vs_balanced': '',
                'methodology_status': 'PARAMETRIC_EXPLORATORY; best only within evaluated candidate catalog',
            }
            rows.append([values.get(column, '') for column in headers])
    return rows


def projected_baseline_rows(
    evidence: dict[str, object], run_id: str, company_filter: str | None = None
) -> list[list[object]]:
    rows: list[list[object]] = []
    companies = evidence.get('companies', {})
    if not isinstance(companies, dict):
        return rows
    components = {
        'transfer_cost': 'transfer',
        'distribution_cost': 'distribution',
        'storage_cost': 'storage',
        'inventory_cost': 'inventory',
        'total_logistics_cost': 'logistics',
        'tax_impact': 'tax_indicator',
        'total_with_tax': 'total_with_tax_indicator',
    }
    for company_id in ('empresa1', 'empresa2'):
        if company_filter and company_id != company_filter:
            continue
        company = companies.get(company_id)
        if not isinstance(company, dict):
            continue
        anchored = company.get('baseline')
        physical = company.get('baseline_physical')
        if not isinstance(anchored, dict) or not isinstance(physical, dict):
            continue
        anchored_costs = anchored.get('costs', {})
        physical_costs = physical.get('costs', {})
        if not isinstance(anchored_costs, dict) or not isinstance(physical_costs, dict):
            continue
        for field, label in components.items():
            anchor_value = as_number(anchored_costs.get(field))
            physical_value = as_number(physical_costs.get(field))
            delta = (
                float(physical_value) - float(anchor_value)
                if isinstance(physical_value, (int, float)) and isinstance(anchor_value, (int, float))
                else ''
            )
            status = 'RECONCILED_COMPONENT_VALUES' if delta != '' else 'BLOCKED_COMPONENT_UNAVAILABLE'
            row = [
                run_id,
                company_id,
                label,
                anchor_value,
                physical_value,
                delta,
                'ANCHORED_REFERENCE',
                physical.get('source_class', 'PARAMETRIC_EXPLORATORY'),
                status,
                'Anchored preservation and physical unanchored calculation are distinct methods; delta is not validation.',
            ]
            rows.append(row)
    return rows


def projected_monte_carlo_rows(evidence: dict[str, object], run_id: str) -> list[list[object]]:
    rows: list[list[object]] = []
    companies = evidence.get('companies', {})
    if not isinstance(companies, dict):
        return rows
    for company_id in ('empresa1', 'empresa2'):
        company = companies.get(company_id)
        if not isinstance(company, dict):
            continue
        battery = company.get('monte_carlo_battery', [])
        if not isinstance(battery, list):
            continue
        scenario_names = {
            'baseline_self': 'baseline_self',
            'exclusion_a': 'exclusion_a',
            'exclusion_b': 'exclusion_b',
            'inventory_minus_10_days': 'inventory_minus_10_days',
            'freight_plus_10_percent': 'freight_plus_10_percent',
            'single_cd_serra': 'single_cd_selected',
            'single_cd_es': 'single_cd_es',
            'single_cd_es_2033': 'single_cd_es_2033',
        }
        for entry in battery:
            if not isinstance(entry, dict):
                continue
            input_key = entry.get('scenario_key')
            scenario_key = scenario_names.get(input_key) if isinstance(input_key, str) else None
            if not scenario_key:
                continue
            pairing = entry.get('pairing', {})
            pairing_status = pairing.get('status') if isinstance(pairing, dict) else None
            paired = (
                isinstance(pairing, dict)
                and pairing_status == 'paired'
                and pairing.get('method') == 'common_random_numbers_v1'
                and pairing.get('baseline_mode') == 'physical_unanchored'
            )
            if not paired:
                continue
            summary = entry.get('summary', {})
            if not isinstance(summary, dict) or entry.get('monte_carlo_status') != 'success':
                continue
            valid_iterations = as_number(entry.get('iterations_valid', summary.get('iterations_valid')))
            if not isinstance(valid_iterations, (int, float)) or valid_iterations <= 0:
                continue
            rng = entry.get('rng', {})
            rng = rng if isinstance(rng, dict) else {}
            config = entry.get('config', {})
            config = config if isinstance(config, dict) else {}
            values = {
                'run_id': run_id,
                'company_id': company_id,
                'scenario_id': f'{company_id}-{scenario_key}',
                'baseline_scenario_id': f'{company_id}-baseline_physical_2033'
                if entry.get('tax_year') == 2033
                else f'{company_id}-baseline_physical_current',
                'tax_year': entry.get('tax_year') if entry.get('tax_year') in range(2025, 2034) else '',
                'tax_mode': entry.get('tax_mode')
                if entry.get('tax_mode')
                in {
                    'current',
                    'disabled',
                    'reform_2026',
                    'reform_2027_2028',
                    'transition_2029',
                    'transition_2030',
                    'transition_2031',
                    'transition_2032',
                    'reform_full_2033',
                    'reform_2027',
                    'reform_2028',
                    'reform_2029',
                    'reform_2030',
                    'reform_2031',
                    'reform_2032',
                    'reform_2033',
                }
                else '',
                'profile': entry.get('profile')
                if entry.get('profile') in {'conservative', 'balanced', 'broad'}
                else '',
                'seed': as_number(entry.get('seed')),
                'seed_effective': as_number(
                    summary.get(
                        'seed_effective',
                        entry.get('seed_effective', rng.get('seed_effective', config.get('seed_effective'))),
                    )
                ),
                'rng_algorithm': 'mulberry32-v1' if summary.get('rng_algorithm') == 'mulberry32-v1' else '',
                'iterations_requested': as_number(entry.get('iterations_requested')),
                'iterations_valid': as_number(entry.get('iterations_valid', summary.get('iterations_valid'))),
                'iterations_invalid': as_number(
                    entry.get(
                        'iterations_invalid', summary.get('iterations_invalid', summary.get('invalid_sample_count'))
                    )
                ),
                'sampling_source': summary.get('uncertainty_source')
                if summary.get('uncertainty_source')
                in {'parametric_assumptions', 'empirical_historical', 'hybrid_empirical_parametric'}
                else '',
                'baseline_shock_mode': 'physical_unanchored'
                if pairing.get('baseline_mode') == 'physical_unanchored'
                else '',
                'mean_delta_cost_brl': as_number(summary.get('mean_delta_cost_brl')),
                'p10_delta_cost_brl': as_number(summary.get('p10_delta_cost', summary.get('p10_delta_cost_brl'))),
                'p50_delta_cost_brl': as_number(summary.get('p50_delta_cost', summary.get('p50_delta_cost_brl'))),
                'p90_delta_cost_brl': as_number(summary.get('p90_delta_cost', summary.get('p90_delta_cost_brl'))),
                'prob_candidate_cheaper': as_number(
                    summary.get('probability_saving_positive', summary.get('prob_candidate_cheaper'))
                ),
                'prob_tie': as_number(summary.get('probability_tie', summary.get('prob_tie'))),
                'mc_standard_error': as_number(
                    summary.get('monte_carlo_probability_positive_standard_error', summary.get('mc_standard_error'))
                ),
                'paired_method': 'common_random_numbers_v1'
                if pairing.get('method') == 'common_random_numbers_v1'
                else '',
                'robustness_score': as_number(entry.get('robustness_score')),
                'robustness_policy': '',
                'data_quality_status': entry.get('data_quality_status')
                if entry.get('data_quality_status') in {'complete', 'limited_fiscal_coverage'}
                else '',
                'model_validity_note': 'Paired sensitivity conditional on the registered distributions and model.',
            }
            rows.append(
                [values.get(column, '') for column in CSV_HEADERS['05_MONTE_CARLO/monte_carlo_paired_summary.csv']]
            )
    return rows


def traceable_critique_matrix(evidence: dict[str, object], run_id: str) -> bytes:
    path = '01_AUDITORIA/MATRIZ_CRITICAS_C01_C15.csv'
    headers = CSV_HEADERS[path]
    rows = [dict(zip(headers, row, strict=True)) for row in CSV_ROWS[path]]
    profiles = projected_profile_rows(evidence, run_id)
    baseline = [row for row in projected_baseline_rows(evidence, run_id, 'empresa1') if row[3] != '' and row[4] != '']
    paired = projected_monte_carlo_rows(evidence, run_id)
    for row in rows:
        issue = row['issue_id']
        if issue == 'C02' and profiles:
            row.update(
                status='WARN',
                root_cause='Aggregate optimizer profiles projected from the traceable run; coverage and scientific interpretation require review.',
                input_dependency='review profile coverage and comparable methods',
                tests_passed='',
                tests_failed='',
                numeric_impact=f'{len(profiles)} profile rows projected; consult search completeness.',
                limitations='Best only within evaluated catalog; projection does not establish test or scientific validation.',
            )
        elif issue == 'C03' and projection_content('03_TRIBUTACAO/2033_scenario_comparison.csv', evidence, run_id):
            row.update(
                root_cause='Matched 2033 exploratory scenario values are projected; the historical 3.71 percent source remains untraced.',
                input_dependency='trace the cited percentage to its source and obtain fiscal review',
                numeric_impact='2033 matched scenario values available as exploratory projections; historical percentage unverified.',
                limitations='Fiscal parameters are not professionally validated; projected outputs are not company forecasts.',
            )
        elif issue == 'C10' and baseline:
            row.update(
                status='WARN',
                root_cause='Anchored and unanchored baseline component values are projected separately from the traceable run.',
                input_dependency='audit component methods, units and independent calibration',
                tests_passed='',
                tests_failed='',
                numeric_impact=f'{len(baseline)} components have both values projected.',
                limitations='A difference from the anchor is not an independent validation of physical costs.',
            )
        elif issue == 'C12' and paired:
            row.update(
                status='WARN',
                root_cause='Eligible paired Monte Carlo entries are projected from the traceable run.',
                input_dependency='review pairing, conditional assumptions and self-comparison tests',
                tests_passed='',
                tests_failed='',
                numeric_impact=f'{len(paired)} paired entries projected.',
                limitations='Projection does not establish test results, empirical probabilities, or model validity.',
            )
    return csv_text(headers, [[row.get(column, '') for column in headers] for row in rows]).encode()


def traceable_readme(evidence: dict[str, object], run_id: str) -> bytes:
    company_data = evidence.get('companies', {})
    company_data = company_data if isinstance(company_data, dict) else {}
    profile_count = sum(
        len(company.get('optimization', {}))
        for company in company_data.values()
        if isinstance(company, dict) and isinstance(company.get('optimization'), dict)
    )
    mc_count = len(projected_monte_carlo_rows(evidence, run_id))
    scientific_status = evidence.get('scientific_status', 'BLOCKED_FOR_FINAL_NUMERICAL_CLAIMS')
    content = f"""# Handoff de auditoria — leitura inicial

**Estado científico:** `{scientific_status}`. O pacote foi gerado a partir de uma execução rastreável (`run_id={run_id}`) e inclui projeções agregadas allowlisted. A presença de números reproduzíveis não elimina bloqueios metodológicos ou de validação externa.

## Conteúdo numérico gerado

- Resumo agregado por cenário: `04_CENARIOS_E_OTIMIZACAO/scenario_summary_all.csv`.
- Baselines ancorados e, quando disponíveis, físicos não ancorados: tabelas em `02_BASELINE_E_DADOS/`.
- Perfis encontrados no input: {profile_count}; winners permanecem condicionais ao universo declarado.
- Casos Monte Carlo pareados aptos à projeção: {mc_count}; itens sem prova de pareamento foram omitidos e registrados como bloqueados.
- WACC da fonte: valor omitido; unidade e periodicidade permanecem bloqueadas.

## Achados que afetam a redação

1. Custo de estoque E1 usa receita mensal × WACC como aproximação, não estoque físico observado.
2. Transferência E1 continua exploratória até provar trecho físico fornecedor/fábrica→CD e unidade da tarifa.
3. Indicadores fiscais têm limites de cobertura; não equivalem a economia líquida nem previsão tributária.
4. Baseline ancorado é referência, não validação independente; a saída física não ancorada é separada.
5. Divergência fiscal E2 permanece bloqueada enquanto a ponte por operação não reconciliar o resíduo.
6. Workbook e simulador são comparáveis somente com alocação, período e escopo iguais; Cenário N requer matriz fluxo–CD.
7. Resultados do otimizador significam melhor candidato no catálogo avaliado; cobertura incompleta impede “ótimo global”.
8. Refinamentos só de subconjuntos CD estão dentro do espaço combinatório teórico; dimensões externas são reportadas à parte.
9. Monte Carlo é sensibilidade condicional às distribuições e ao acoplamento de choques, não probabilidade empírica.
10. Capacidade, SLA, implantação, autorizações de marca e revisão documental continuam condicionantes externos.

## Reprodução e limites

O `run_id`, commit e critérios de elegibilidade estão em `00_MANIFESTO/run_manifest.json`. Hashes de fontes empresariais foram omitidos. CSVs sem origem autorizada e execução rastreável permanecem explicitamente `BLOCKED`; valores indisponíveis ficam vazios. O DOCX não foi inspecionado parágrafo a parágrafo.

Validação independente: `python scripts/audit/validate_tcc_handoff.py <caminho.zip>`.
"""
    return content.encode()


def traceable_status(evidence: dict[str, object], run_id: str) -> bytes:
    companies = evidence.get('companies', {})
    companies = companies if isinstance(companies, dict) else {}
    e1 = companies.get('empresa1', {})
    e2 = companies.get('empresa2', {})
    e1_baseline = e1.get('baseline', {}) if isinstance(e1, dict) else {}
    e1_physical = e1.get('baseline_physical', {}) if isinstance(e1, dict) else {}
    e2_recon = e2.get('reconciliation', {}) if isinstance(e2, dict) else {}
    e2_one_cd = e2.get('empresa2_one_cd_es', {}) if isinstance(e2, dict) else {}
    monte_carlo_count = len(projected_monte_carlo_rows(evidence, run_id))
    statuses = [
        ('Tributo E1 sem âncora', 'BLOCKED: saída fiscal comparável e causalmente reconciliada não demonstrada.'),
        ('WACC E1', 'Campo em fonte protegida; valor omitido. Unidade e periodicidade continuam BLOCKED.'),
        ('Transferência E1', 'PARAMETRIC_EXPLORATORY até provar trecho fornecedor–CD e unidade compatível.'),
        (
            'E2 1 CD ES',
            f'{"PRESENTE, verificar status da fonte" if e2_one_cd else "BLOCKED: objeto comparável não consta do manifesto."}',
        ),
        (
            'Diferença tributária E2',
            f'{"Consultar reconciliation e status" if e2_recon else "BLOCKED: reconciliação por operação ausente."}',
        ),
        ('Perfis e busca', 'Consultar tabela 4.5 e coverage JSON; resultados são limitados ao catálogo declarado.'),
        (
            '32.782',
            'A contagem histórica foi compatível com variantes novas ao catálogo ainda dentro do domínio teórico; IDs históricos ausentes.',
        ),
        ('2033', 'Consultar outputs da mesma execução; hipótese paramétrica exige validação tributária externa.'),
        ('3,71%', 'BLOCKED até rastrear a fórmula e sua célula/fonte no mapa de proveniência.'),
        (
            'Monte Carlo',
            f'{monte_carlo_count} casos pareados qualificados para projeção; qualquer outro caso segue BLOCKED.',
        ),
        (
            'Origem 16 e contagens ETL',
            'BLOCKED se o lineage agregado não identificar tipo e regra de contagem; códigos e rotas não são exportados.',
        ),
        ('Site, marca e reunião', 'BLOCKED sem URL verificada, autorização escrita e evidência documental de reunião.'),
        (
            'Números no TCC',
            'Usar apenas projeções agregadas com status/fonte/run_id e limitações; nenhuma autorização científica é implícita.',
        ),
    ]
    table = '| Pergunta | Resposta/estado |\n|---|---|\n' + ''.join(
        f'| {question} | {answer} |\n' for question, answer in statuses
    )
    content = (
        '# Status final\n\n'
        f'Veredito: `{evidence.get("scientific_status", "BLOCKED_FOR_FINAL_NUMERICAL_CLAIMS")}`. '
        f'Execução rastreável: `{run_id}`; commit `{evidence.get("commit_final")}`. '
        'As métricas agregadas projetadas não substituem validação científica.\n\n'
        + table
        + '\n'
        + f'Baseline E1 source class: `{e1_baseline.get("calculation_method", "not recorded") if isinstance(e1_baseline, dict) else "not recorded"}`. '
        + f'Baseline físico E1: `{"present" if isinstance(e1_physical, dict) else "BLOCKED_SOURCE"}`. WACC value remains withheld.\n\n'
        + 'Consulte o file registry para todos os bloqueios e seus efeitos no TCC.\n'
    )
    return content.encode()


def projection_content(path: str, evidence: dict[str, object], run_id: str) -> bytes | None:
    if path in (
        '03_TRIBUTACAO/tax_2033_sensitivity.csv',
        '03_TRIBUTACAO/2033_scenario_comparison.csv',
        '03_TRIBUTACAO/2033_tax_breakdown.csv',
    ):
        companies = evidence.get('companies', {})
        e2 = companies.get('empresa2', {}) if isinstance(companies, dict) else {}
        one_cd = e2.get('empresa2_one_cd_es', {}) if isinstance(e2, dict) else {}
        sensitivity = one_cd.get('tax_2033_sensitivity', []) if isinstance(one_cd, dict) else []
        headers = [
            'run_id',
            'scenario',
            'assumption',
            'tax_year',
            'tax_regime',
            'logistics_brl',
            'cbs_brl',
            'ibs_brl',
            'selective_tax_brl',
            'credits_brl',
            'current_tax_brl',
            'tax_impact_brl',
            'total_with_tax_brl',
            'source_class',
            'fiscal_validation',
            'limitation',
        ]
        grouped = {}
        for entry in sensitivity if isinstance(sensitivity, list) else []:
            if (
                not isinstance(entry, dict)
                or entry.get('scenario') not in ('baseline', 'candidate')
                or entry.get('assumption') not in ('configured_selective_tax', 'no_selective_tax')
                or entry.get('tax_year') != 2033
                or entry.get('tax_regime') != 'reform_full_2033'
            ):
                continue
            grouped.setdefault(entry['assumption'], {}).setdefault(entry['scenario'], []).append(entry)
        rows = []
        for assumption in ('configured_selective_tax', 'no_selective_tax'):
            if path != '03_TRIBUTACAO/tax_2033_sensitivity.csv' and assumption != 'configured_selective_tax':
                continue
            scenarios = grouped.get(assumption, {})
            if any(len(scenarios.get(name, [])) != 1 for name in ('baseline', 'candidate')):
                continue
            pair = [scenarios[name][0] for name in ('baseline', 'candidate')]
            required = ['logistics_brl', 'tax_impact_brl', 'total_with_tax_brl']
            if path.endswith('2033_tax_breakdown.csv'):
                required += ['cbs_brl', 'ibs_brl', 'selective_tax_brl', 'credits_brl']
            if any(
                item.get('simulation_status') != 'success' or any(as_number(item.get(key)) == '' for key in required)
                for item in pair
            ):
                continue
            for entry in pair:
                rows.append(
                    [
                        run_id,
                        entry['scenario'],
                        entry['assumption'],
                        2033,
                        'reform_full_2033',
                        *[as_number(entry.get(key)) for key in headers[5:13]],
                        'PARAMETRIC_EXPLORATORY',
                        'PENDING',
                        'IS zero is a global counterfactual, not proof of non-incidence; credits are model proxies.',
                    ]
                )
        return csv_text(headers, rows).encode() if rows else None

    if path in ('03_TRIBUTACAO/fiscal_config_runtime.json', '03_TRIBUTACAO/tax_config_diff.json'):
        fiscal = evidence.get('fiscal_config_runtime')
        if not isinstance(fiscal, dict):
            return None
        regimes = {
            'current',
            'disabled',
            'reform_2026',
            'reform_2027_2028',
            'transition_2029',
            'transition_2030',
            'transition_2031',
            'transition_2032',
            'reform_full_2033',
        }
        categories = {'default_goods', 'essential_goods', 'services', 'selective_goods'}
        fields = {'year', 'current_weight', 'ibs_weight', 'cbs_rate', 'ibs_rate', 'selective_rate', 'credit_rate'}
        category_fields = {'cbs_rate_multiplier', 'ibs_rate_multiplier', 'selective_rate_multiplier', 'credit_rate'}

        def sanitize_snapshot(snapshot: object) -> dict[str, object]:
            source = snapshot.get('regimes', {}) if isinstance(snapshot, dict) else {}
            result = {}
            if not isinstance(source, dict):
                return result
            for regime in sorted(regimes & source.keys()):
                data = source[regime]
                if not isinstance(data, dict):
                    continue
                entry = {
                    key: as_number(data[key]) for key in sorted(fields & data.keys()) if as_number(data[key]) != ''
                }
                rules = data.get('category_rules', {})
                if isinstance(rules, dict):
                    entry['category_rules'] = {
                        category: {
                            key: as_number(rule[key])
                            for key in sorted(category_fields & rule.keys())
                            if as_number(rule[key]) != ''
                        }
                        for category in sorted(categories & rules.keys())
                        if isinstance((rule := rules[category]), dict)
                    }
                result[regime] = entry
            return {'regimes': result}

        defaults = sanitize_snapshot(fiscal.get('default_js'))
        active = sanitize_snapshot(fiscal.get('active'))
        result = {
            'run_id': run_id,
            'status': 'PARAMETRIC_EXPLORATORY_NOT_LEGAL_VALIDATION',
            'fiscal_validation': 'PENDING',
            'active_source': 'data/tax/tax_reform_config.json_normalized',
            'default_js': defaults,
            'active': active,
            'note': 'Parameters are model assumptions, not observed enterprise tax rates.',
        }
        if path.endswith('tax_config_diff.json'):
            result['note'] += ' Compare default_js with active to audit differences.'
        return (json.dumps(result, indent=2, sort_keys=True, allow_nan=False) + '\n').encode()

    if path == '04_CENARIOS_E_OTIMIZACAO/scenario_summary_all.csv':
        return csv_text(CSV_HEADERS[path], projected_scenario_rows(evidence, run_id)).encode()
    if path == '01_AUDITORIA/MATRIZ_CRITICAS_C01_C15.csv':
        return traceable_critique_matrix(evidence, run_id)
    if path == '04_CENARIOS_E_OTIMIZACAO/tabela_4_5_12_perfis.csv':
        return csv_text(CSV_HEADERS[path], projected_profile_rows(evidence, run_id)).encode()
    if path == '04_CENARIOS_E_OTIMIZACAO/tabela_4_5_e1_sem_tributo.csv':
        rows = projected_profile_rows(evidence, run_id, tax_disabled=True)
        return (
            csv_text(CSV_HEADERS['04_CENARIOS_E_OTIMIZACAO/tabela_4_5_12_perfis.csv'], rows).encode() if rows else None
        )
    if path in (
        '02_BASELINE_E_DADOS/baseline_anchored_vs_unanchored.csv',
        '02_BASELINE_E_DADOS/tabela_4_2_baseline_reconciliation.csv',
        '02_BASELINE_E_DADOS/e1_baseline_decomposition.csv',
    ):
        if path.endswith('e1_baseline_decomposition.csv'):
            rows = projected_baseline_rows(evidence, run_id, 'empresa1')
        else:
            rows = projected_baseline_rows(evidence, run_id)
        if not rows:
            return None
        if path.endswith('baseline_anchored_vs_unanchored.csv'):
            rows = [row[:6] + row[6:9] + [row[9]] for row in rows]
        elif path.endswith('e1_baseline_decomposition.csv'):
            rows = [row[:6] + row[8:9] + row[7:8] for row in rows if row[1] == 'empresa1']
        else:
            rows = [row[:6] + row[8:9] + row[7:8] for row in rows]
        return csv_text(CSV_HEADERS[path], rows).encode()
    if path == '04_CENARIOS_E_OTIMIZACAO/optimizer_search_coverage.json':
        companies = evidence.get('companies', {})
        summary: dict[str, object] = {'run_id': run_id, 'status': 'PARAMETRIC_EXPLORATORY', 'companies': {}}
        if isinstance(companies, dict):
            for company_id in ('empresa1', 'empresa2'):
                company = companies.get(company_id)
                profiles = company.get('optimization', {}) if isinstance(company, dict) else {}
                if not isinstance(profiles, dict):
                    continue
                summary['companies'][company_id] = {}
                for profile_id, profile in profiles.items():
                    if not isinstance(profile, dict):
                        continue
                    coverage = profile.get('search_completeness', {})
                    if isinstance(coverage, dict):
                        summary['companies'][company_id][profile_id] = {
                            key: coverage.get(key)
                            for key in (
                                'candidate_space_size',
                                'base_candidate_space_size',
                                'simulated_candidates',
                                'valid_candidates',
                                'invalid_candidates',
                                'coverage_ratio',
                                'search_complete',
                                'exact_search_space',
                                'completeness_reason',
                            )
                        }
        return (json.dumps(summary, indent=2, sort_keys=True) + '\n').encode()
    if path == '05_MONTE_CARLO/monte_carlo_paired_summary.csv':
        rows = projected_monte_carlo_rows(evidence, run_id)
        if not rows:
            return None
        return csv_text(CSV_HEADERS[path], rows).encode()
    return None


QA_COMMANDS = {
    'python tests/run_all_tests.py',
    'python tests/run_public_tests.py',
    'npm run test:public',
    'npm run quality:static',
    'npm test',
}


def qa_report_content(path: Path, expected_commit: str) -> bytes:
    """Validate declared QA metadata; no raw log is read or embedded."""
    if path.stat().st_size > 65536:
        raise ValueError('QA report is too large.')
    try:
        payload = json.loads(path.read_text(encoding='utf-8'))
    except (json.JSONDecodeError, UnicodeDecodeError) as error:
        raise ValueError('QA report must be valid UTF-8 JSON.') from error
    if (
        not re.fullmatch(r'[0-9a-f]{40}', expected_commit)
        or not isinstance(payload, dict)
        or payload.get('commit_final') != expected_commit
    ):
        raise ValueError('QA report commit does not match HEAD.')
    suites = payload.get('suites')
    if not isinstance(suites, list) or not 1 <= len(suites) <= len(QA_COMMANDS):
        raise ValueError('QA report must contain one or more allowed suites.')
    rows = []
    commands = set()
    for suite in suites:
        if not isinstance(suite, dict):
            raise ValueError('Invalid QA suite entry.')
        command, status = suite.get('command'), suite.get('status')
        count, digest = suite.get('count'), suite.get('log_sha256')
        if (
            not isinstance(command, str)
            or command not in QA_COMMANDS
            or command in commands
            or status not in ('PASS', 'FAIL', 'ERROR')
            or isinstance(count, bool)
            or not isinstance(count, int)
            or count < 0
            or (status == 'PASS' and count == 0)
            or not isinstance(digest, str)
            or not re.fullmatch(r'[0-9a-f]{64}', digest)
        ):
            raise ValueError('Invalid QA suite command, status, count, or log SHA-256.')
        commands.add(command)
        rows.append(f'| `{command}` | `{status}` | {count} | `{digest}` |')
    report = (
        '# Relatório de testes e QA\n\n'
        f'Commit informado e conferido contra HEAD: `{expected_commit}`.\n\n'
        '| Comando | Estado informado | Quantidade informada | SHA-256 informado do log |\n'
        '|---|---|---:|---|\n' + '\n'.join(rows) + '\n\n'
        'O empacotador valida formato e commit do registro fornecido; não verifica o conteúdo do log '
        'nem comprova por si só que o comando foi executado ou que o hash pertence ao log. '
        'O arquivo de log bruto não é incluído. A quantidade representa itens executados informados, '
        'não a quantidade de asserções. Testes não validam, por si só, premissas científicas ou fiscais.\n'
    )
    return report.encode('utf-8')


def build_package(
    output: Path,
    timestamp: str | None = None,
    evidence_path: Path | None = None,
    reviewer_docx: Path | None = None,
    fiscal_diagnostics: Path | None = None,
    qa_report: Path | None = None,
) -> Path:
    evidence = load_evidence(evidence_path or ROOT / 'entregaveis/evidence.json')
    traceable = evidence_is_traceable(evidence)
    if evidence and not traceable:
        raise ValueError('Evidence is not from the current commit and clean worktree, or lacks required provenance.')
    docx_bytes = reviewer_docx.read_bytes() if reviewer_docx else None
    if docx_bytes is not None:
        from io import BytesIO

        try:
            with zipfile.ZipFile(BytesIO(docx_bytes)) as docx:
                if docx.testzip() or not {'[Content_Types].xml', 'word/document.xml'}.issubset(docx.namelist()):
                    raise ValueError('Reviewer DOCX is not a valid Word package.')
        except zipfile.BadZipFile as error:
            raise ValueError('Reviewer DOCX is not a valid Word package.') from error
    timestamp = timestamp or (str(evidence.get('generated_at')) if traceable and evidence else utc_now())
    date = timestamp[:10].replace('-', '')
    commit = git_value('rev-parse', 'HEAD')
    config_hash = sha256((SCHEMA_VERSION + '\n' + '\n'.join(REQUIRED_FILES)).encode())
    run_id = str(evidence.get('run_id')) if traceable and evidence else f'{date}-{commit[:12]}-{config_hash[:12]}'
    if fiscal_diagnostics and (not traceable or docx_bytes is None):
        raise ValueError('Fiscal diagnostics require traceable evidence and an explicitly private reviewer package.')
    fiscal_projection = project_fiscal_diagnostics(fiscal_diagnostics, run_id) if fiscal_diagnostics else {}
    qa_projection = qa_report_content(qa_report, commit) if qa_report else None
    if traceable and evidence:
        commit = str(evidence.get('commit_final'))
    root_name = f'{PACKAGE_ROOT_PREFIX}{date}_{commit[:12]}'
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        raise FileExistsError(f'Refusing to overwrite existing package: {output}')

    all_paths = sorted(set(REQUIRED_FILES + CONDITIONAL_FILES))
    files: dict[str, bytes] = {}
    registry_rows: list[list[object]] = []
    projection_paths: set[str] = set()
    for relative in all_paths:
        if not safe_relative(relative):
            raise ValueError(f'Unsafe package path: {relative}')
        conditional = relative in CONDITIONAL_FILES
        if conditional:
            if relative.endswith('.docx') and docx_bytes is not None:
                files[relative] = docx_bytes
                registry_rows.append(
                    [
                        relative,
                        'conditional',
                        'true',
                        'AUTHORIZED_PRIVATE_REVIEW',
                        'author_confirmed_source',
                        run_id,
                        'PRIVATE_REVIEWER_ONLY',
                        '',
                        'Source manuscript for private reviewer; comments and tracked changes remain intact.',
                    ]
                )
                continue
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
        projected = fiscal_projection.get(relative) or (
            projection_content(relative, evidence, run_id) if traceable and evidence else None
        )
        if traceable and evidence and relative == 'LEIA_ME_PRIMEIRO.md':
            projected = traceable_readme(evidence, run_id)
        if traceable and evidence and relative == 'STATUS_FINAL.md':
            projected = traceable_status(evidence, run_id)
        if relative == '06_TESTES_E_QA/TEST_REPORT.md' and qa_projection is not None:
            projected = qa_projection
        content = projected if projected is not None else content_for(relative, run_id, timestamp, commit)
        status = (
            'QA_REPORTED'
            if relative == '06_TESTES_E_QA/TEST_REPORT.md' and qa_projection
            else ('PARAMETRIC_EXPLORATORY' if projected is not None else 'BLOCKED_SOURCE')
        )
        if projected is not None:
            projection_paths.add(relative)
        if relative == '11_DOCUMENTOS_TCC/INVENTARIO_DOCUMENTAL.md':
            content = (
                (
                    '# Inventário documental — PRIVATE_REVIEWER_ONLY\n\n'
                    f'- Manuscrito-base autorizado pelo autor: `{reviewer_docx.name}`. A denominação V4 não foi comprovada.\n'
                    '- Cópia integral: `TCC_BASE_PARA_REVISAO.docx`; bytes originais, comentários e alterações controladas preservados.\n'
                    f'- SHA-256: `{sha256(docx_bytes)}`\n'
                    '- A cópia contém conteúdo autoral e pode conter informações pessoais; destinação somente ao revisor autorizado.\n'
                    '- A preservação não significa que os comentários e revisões tenham sido resolvidos.\n'
                    f'- run_id: `{run_id}`\n'
                )
                if docx_bytes is not None and reviewer_docx
                else (
                    '# Inventário documental\n\n'
                    '- `TCC_BASE_PARA_REVISAO.docx`: não incluído (`BLOCKED_AUTHORIZATION`); o plano condiciona a cópia à autorização expressa de redistribuição.\n'
                    '- Nenhum documento fonte, dado empresarial, captura de tela, base criptografada ou segredo foi copiado.\n'
                    f'- run_id: `{run_id}`\n'
                )
            ).encode()
        if relative == '10_TCC_HANDOFF/MAPA_REVISAO_PARAGRAFO_A_PARAGRAFO.csv' and docx_bytes is not None:
            content = manuscript_map(docx_bytes)
        if traceable and relative.endswith('.md'):
            replacements = {
                'A evidência atual não está consolidada após as alterações recentes; conclusões quantitativas dependentes dela permanecem bloqueadas.': 'A execução rastreável está identificada no manifesto; projeções e resultados dependem dos limites e bloqueios registrados por artefato.',
                'Há evidência histórica e inspeções metodológicas úteis, mas nenhuma execução final auditada consolidada pós-alterações foi fornecida neste pacote.': 'Há uma execução rastreável identificada pelo run_id no manifesto. As projeções agregadas permanecem sujeitas a bloqueios metodológicos e validação externa.',
                'Após a execução final, conferir `run_id`, manifests, hashes, status científicos e células numéricas contra o mapa fonte. Até lá, usar os guias editoriais e retirar conclusões quantitativas não suportadas.': 'Conferir `run_id`, manifests, hashes, status científicos e células numéricas contra o mapa fonte. Usar os guias editoriais e retirar conclusões quantitativas não suportadas.',
                'Após execução final, preencher IDs anonimizados, CDs em forma agregada se permitido, score, custos, status fiscal e cobertura; omitir este resultado até o `run_id` e o catálogo estarem sincronizados.': 'Consultar perfis projetados com `run_id`, score, custos e cobertura disponíveis; não inventar valores ausentes nem inferir validação do catálogo.',
                'Não preencher nesta versão valores dependentes de execução final ainda ausente.': 'Usar apenas valores disponíveis na execução rastreável e compatíveis com os bloqueios registrados.',
                'A execução final auditada e a revisão documental continuam pendentes.': 'A validação científica e a revisão documental integral continuam pendentes, apesar da execução rastreável.',
                'Não há ainda execução final auditada consolidada pós-alterações; permanecem sem prova a causa da divergência tributária, a decomposição final de cenários, a calibração da transferência, os valores em 2033 e os vencedores finais dos perfis. Atribuição causal fica bloqueada onde faltam dados de origem.': 'A execução rastreável fornece projeções agregadas quando os respectivos arquivos estão disponíveis. Permanecem sem comprovação a causa da divergência tributária, a calibração física da transferência e a validade externa de cenários e perfis. Atribuição causal fica bloqueada onde faltam dados de origem.',
                'A execução final pós-alterações ainda não foi consolidada; por isso não há valores novos atribuídos nem diferenças numéricas calculadas neste documento.': 'Este documento é metodológico e não calcula diferenças históricas; consulte as projeções agregadas e seus estados no registro de arquivos.',
                'Mudanças metodológicas relevantes já identificadas para rastrear na próxima execução:': 'Mudanças metodológicas relevantes a conferir nos artefatos da execução rastreável:',
                'As tabelas numéricas permanecem bloqueadas até a geração pós-alterações com `run_id` e hashes. Não transcrever tabelas antigas do TCC para preencher o handoff.': 'Há projeções quando indicadas no registro de arquivos; a publicação de conclusões finais permanece bloqueada por limitações metodológicas e validação externa. Não preencher lacunas com tabelas antigas.',
                '| 4.2 Baseline | BLOCKED | Reconciliar ancorado vs não ancorado e decomposição por componente. |': '| 4.2 Baseline | CONSULTAR REGISTRO | Conferir projeções ancoradas vs não ancoradas e limitações por componente. |',
                '| 4.3 E1 | BLOCKED | Reexecutar cenários e rebaixar custo de transferência/tributo não validados. |': '| 4.3 E1 | CONSULTAR REGISTRO | Conferir cenários disponíveis e qualificar transferência e tributo não validados. |',
                '| 4.5 Perfis | BLOCKED | Gerar 12 linhas; E1 sem tributo separada; registrar cobertura e busca. |': '| 4.5 Perfis | CONSULTAR REGISTRO | Verificar linhas disponíveis, E1 sem tributo, cobertura e busca. |',
                '- A suíte integrada pós-alterações e a execução final agregada devem ser anexadas pelo orquestrador.': '- A execução rastreável consta no manifesto; conferir o relatório de testes efetivamente anexado antes de afirmar sua aprovação.',
                'A nova execução deve parear cada amostra:': 'A comparação pareada deve usar para cada amostra:',
                'Cada bloqueio exige a fonte indicada, execução com `run_id` comum e atualização dos artefatos dependentes.': 'Cada bloqueio exige a fonte ou validação indicada e a conferência dos artefatos dependentes sob o mesmo `run_id`.',
            }
            for before, after in replacements.items():
                content = content.replace(before.encode(), after.encode())
            if relative == '10_TCC_HANDOFF/RESUMO_EXECUTIVO_PARA_REVISOR.md':
                has_2033 = projection_content('03_TRIBUTACAO/2033_scenario_comparison.csv', evidence, run_id)
                note = (
                    'A comparação física de 2033 está disponível como cenário paramétrico; não demonstra incidência fiscal nem economia empresarial. Confira `03_TRIBUTACAO/2033_scenario_comparison.csv` e o registro de arquivos.'
                    if has_2033
                    else 'A comparação pareada de 2033 permanece bloqueada neste pacote; confira o registro de arquivos para a causa.'
                )
                content += f'\n\n## Cenário 2033\n\n{note}\n'.encode()
        if docx_bytes is not None and relative.endswith('.md'):
            content = (
                content.replace(
                    b'- **Documento TCC:** acesso ao DOCX autorizado para invent\xc3\xa1rio editorial; at\xc3\xa9 l\xc3\xa1, o invent\xc3\xa1rio par\xc3\xa1grafo a par\xc3\xa1grafo est\xc3\xa1 bloqueado.',
                    'O autor confirmou o manuscrito-base incluído; a revisão humana integral dos parágrafos e comentários ainda é necessária.'.encode(),
                )
                .replace(
                    '- Inventário do DOCX V4 permanece `BLOCKED_SOURCE_DOCX`; não houve revisão parágrafo a parágrafo neste ambiente.'.encode(),
                    '- Manuscrito-base confirmado incluído; não houve revisão integral parágrafo a parágrafo neste ambiente.'.encode(),
                )
                .replace(
                    '7. É possível fornecer o DOCX V4 para inventário de comentários, sobreposições, tabelas e referências?'.encode(),
                    '7. Confirmar resolução dos comentários e alterações controladas no manuscrito-base autorizado.'.encode(),
                )
                .replace(
                    '- DOCX V4 e pareceres anteriores autorizados para inventário editorial.'.encode(),
                    '- Pareceres anteriores autorizados para completar o inventário editorial; manuscrito-base incluído.'.encode(),
                )
            )
        if relative == 'LEIA_ME_PRIMEIRO.md' and not traceable:
            content = (
                '# Handoff de auditoria — leitura inicial\n\n'
                '**Veredito:** `BLOCKED_FOR_FINAL_NUMERICAL_CLAIMS`. Este pacote reúne diagnósticos metodológicos e bloqueios acionáveis; não apresenta resultado final como validado.\n\n'
                '## Achados que afetam a redação\n\n'
                '1. O custo de estoque E1 é aproximado por receita mensal × WACC; a periodicidade e autorização para divulgar a taxa não estão resolvidas.\n'
                '2. Transferência E1 usa proxy sem rota física e unidade comprovadas; não tratar como custo histórico calibrado.\n'
                '3. A cobertura fiscal é limitada e não sustenta economia tributária líquida ou projeção empresarial.\n'
                '4. Baselines ancorados preservam referência, mas não demonstram acurácia independente.\n'
                '5. A divergência fiscal E2 carece de ponte por operação; manter definições distintas.\n'
                '6. Workbook E2 e cenário do simulador não são comparáveis sem alocação equivalente; Cenário N segue bloqueado sem matriz fluxo–CD.\n'
                '7. O catálogo do otimizador é parcial para E1; corrigir denominador não transforma busca parcial em ótima global.\n'
                '8. Refinamentos de subconjuntos CD já pertencem ao espaço teórico; somente dimensões externas ampliam o espaço contado.\n'
                '9. Monte Carlo legado contra baseline nominal não representa probabilidade pareada de economia; usar apenas após nova execução acoplada.\n'
                '10. Capacidade, SLA, implantação, autorização de marca e revisão documental permanecem sem prova.\n\n'
                '## Como usar\n\n'
                'Os guias nos diretórios 08 e 10 orientam as mudanças textuais e as matrizes 01 e 10 registram status por crítica e conclusão. Arquivos numéricos sem fonte/execução consolidada permanecem `BLOCKED`; não preencher lacunas com zero nem copiar valores antigos como resultados novos. O documento Word não foi revisado parágrafo a parágrafo.\n\n'
                f'- run_id do pacote: `{run_id}`\n'
                '- Reprodução do empacotamento: `python scripts/audit/build_tcc_handoff.py --output <caminho.zip>`; validação: `python scripts/audit/validate_tcc_handoff.py <caminho.zip>`.\n'
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
        if relative == 'STATUS_FINAL.md' and not traceable:
            content = (
                '# Status final\n\n'
                'Veredito: `BLOCKED_FOR_FINAL_NUMERICAL_CLAIMS`. Há execução e evidência anterior no ambiente, mas não foi fornecida uma execução final consolidada e auditada após as últimas alterações.\n\n'
                '| Pergunta | Estado / resposta verificável | Efeito no TCC |\n|---|---|---|\n'
                '| Tributo E1 sem âncora | BLOCKED: a causa do valor histórico não foi reproduzida e reconciliada por operação. | Não atribuir mudança a CDs. |\n'
                '| WACC E1 | Campo identificado em fonte protegida; valor omitido. Unidade e periodicidade BLOCKED. | Não publicar número ou custo de estoque dependente. |\n'
                '| Transferência E1 | Proxy; rota fornecedor–CD e unidade compatível não demonstradas. | Não tratar como custo observado. |\n'
                '| E2 1 CD ES | Workbook e regra do simulador não foram provados equivalentes. | Manter referência workbook separada. |\n'
                '| Diferença tributária E2 | Não reconciliada por operação; causa permanece `UNEXPLAINED`. | Não forçar paridade. |\n'
                '| Perfis e vencedores | Sem execução final consolidada; busca E1 parcial. | Não publicar vencedores finais nem ótimo global. |\n'
                '| Espaço 32.782 | A evidência histórica é compatível com contar 15 refinamentos novos ao catálogo, embora subconjuntos CD estejam dentro dos 32.767 teóricos. IDs históricos não foram preservados. | Usar semântica corrigida e aguardar rerun. |\n'
                '| 2033 | Sem comparação final em mesma configuração e sem revisão fiscal especializada. | Não chamar previsão. |\n'
                '| 3,71% | Origem e fórmula não demonstradas no pacote atual. | Remover até rastrear. |\n'
                '| Monte Carlo | Evidência legada não representa choque pareado validado; execução final pendente. | Retirar probabilidade real de economia. |\n'
                '| Origem 16 e contagens ETL | Não identificadas/reconciliadas com prova rastreável neste pacote. | Não inferir tipo físico. |\n'
                '| Site, marca e reunião | URL, autorização de marca e data de reunião não foram verificadas documentalmente aqui. | Usar nomes genéricos; não afirmar reunião. |\n'
                '| Números utilizáveis | Somente os marcados `OBSERVED_SOURCE`/`REPRODUCED_MODEL` com run_id e proveniência no pacote final. | Nenhum número bloqueado é liberado por este relatório. |\n\n'
                'Ausências estão registradas como bloqueios. A estrutura foi validada separadamente da prontidão científica.\n'
            ).encode()
        files[relative] = content
        editorial_outputs = {
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
        }
        produced = (
            relative in EDITORIAL_DOCS
            or relative in CSV_ROWS
            or relative in editorial_outputs
            or relative in projection_paths
        )
        registry_rows.append(
            [
                relative,
                'conditional' if conditional else 'required',
                'true' if produced else 'false',
                status,
                'allowlisted_evidence_projection'
                if relative in projection_paths
                else 'generated_editorial_or_blocker'
                if produced
                else 'unavailable_source_or_final_run',
                run_id,
                'PRIVATE_REVIEWER_ONLY' if relative in fiscal_projection else 'public_status_only',
                (
                    'The aggregate projection is present but scientific gates remain blocked.'
                    if relative in projection_paths
                    else 'The explanatory report exists, but the numerical or external evidence it describes is still blocked.'
                    if produced
                    else 'Final audited output is unavailable; this placeholder only records the blocked requirement.'
                    if status != 'BLOCKED_AUTHORIZATION'
                    else 'Explicit redistribution authorization/source document unavailable.'
                ),
                'Do not use as quantitative evidence; produce from a traceable authorized run.',
            ]
        )

    if traceable and evidence:
        manifest_path = '00_MANIFESTO/run_manifest.json'
        run_manifest = json.loads(files[manifest_path])
        run_manifest.update(
            {
                'schema_version': 'tcc-audit-evidence-1.0',
                'run_id': run_id,
                'run_key_withheld': True,
                'created_at_utc': timestamp,
                'model_commit_initial': evidence.get('commit_initial') or evidence.get('commit_final'),
                'model_commit_final': evidence.get('commit_final'),
                'dirty_worktree': evidence.get('dirty_worktree'),
                'eligibility': evidence.get('eligibility'),
                'scientific_status': evidence.get('scientific_status', 'BLOCKED_FOR_FINAL_NUMERICAL_CLAIMS'),
                'input_hashes': {},
                'input_hashes_withheld': 'Source/data hashes are omitted from the shareable package.',
                'params_hash': None,
                'tax_config_hash': None,
                'scenario_config_hash': None,
                'output_hashes': {},
                'source_class': 'ALLOWLISTED_AGGREGATE_PROJECTION',
                'privacy_classification': 'PRIVATE_REVIEWER_ONLY'
                if docx_bytes
                else 'AGGREGATED_SCENARIO_OUTPUTS_NO_SOURCE_ROWS_OR_LOCATIONS',
                'sharing_authorized': True,
                'contains_real_individual_data': 'UNKNOWN_MANUSCRIPT_NOT_SCANNED' if docx_bytes else False,
                'overall_status': 'BLOCKED_FOR_FINAL_NUMERICAL_CLAIMS',
                'p0_fail_count': None,
                'p0_blocked_count': None,
                'test_status': 'SEE_06_TESTES_E_QA',
                'reproducibility_status': 'TRACEABLE_RUN_METADATA_PRESENT',
                'model_version': evidence.get('model_version'),
                'projection_policy': 'Allowlisted aggregate fields only; WACC and source/config hashes omitted.',
            }
        )
        files[manifest_path] = (json.dumps(run_manifest, indent=2, sort_keys=True) + '\n').encode()
        source_manifest_path = '00_MANIFESTO/input_sources_manifest.json'
        source_manifest = {
            'status': 'ALLOWLISTED_AGGREGATE_PROJECTION',
            'run_id': run_id,
            'source_class': 'protected_local_input_projected_to_aggregates',
            'source_hashes': 'WITHHELD',
            'wacc': {
                'source_field_identified': True,
                'value': None,
                'unit': None,
                'periodicity': None,
                'status': 'BLOCKED_SOURCE_AND_DISCLOSURE',
            },
            'excluded_from_package': [
                'source rows',
                'CD identifiers and locations',
                'routes and coordinates',
                'WACC value',
                'data and source hashes',
                'credentials and encrypted inputs',
            ],
        }
        if docx_bytes is not None:

            def valid_sha256(value: object) -> str | None:
                return (
                    value.lower()
                    if isinstance(value, str) and len(value) == 64 and all(c in '0123456789abcdefABCDEF' for c in value)
                    else None
                )

            run_manifest['run_key'] = valid_sha256(evidence.get('run_key'))
            run_manifest['run_key_withheld'] = False
            run_manifest['input_hashes'] = {
                'combined_input_fingerprint_sha256': valid_sha256(evidence.get('data_hash'))
            }
            run_manifest['tax_config_hash'] = valid_sha256(evidence.get('tax_config_hash'))
            run_manifest['scenario_config_hash'] = valid_sha256(evidence.get('scenario_config_hash'))
            run_manifest['input_hashes_withheld'] = (
                'Individual source hashes and paths are not included; one combined fingerprint is available only in this private package.'
            )
            run_manifest['projection_policy'] = (
                'PRIVATE_REVIEWER_ONLY: allowlisted aggregates and validated combined fingerprints; WACC value and raw inputs omitted.'
            )
            run_manifest['fingerprint_note'] = (
                'Combined SHA-256 fingerprints cover source names and bytes; possession of fingerprints alone does not provide source contents. Missing or malformed values are null.'
            )
            files[manifest_path] = (json.dumps(run_manifest, indent=2, sort_keys=True) + '\n').encode()
            source_manifest['source_hashes'] = (
                'A single combined input fingerprint is in run_manifest.json; individual source fingerprints are omitted.'
            )
            source_manifest['excluded_from_package'].remove('data and source hashes')
            source_manifest['excluded_from_package'].append('individual source hashes and paths')
            source_manifest['fingerprint_scope'] = (
                'Combined input fingerprint covers encrypted manifest and inputs, complements, and tax files; configuration fingerprints cover named model configuration files.'
            )
            source_manifest['fingerprint_access_note'] = (
                'A fingerprint alone does not provide access to source contents.'
            )
            files['LEIA_ME_PRIMEIRO.md'] = files['LEIA_ME_PRIMEIRO.md'].replace(
                b'Hashes de fontes empresariais foram omitidos.',
                'Um fingerprint combinado de entradas está no manifesto privado; hashes individuais das fontes foram omitidos.'.encode(),
            )
        files[source_manifest_path] = (json.dumps(source_manifest, indent=2, sort_keys=True) + '\n').encode()
        env_path = '00_MANIFESTO/environment.json'
        environment = {
            'status': 'PACKAGE_ENVIRONMENT_CAPTURED',
            'python': sys.version.split()[0],
            'platform': sys.platform,
            'model_version': evidence.get('model_version'),
            'run_id': run_id,
            'note': 'This is the handoff environment, not a substitute for the generator environment manifest.',
        }
        files[env_path] = (json.dumps(environment, indent=2, sort_keys=True) + '\n').encode()
        command_path = '00_MANIFESTO/execution_commands.csv'
        files[command_path] = csv_text(
            CSV_HEADERS[command_path],
            [
                [
                    run_id,
                    'canonical_evidence_generation',
                    'node scripts/generate_academic_evidence.mjs',
                    str(ROOT),
                    str(evidence.get('model_version') or 'not recorded'),
                    str(evidence.get('generated_at') or ''),
                    str(evidence.get('generated_at') or ''),
                    '0',
                    'private generator log withheld',
                    str(evidence.get('eligibility') or 'TRACEABLE_EXECUTION'),
                ],
                [
                    run_id,
                    'handoff_packaging',
                    'python scripts/audit/build_tcc_handoff.py --output <zip>',
                    str(ROOT),
                    sys.version.split()[0],
                    timestamp,
                    timestamp,
                    '0',
                    '',
                    'PACKAGED_ALLOWLISTED_PROJECTION',
                ],
            ],
        ).encode()

    if docx_bytes is not None:
        manifest_path = '00_MANIFESTO/run_manifest.json'
        document_manifest = json.loads(files[manifest_path])
        document_manifest.update(
            {
                'privacy_classification': 'PRIVATE_REVIEWER_ONLY',
                'contains_real_individual_data': 'UNKNOWN_MANUSCRIPT_NOT_SCANNED',
                'authorized_manuscript_sha256': sha256(docx_bytes),
                'manuscript_version_label': 'AUTHOR_CONFIRMED_SOURCE_VERSION_NOT_IDENTIFIED_AS_V4',
                'privacy_review_note': 'The original manuscript is copied without internal confidentiality scanning; distribute only to the authorized reviewer.',
            }
        )
        files[manifest_path] = (json.dumps(document_manifest, indent=2, sort_keys=True) + '\n').encode()
        files['LEIA_ME_PRIMEIRO.md'] += (
            b'\n\n**PRIVATE_REVIEWER_ONLY:** Este pacote inclui o manuscrito autorizado intacto; destinar somente ao revisor autorizado. Comentarios e alteracoes controladas podem permanecer pendentes de revisao.\n'
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
        is_docx = name == '11_DOCUMENTOS_TCC/TCC_BASE_PARA_REVISAO.docx'
        manifest_rows.append(
            [
                name,
                sha256(data),
                len(data),
                'authorized_manuscript' if is_docx else 'status_scaffold',
                'author_confirmed_source' if is_docx else 'generated_by_builder',
                'PRIVATE_REVIEWER_ONLY' if is_docx or name in fiscal_projection else 'public_status_only',
            ]
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
    parser.add_argument(
        '--evidence', type=Path, default=ROOT / 'entregaveis/evidence.json', help='Canonical evidence JSON input.'
    )
    parser.add_argument(
        '--reviewer-docx', type=Path, help='Explicitly authorized manuscript for PRIVATE_REVIEWER_ONLY delivery.'
    )
    parser.add_argument(
        '--fiscal-diagnostics-reviewer',
        type=Path,
        help='Reviewed aggregate fiscal diagnostics matching the run, for private reviewer only.',
    )
    parser.add_argument('--qa-report', type=Path, help='Validated summary metadata for suites on the current commit.')
    args = parser.parse_args()
    try:
        result = build_package(
            args.output.resolve(),
            evidence_path=args.evidence.resolve(),
            reviewer_docx=args.reviewer_docx.resolve() if args.reviewer_docx else None,
            fiscal_diagnostics=args.fiscal_diagnostics_reviewer.resolve() if args.fiscal_diagnostics_reviewer else None,
            qa_report=args.qa_report.resolve() if args.qa_report else None,
        )
    except (OSError, ValueError) as error:
        print(f'BUILD_FAILED: {error}', file=sys.stderr)
        return 2
    print(f'PACKAGE_CREATED: {result}')
    print(
        'STATUS: BLOCKED_FOR_FINAL_NUMERICAL_CLAIMS (editorial handoff produced; final numerical evidence remains blocked)'
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

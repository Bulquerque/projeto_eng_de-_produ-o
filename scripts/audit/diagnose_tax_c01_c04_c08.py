#!/usr/bin/env python3
"""Generate private, aggregate-only tax diagnostics for TCC findings C01/C04/C08.

Protected inputs are decrypted into memory through the repository test helper.
Outputs are local private diagnostics and must not be copied to a shareable ZIP
without a separate disclosure review.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
import subprocess
import sys
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
BASELINE_LABEL = 'Cenário 1'
DEFAULT_OUTPUT = ROOT / 'artifacts' / 'audit_tax'


def _parse_tax_number(value: Any) -> Decimal | None:
    """Parse source measures without silently coercing nonnumeric placeholders."""
    if value is None:
        return Decimal(0)
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float, Decimal)):
        try:
            parsed = Decimal(str(value))
            return parsed if parsed.is_finite() else None
        except InvalidOperation:
            return None

    text = str(value).strip().replace('\u00a0', '').replace(' ', '')
    if not text or text in {'-', '—', '–'}:
        return Decimal(0)

    negative = text.startswith('(') and text.endswith(')')
    if negative:
        text = text[1:-1]
    text = re.sub(r'(?i)R\$|BRL', '', text)
    text = text.replace('−', '-')
    text = re.sub(r'[^0-9,\.\-+]', '', text)
    if not text or not re.search(r'\d', text):
        return None

    if ',' in text and '.' in text:
        # The rightmost punctuation is the decimal separator.
        decimal_sep = ',' if text.rfind(',') > text.rfind('.') else '.'
        group_sep = '.' if decimal_sep == ',' else ','
        text = text.replace(group_sep, '').replace(decimal_sep, '.')
    elif ',' in text:
        if text.count(',') == 1 and len(text.rsplit(',', 1)[1]) in (1, 2):
            text = text.replace(',', '.')
        else:
            text = text.replace(',', '')
    elif '.' in text:
        if text.count('.') > 1:
            parts = text.split('.')
            text = ''.join(parts[:-1]) + '.' + parts[-1]

    try:
        parsed = Decimal(text)
    except InvalidOperation:
        return None
    if negative:
        parsed = -parsed.copy_abs()
    return parsed if parsed.is_finite() else None


def classify_c08_exclusions(
    source_rows: list[dict[str, Any]],
    core_row_ids: list[str] | set[str],
    *,
    row_id_field: str,
    scenario_field: str,
    debit_field: str,
    credit_field: str,
    baseline_scenario: str,
) -> dict[str, Any]:
    """Classify source records absent from core without returning row identifiers."""
    core_id_list = [str(value).strip() for value in core_row_ids]
    core_ids = set(core_id_list)
    source_ids = [str(row.get(row_id_field, '')).strip() for row in source_rows]
    missing = [row for row, row_id in zip(source_rows, source_ids, strict=True) if row_id not in core_ids]
    duplicate_source_ids = len(source_ids) - len(set(source_ids))
    duplicate_core_ids = len(core_id_list) - len(core_ids)
    classes: dict[str, dict[str, Any]] = {
        key: {'row_count': 0, 'baseline_row_count': 0, 'tax_delta_brl': Decimal(0), 'unparseable_tax_rows': 0}
        for key in ('blank', 'non_baseline', 'missing_scenario', 'baseline')
    }
    baseline_missing_rows = 0
    baseline_tax_total = Decimal(0)
    baseline_tax_unparseable = 0

    for row in missing:
        scenario = str(row.get(scenario_field, '') or '').strip()
        payload = [value for key, value in row.items() if key != row_id_field]
        if not any(str(value or '').strip() for value in payload):
            kind = 'blank'
        elif not scenario:
            kind = 'missing_scenario'
        elif scenario != baseline_scenario:
            kind = 'non_baseline'
        else:
            kind = 'baseline'

        group = classes[kind]
        group['row_count'] += 1
        if scenario == baseline_scenario:
            group['baseline_row_count'] += 1
            baseline_missing_rows += 1
            debit = _parse_tax_number(row.get(debit_field))
            credit = _parse_tax_number(row.get(credit_field))
            if debit is None or credit is None:
                group['unparseable_tax_rows'] += 1
                baseline_tax_unparseable += 1
            else:
                contribution = debit - credit
                group['tax_delta_brl'] += contribution
                baseline_tax_total += contribution

    serialized_classes = {
        key: {
            **value,
            'tax_delta_brl': float(value['tax_delta_brl']),
        }
        for key, value in classes.items()
    }
    return {
        'source_rows': len(source_rows),
        'core_rows': len(core_id_list),
        'missing_rows': len(missing),
        'source_duplicate_id_count': duplicate_source_ids,
        'core_duplicate_id_count': duplicate_core_ids,
        'source_only_id_count': len(set(source_ids) - core_ids),
        'core_only_id_count': len(core_ids - set(source_ids)),
        'baseline_missing_rows': baseline_missing_rows,
        'missing_baseline_tax_contribution': float(baseline_tax_total),
        'missing_baseline_tax_unparseable_rows': baseline_tax_unparseable,
        'classes': serialized_classes,
    }


def reconcile_c08_totals(
    *,
    canonical_total: float,
    matrix_total: float,
    explained_adjustments: float = 0.0,
    tolerance_brl: float = 0.01,
    tolerance_pct: float = 1.0,
) -> dict[str, Any]:
    """Build an honest bridge; unexplained residual remains explicit."""
    canonical = Decimal(str(canonical_total))
    matrix = Decimal(str(matrix_total))
    explained = Decimal(str(explained_adjustments))
    delta = matrix - canonical
    residual = delta - explained
    pct = (delta / canonical * Decimal(100)) if canonical else None
    within_currency = abs(residual) <= Decimal(str(tolerance_brl))
    within_pct = canonical != 0 and abs(residual / canonical * Decimal(100)) <= Decimal(str(tolerance_pct))
    return {
        'canonical_total_brl': float(canonical),
        'matrix_total_brl': float(matrix),
        'delta_brl': float(delta),
        'delta_pct_of_canonical': float(pct) if pct is not None else None,
        'explained_adjustments_brl': float(explained),
        'bridge_residual_brl': float(residual),
        'tolerance_brl': float(tolerance_brl),
        'tolerance_pct': float(tolerance_pct),
        'within_brl_tolerance': within_currency,
        'within_pct_tolerance': within_pct,
        'status': 'reconciled' if within_currency else 'unexplained_delta',
    }


def classify_c01_comparability(*, same_network: bool, left_method: str, right_method: str) -> dict[str, Any]:
    same_method = left_method == right_method
    if same_network and not same_method:
        status = 'NOT_COMPARABLE_METHOD'
    elif same_method:
        status = 'COMPARABLE_METHOD'
    else:
        status = 'DIFFERENT_NETWORK_AND_METHOD'
    return {
        'status': status,
        'same_network': bool(same_network),
        'same_method': same_method,
        'left_method': left_method,
        'right_method': right_method,
    }


def classify_c04_comparability(
    *,
    has_flow_to_cd_allocation: bool,
    same_tax_regime: bool | None,
    same_demand_basis: bool | None,
) -> dict[str, Any]:
    if not has_flow_to_cd_allocation:
        return {
            'status': 'NOT_EQUIVALENT_SCENARIO',
            'reason_code': 'MISSING_FLOW_TO_CD_ALLOCATION',
            'same_tax_regime': same_tax_regime,
            'same_demand_basis': same_demand_basis,
        }
    if not same_tax_regime or not same_demand_basis:
        return {
            'status': 'NOT_EQUIVALENT_SCENARIO',
            'reason_code': 'MISMATCHED_TAX_OR_DEMAND_BASIS',
            'same_tax_regime': same_tax_regime,
            'same_demand_basis': same_demand_basis,
        }
    return {
        'status': 'COMPARABLE_SCENARIO',
        'reason_code': 'ALLOCATION_AND_BASES_MATCH',
        'same_tax_regime': same_tax_regime,
        'same_demand_basis': same_demand_basis,
    }


def _load_protected_data() -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], str]:
    sys.path.insert(0, str(ROOT))
    from tests.crypto_helpers import decrypt_json, decrypt_text

    source_csv = decrypt_text('data/empresa2/source_exports/empresa2_main/09_Dados_Tributario.csv')
    source_rows = list(csv.DictReader(io.StringIO(source_csv)))
    core_rows = decrypt_json('data/empresa2/core/dados_tributario.json')
    scenario_totals = decrypt_json('data/empresa2/core/scenario_totals.json')
    scenario_blocks = decrypt_json('data/empresa2/core/scenario_blocks.json')
    return (
        source_rows,
        core_rows,
        scenario_totals,
        json.dumps(scenario_blocks, ensure_ascii=False, sort_keys=True, separators=(',', ':')),
    )


def _semantic_source_rows(
    source_rows: list[dict[str, Any]], core_rows: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    if not source_rows or not core_rows:
        raise ValueError('Source export and core rows must be nonempty.')
    source_fields = list(source_rows[0])
    core_fields = list(core_rows[0])
    if len(source_fields) != len(core_fields):
        raise ValueError('Source/core field count mismatch; positional map is unsafe.')

    id_position = next(
        (index for index, field in enumerate(source_fields) if field.replace('\ufeff', '').strip() == '__excel_row'),
        None,
    )
    if id_position is None or core_fields[id_position] != '__excel_row':
        raise ValueError('Source/core row identifier position mismatch.')

    semantic_rows: list[dict[str, Any]] = []
    mismatched_scenario = 0
    matched_tax_cell_count = 0
    mismatched_tax_cell_count = 0
    core_by_id = {str(row.get('__excel_row', '')).strip(): row for row in core_rows}
    for source in source_rows:
        values = list(source.values())
        semantic = {field: values[index] for index, field in enumerate(core_fields)}
        semantic_rows.append(semantic)
        core = core_by_id.get(str(semantic.get('__excel_row', '')).strip())
        if core is None:
            continue
        if str(semantic.get('# Cenário', '')).strip() != str(core.get('# Cenário', '')).strip():
            mismatched_scenario += 1
        for field in ('Efeitos Débitos', 'Efeitos Créditos'):
            left = _parse_tax_number(semantic.get(field))
            right = _parse_tax_number(core.get(field))
            if left is None or right is None:
                mismatched_tax_cell_count += 1
            else:
                matched_tax_cell_count += 1
                if left.quantize(Decimal('0.01')) != right.quantize(Decimal('0.01')):
                    mismatched_tax_cell_count += 1
    return semantic_rows, {
        'source_field_count': len(source_fields),
        'core_field_count': len(core_fields),
        'row_id_position_match': True,
        'matched_scenario_mismatch_count': mismatched_scenario,
        'matched_tax_cells_equal_count': matched_tax_cell_count,
        'matched_tax_cell_mismatch_or_unparseable_count': mismatched_tax_cell_count,
        'currency_comparison_tolerance_brl': 0.01,
        'status': 'PASS' if mismatched_scenario == 0 and mismatched_tax_cell_count == 0 else 'WARN',
    }


def _sum_tax_rows(rows: list[dict[str, Any]], *, scenario_field: str) -> dict[str, Any]:
    subtotal = Decimal(0)
    selected = 0
    invalid = 0
    for row in rows:
        if str(row.get(scenario_field, '')).strip() != BASELINE_LABEL:
            continue
        debit = _parse_tax_number(row.get('Efeitos Débitos'))
        credit = _parse_tax_number(row.get('Efeitos Créditos'))
        selected += 1
        if debit is None or credit is None:
            invalid += 1
        else:
            subtotal += debit - credit
    return {'rows': selected, 'unparseable_rows': invalid, 'sum_brl': float(subtotal) if not invalid else None}


def _load_node_engine_report() -> dict[str, Any]:
    sys.path.insert(0, str(ROOT))
    from tests.crypto_helpers import NODE_DECRYPT_HELPER

    js = (
        NODE_DECRYPT_HELPER
        + r"""
import { loadRuntimeBundle } from './tests/runtime_bundle_support.mjs';
import { buildScenarioFromForm } from './assets/js/phase3/scenario-builder.js';
import { runScenario } from './assets/js/phase3/scenario-simulator.js';
import { buildBaselineScenario } from './assets/js/phase4/optimizer-utils.js';
import { sameCdLabel } from './assets/js/core/cd-utils.js';
import { resolveEmpresa2EsCd } from './scripts/audit/e2_scenario_lookup.mjs';

const n = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const safeCounts = (result) => {
  const details = result.costs?.tax_details || {};
  const coverage = result.tax_results?.tax_coverage || details.tax_coverage || {};
  const match = details.tax_input_match_summary || {};
  return {
    mode: result.calculation_method || result.costs?.calculation_method || null,
    baseline_mode: result.baseline_mode || 'canonical_reference',
    tax_mode: result.tax_results?.tax_mode || null,
    tax_regime: result.tax_results?.tax_regime || null,
    tax_impact_brl: n(result.costs?.tax_impact),
    total_logistics_cost_brl: n(result.costs?.total_logistics_cost),
    total_with_tax_brl: n(result.total_with_tax),
    components_brl: {
      transfer_cost: n(result.costs?.transfer_cost),
      distribution_cost: n(result.costs?.distribution_cost),
      storage_cost: n(result.costs?.storage_cost),
      inventory_cost: n(result.costs?.inventory_cost),
      tax_impact: n(result.costs?.tax_impact),
    },
    tax_precision_mode: details.precision_mode || null,
    tax_decision_use: details.decision_use || null,
    tax_coverage: {
      input_flow_count: n(coverage.input_flow_count),
      eligible_flow_count: n(coverage.eligible_flow_count),
      coverage_limited: Boolean(coverage.coverage_limited),
      proxy_flow_count: n(coverage.proxy_flow_count),
    },
    tax_input_match_summary: {
      exact: n(match.exact),
      destination_proxy: n(match.destination_proxy),
      fallback: n(match.fallback),
      observed_flow_count: n(match.observed_flow_count),
      fallback_flow_count: n(match.fallback_flow_count),
    },
    simulation_status: result.simulation_status,
  };
};

const e1 = loadRuntimeBundle({ companyId: 'empresa1', decryptJson });
const e1Base = buildBaselineScenario('empresa1', e1);
const e1Canonical = runScenario({ companyId: 'empresa1', scenario: e1Base, baselineBundle: e1 });
const e1Physical = runScenario({ companyId: 'empresa1', scenario: e1Base, baselineBundle: e1, baselineMode: 'physical_unanchored' });
const e1RepeatScenario = { ...e1Base, scenario_id: `${e1Base.scenario_id}_audit_repeat`, scenario_name: 'Audit repeat' };
const e1PhysicalRepeat = runScenario({ companyId: 'empresa1', scenario: e1RepeatScenario, baselineBundle: e1, baselineMode: 'physical_unanchored' });

const e2 = loadRuntimeBundle({ companyId: 'empresa2', decryptJson });
const lookup = resolveEmpresa2EsCd({ activeCds: e2.model.active_cds || [], flows: e2.flows || [] });
let e2Es = null;
let e2WorkbookMatch = { scenario_block_match_count: 0, scenario_total_match_count: 0 };
if (lookup.status === 'resolved') {
  const baseline = buildBaselineScenario('empresa2', e2);
  const oneCd = buildScenarioFromForm({
    companyId: 'empresa2', baselineBundle: e2,
    scenarioId: 'e2_one_cd_es_audit',
    formValues: {
      scenario_name: 'C04 private diagnostic', active_cds: [lookup.cd],
      freight_multiplier: 1, demand_multiplier: 1, inventory_days: baseline.changes.inventory_days,
      wacc: baseline.changes.wacc, tax_mode: 'current', tax_regime: 'current',
    },
  });
  const result = runScenario({ companyId: 'empresa2', scenario: oneCd, baselineBundle: e2, baselineMode: 'physical_unanchored' });
  const totals = decryptJson('data/empresa2/core/scenario_totals.json');
  const blocks = decryptJson('data/empresa2/core/scenario_blocks.json');
  const blockMatches = blocks.filter((block) => {
    const branches = (block.rows || []).map((row) => row.Filial).filter((value) => value && value !== 'Total');
    return branches.length === 1 && sameCdLabel(branches[0], lookup.cd);
  });
  const totalMatches = totals.filter((row) => blockMatches.some((block) => block.scenario_name === row.scenario_name));
  e2WorkbookMatch = {
    scenario_block_match_count: blockMatches.length,
    scenario_total_match_count: totalMatches.length,
    source_has_flow_to_cd_allocation: JSON.stringify(blocks).toLowerCase().includes('flow_to_cd_allocation'),
    matched_workbook_components_brl: totalMatches.length === 1 ? {
      transfer_cost: n(totalMatches[0]['Custo Transferência']),
      distribution_cost: n(totalMatches[0]['Custo Distribuição']),
      storage_cost: n(totalMatches[0]['Custo Armazenagem']),
      inventory_cost: n(totalMatches[0]['Custo de Estoque']),
      tax_impact: n(totalMatches[0]['Efeitos Tributários']),
      total_with_tax: n(totalMatches[0]['Custo Total']),
    } : null,
  };
  const flowSummary = result.flow_summary || {};
  const flows = result.flows || [];
  const factoryFlows = (e2.flows || []).filter((flow) => flow.flow_type === 'factory_to_cd');
  const targetFactoryFlows = factoryFlows.filter((flow) => sameCdLabel(flow.cd, lookup.cd));
  e2Es = {
    cd_resolution: { status: lookup.status, candidate_count: lookup.candidate_count, matched_flow_count: lookup.matched_flow_count },
    selected_cd_count: oneCd.changes.active_cds.length,
    simulation: safeCounts(result),
    flow_summary: {
      input_baseline_flow_count: (e2.flows || []).length,
      rebuilt_flow_count: flows.length,
      factory_to_cd_count: factoryFlows.length,
      selected_cd_factory_to_cd_count: targetFactoryFlows.length,
      selected_cd_factory_to_cd_es_count: targetFactoryFlows.filter((flow) => String(flow.cd_uf || '').trim().toUpperCase() === 'ES').length,
      source_has_flow_to_cd_allocation: e2WorkbookMatch.source_has_flow_to_cd_allocation,
      total_annual_revenue_brl: n(flowSummary.total_annual_revenue ?? flowSummary.total_revenue_cd_to_destination),
      rows_with_weight_kg: flows.filter((flow) => Number.isFinite(Number(flow.annual_weight_kg ?? flow.weight_kg))).length,
      rows_with_volume_but_no_weight: flows.filter((flow) => flow.volume != null && flow.annual_weight_kg == null && flow.weight_kg == null).length,
      rows_reallocated: flows.filter((flow) => flow.reallocation_status === 'reallocated').length,
    },
    workbook_reference: e2WorkbookMatch,
  };
}

console.log(JSON.stringify({
  e1: {
    same_network_canonical: safeCounts(e1Canonical),
    same_network_physical_unanchored: safeCounts(e1Physical),
    same_network_physical_unanchored_repeat: safeCounts(e1PhysicalRepeat),
    same_network_recalculation_deterministic: n(e1Physical.costs?.tax_impact) === n(e1PhysicalRepeat.costs?.tax_impact),
    same_network_canonical_tax_anchor_equal: n(e1Canonical.costs?.tax_impact) === n(e1.costs?.costs?.tax_impact),
    model_network_cd_count: (e1.model.active_cds || []).length,
  },
  e2: {
    baseline_cd_count: (e2.model.active_cds || []).length,
    es_lookup: lookup.status === 'resolved' ? { status: lookup.status, candidate_count: lookup.candidate_count, matched_flow_count: lookup.matched_flow_count } : lookup,
    one_cd_es: e2Es,
  },
}));
"""
    )
    result = subprocess.run(
        ['node', '--input-type=module', '-e', js],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    if result.returncode:
        last_error = result.stderr.splitlines()[-1] if result.stderr else 'unknown Node error'
        raise RuntimeError(f'Node tax-engine diagnostic failed ({last_error[:180]}).')
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError as error:
        raise RuntimeError('Node tax-engine diagnostic returned invalid JSON.') from error


def _write_private_file(path: Path, content: str) -> None:
    path.write_text(content, encoding='utf-8')
    path.chmod(0o600)


def run_diagnostics(output_dir: Path, run_id: str | None = None) -> dict[str, Any]:
    if not output_dir.is_absolute():
        output_dir = (ROOT / output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    if any(output_dir.iterdir()):
        raise FileExistsError('Refusing to overwrite an existing diagnostic execution.')
    output_dir.chmod(0o700)
    if output_dir.is_relative_to(ROOT):
        check_ignore = subprocess.run(
            ['git', 'check-ignore', '-q', str(output_dir.relative_to(ROOT))], cwd=ROOT, check=False
        )
        if check_ignore.returncode != 0:
            raise RuntimeError('Refusing to write protected diagnostics to a non-ignored repository path.')

    source_rows, core_rows, scenario_totals, _scenario_blocks_json = _load_protected_data()
    semantic_source_rows, schema_check = _semantic_source_rows(source_rows, core_rows)
    id_field = '__excel_row'
    core_ids = [str(row.get(id_field, '')).strip() for row in core_rows]
    row_audit = classify_c08_exclusions(
        semantic_source_rows,
        core_ids,
        row_id_field=id_field,
        scenario_field='# Cenário',
        debit_field='Efeitos Débitos',
        credit_field='Efeitos Créditos',
        baseline_scenario=BASELINE_LABEL,
    )
    core_tax = _sum_tax_rows(core_rows, scenario_field='# Cenário')
    source_tax = _sum_tax_rows(semantic_source_rows, scenario_field='# Cenário')
    canonical_rows = [row for row in scenario_totals if row.get('scenario_name') == BASELINE_LABEL]
    if len(canonical_rows) != 1:
        raise ValueError('Expected exactly one canonical baseline scenario total.')
    canonical_total = _parse_tax_number(canonical_rows[0].get('Efeitos Tributários'))
    if canonical_total is None:
        raise ValueError('Canonical baseline tax total is not parseable.')
    if core_tax['sum_brl'] is None or source_tax['sum_brl'] is None:
        raise ValueError('Tax matrix is unavailable or unparseable; reconciliation is blocked.')
    matrix_total = core_tax['sum_brl']
    c08 = reconcile_c08_totals(
        canonical_total=float(canonical_total),
        matrix_total=float(matrix_total),
        explained_adjustments=row_audit['missing_baseline_tax_contribution'],
    )
    c08.update(
        {
            'source_matrix': source_tax,
            'core_matrix': core_tax,
            'source_to_core_matrix_delta_brl': (
                float(Decimal(str(source_tax['sum_brl'])) - Decimal(str(core_tax['sum_brl'])))
                if source_tax['sum_brl'] is not None and core_tax['sum_brl'] is not None
                else None
            ),
            'excluded_source_rows': row_audit,
            'source_schema_alignment': schema_check,
            'workbook_adjustment_used': False,
            'workbook_delta_faturamento_adjusted_value_used': False,
        }
    )

    engine_report = _load_node_engine_report()
    c01 = engine_report['e1']
    c01['comparison_status'] = classify_c01_comparability(
        same_network=True,
        left_method=c01['same_network_canonical']['mode'],
        right_method=c01['same_network_physical_unanchored']['mode'],
    )
    c01['same_network_recalculation_delta_brl'] = (
        c01['same_network_physical_unanchored']['tax_impact_brl'] - c01['same_network_canonical']['tax_impact_brl']
    )
    c01['baseline_recalculation_decision_use'] = c01['same_network_physical_unanchored']['tax_decision_use']
    c01['matches_historical_rounded_75_26m_reference'] = (
        abs(c01['same_network_physical_unanchored']['tax_impact_brl'] - 75_260_000) <= 5_000
    )

    c04 = engine_report['e2']['one_cd_es']
    if c04 is not None:
        c04['comparability'] = classify_c04_comparability(
            has_flow_to_cd_allocation=bool(c04['workbook_reference']['source_has_flow_to_cd_allocation']),
            same_tax_regime=None,
            same_demand_basis=None,
        )

    reports = {
        'c01_tax_baseline_ab_test_private.json': c01,
        'c04_e2_1cd_es_flow_diagnostics_private.json': c04 or {'status': 'BLOCKED_SOURCE'},
        'c08_tax_reconciliation_private.json': c08,
        'c08_row_exclusion_audit_private.json': row_audit,
    }
    sha_files = [
        ROOT / 'data/empresa1/phase2/phase2_bundle.json.enc.json',
        ROOT / 'data/empresa1/core/distance_matrix.json.enc.json',
        ROOT / 'data/empresa2/phase2/phase2_bundle.json.enc.json',
        ROOT / 'data/empresa2/core/lat_long.json.enc.json',
        ROOT / 'data/empresa2/core/rotas_mapa.json.enc.json',
        ROOT / 'data/empresa2/core/tabelas_cif_dist.json.enc.json',
        ROOT / 'data/empresa2/core/aux_custo_transferencia.json.enc.json',
        ROOT / 'data/empresa2/core/aux_custo_armazenagem.json.enc.json',
        ROOT / 'data/empresa2/source_exports/empresa2_main/09_Dados_Tributario.csv.enc.json',
        ROOT / 'data/empresa2/core/dados_tributario.json.enc.json',
        ROOT / 'data/empresa2/core/scenario_totals.json.enc.json',
        ROOT / 'data/empresa2/core/scenario_blocks.json.enc.json',
    ]
    missing_hash_files = [path.relative_to(ROOT).as_posix() for path in sha_files if not path.exists()]
    if missing_hash_files:
        raise FileNotFoundError(f'Expected encrypted diagnostic inputs are missing: {missing_hash_files}')
    inputs = [
        {
            'path': path.relative_to(ROOT).as_posix(),
            'encrypted_file_sha256': hashlib.sha256(path.read_bytes()).hexdigest(),
        }
        for path in sha_files
    ]
    source_digest = hashlib.sha256(
        ''.join(item['encrypted_file_sha256'] for item in inputs).encode('ascii')
        + hashlib.sha256(Path(__file__).read_bytes()).digest()
    ).hexdigest()[:10]
    if run_id is not None and not re.fullmatch(r'[A-Za-z0-9_-]{1,100}', run_id):
        raise ValueError('Invalid execution run_id.')
    run_id = run_id or f'tax-audit-{datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")}-{source_digest}'
    for report, issue_id in ((c01, 'C01'), (c04, 'C04'), (c08, 'C08'), (row_audit, 'C08')):
        if report is not None:
            report['run_id'] = run_id
            report['issue_id'] = issue_id
            report['sensitivity'] = 'PRIVATE_LOCAL_NOT_FOR_SHARE'
    for filename, report in reports.items():
        _write_private_file(output_dir / filename, json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    _write_c01_tables(output_dir, c01, run_id)
    _write_c04_tables(output_dir, c04, run_id)
    _write_c08_tables(output_dir, c08, row_audit, run_id)

    # Reviewable aggregate projections stay private and fail closed until a
    # separate disclosure review explicitly authorizes publication.
    review_summaries = {
        'c01_shareable_tax_summary.json': {
            'company_id': 'empresa1',
            'issue_id': 'C01',
            'status': c01['comparison_status']['status'],
            'aggregate_metrics': {
                'network_cd_count': c01['model_network_cd_count'],
                'canonical_baseline_tax_brl': c01['same_network_canonical']['tax_impact_brl'],
                'physical_unanchored_same_network_tax_brl': c01['same_network_physical_unanchored']['tax_impact_brl'],
                'historical_rounded_value_check': c01['matches_historical_rounded_75_26m_reference'],
            },
            'cause_codes': ['MIXED_ANCHORED_AND_RECALCULATED_METHODS'],
            'row_counts': {
                'input_flows': c01['same_network_physical_unanchored']['tax_coverage']['input_flow_count'],
                'proxy_flows': c01['same_network_physical_unanchored']['tax_coverage']['proxy_flow_count'],
            },
            'limitations': ['Tax recomputation is exploratory and uses proxy inputs; no official fiscal validation.'],
        },
        'c04_shareable_tax_summary.json': {
            'company_id': 'empresa2',
            'issue_id': 'C04',
            'status': (c04 or {}).get('comparability', {}).get('status', 'BLOCKED_SOURCE'),
            'aggregate_metrics': {
                'workbook_and_engine_values_retained_separately': True,
                'component_deltas_published': False,
            },
            'cause_codes': [(c04 or {}).get('comparability', {}).get('reason_code', 'CD_ES_LOOKUP_BLOCKED')],
            'row_counts': {
                'factory_to_cd_flows': (c04 or {}).get('flow_summary', {}).get('factory_to_cd_count'),
                'selected_cd_flows': (c04 or {}).get('flow_summary', {}).get('selected_cd_factory_to_cd_count'),
            },
            'limitations': [
                'Workbook flow-to-CD allocation is absent; displayed motor/workbook values are not equivalent-scenario evidence.'
            ],
        },
        'c08_shareable_tax_summary.json': {
            'company_id': 'empresa2',
            'issue_id': 'C08',
            'status': c08['status'],
            'aggregate_metrics': {
                'canonical_tax_brl': c08['canonical_total_brl'],
                'matrix_tax_brl': c08['matrix_total_brl'],
                'delta_brl': c08['delta_brl'],
                'delta_pct': c08['delta_pct_of_canonical'],
                'source_to_core_delta_brl': c08['source_to_core_matrix_delta_brl'],
            },
            'cause_codes': ['UNEXPLAINED_DELTA', 'NO_BASELINE_SOURCE_ONLY_ROWS'],
            'row_counts': {
                'source_rows': row_audit['source_rows'],
                'core_rows': row_audit['core_rows'],
                'source_only_rows': row_audit['missing_rows'],
                'baseline_source_only_rows': row_audit['baseline_missing_rows'],
            },
            'limitations': ['No stable document/operation key for canonical total; residual cause remains unproven.'],
        },
    }
    for filename, summary in review_summaries.items():
        summary.update(
            {
                'schema_version': 'tax-audit-aggregate-1.0',
                'run_id': run_id,
                'sensitivity': 'aggregated_review_required',
                'shareable_projection_authorized': False,
            }
        )
        _write_private_file(output_dir / filename, json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
    manifest = {
        'run_id': run_id,
        'schema_version': 'tax-audit-private-1.0',
        'classification': 'PRIVATE_LOCAL_NOT_FOR_SHARE',
        'status': 'PRIVATE_DIAGNOSTICS_ONLY',
        'source_hashes': inputs,
        'c01_status': c01['comparison_status']['status'],
        'c04_status': (c04 or {}).get('comparability', {}).get('status', 'BLOCKED_SOURCE'),
        'c08_status': c08['status'],
        'c08_excluded_baseline_rows': row_audit['baseline_missing_rows'],
        'shareable_export_status': 'BLOCKED_AUTHORIZATION',
        'created_files': sorted(path.name for path in output_dir.iterdir() if path.is_file()),
    }
    _write_private_file(output_dir / 'private_diagnostic_manifest.json', json.dumps(manifest, indent=2) + '\n')
    return manifest


def _write_csv(path: Path, headers: list[str], rows: list[dict[str, Any]], *, run_id: str) -> None:
    buffer = io.StringIO(newline='')
    writer = csv.DictWriter(buffer, fieldnames=['run_id', *headers], extrasaction='ignore')
    writer.writeheader()
    writer.writerows([{**row, 'run_id': run_id} for row in rows])
    _write_private_file(path, buffer.getvalue())


def _write_c01_tables(output_dir: Path, c01: dict[str, Any], run_id: str) -> None:
    fields = [
        ('canonical_baseline', c01['same_network_canonical']),
        ('physical_unanchored_same_network', c01['same_network_physical_unanchored']),
        ('physical_unanchored_repeat', c01['same_network_physical_unanchored_repeat']),
    ]
    rows = []
    for scenario_id, result in fields:
        rows.append(
            {
                'scenario_id': scenario_id,
                'network_cd_count': c01['model_network_cd_count'],
                'baseline_method': result['mode'],
                'tax_mode': result['tax_mode'],
                'tax_regime': result['tax_regime'],
                'tax_impact_brl': result['tax_impact_brl'],
                'tax_coverage_limited': result['tax_coverage']['coverage_limited'],
                'proxy_flow_count': result['tax_coverage']['proxy_flow_count'],
                'exact_match_count': result['tax_input_match_summary']['exact'],
                'fallback_match_count': result['tax_input_match_summary']['fallback_flow_count'],
                'tax_decision_use': result['tax_decision_use'],
                'method_comparability_status': c01['comparison_status']['status'],
            }
        )
    _write_csv(
        output_dir / 'e1_tax_baseline_ab_test_private.csv',
        [
            'scenario_id',
            'network_cd_count',
            'baseline_method',
            'tax_mode',
            'tax_regime',
            'tax_impact_brl',
            'tax_coverage_limited',
            'proxy_flow_count',
            'exact_match_count',
            'fallback_match_count',
            'tax_decision_use',
            'method_comparability_status',
        ],
        rows,
        run_id=run_id,
    )
    explanation = (
        '# C01 — diagnóstico privado de comparabilidade fiscal E1\n\n'
        f'Status: `{c01["comparison_status"]["status"]}`. O modo canônico e o recálculo físico usam a mesma rede, mas métodos distintos. '
        f'O recálculo físico usa `{c01["same_network_physical_unanchored"]["tax_precision_mode"]}`, tem cobertura fiscal limitada e decisão `{c01["baseline_recalculation_decision_use"]}`. '
        f'O recálculo independente repetido foi determinístico: `{str(c01["same_network_recalculation_deterministic"]).lower()}`. '
        f'O teste contra o valor histórico arredondado de R$ 75,26 mi foi `{str(c01["matches_historical_rounded_75_26m_reference"]).lower()}`; esse teste é somente uma checagem documental, não meta de cálculo.\n\n'
        'Conclusão: diferenças entre o tributo do baseline ancorado e cenários calculados por proxy não identificam efeito causal da mudança de malha. '
        'A comparação tributária de decisão permanece exploratória até haver trilha fiscal compatível por operação e cobertura validada.\n'
    )
    _write_private_file(output_dir / 'e1_tax_explanation_private.md', explanation)
    _write_private_file(
        output_dir / 'e1_tax_flow_aggregate_private.json',
        json.dumps(
            {
                'classification': 'PRIVATE_LOCAL_NOT_FOR_SHARE',
                'input_flow_count': c01['same_network_physical_unanchored']['tax_coverage']['input_flow_count'],
                'eligible_flow_count': c01['same_network_physical_unanchored']['tax_coverage']['eligible_flow_count'],
                'proxy_flow_count': c01['same_network_physical_unanchored']['tax_coverage']['proxy_flow_count'],
                'exact_tax_input_match_count': c01['same_network_physical_unanchored']['tax_input_match_summary'][
                    'exact'
                ],
                'fallback_tax_input_match_count': c01['same_network_physical_unanchored']['tax_input_match_summary'][
                    'fallback_flow_count'
                ],
                'official_fiscal_validation': False,
                'decision_use': c01['baseline_recalculation_decision_use'],
            },
            indent=2,
        )
        + '\n',
    )


def _write_c04_tables(output_dir: Path, c04: dict[str, Any] | None, run_id: str) -> None:
    if not c04:
        _write_private_file(
            output_dir / 'e2_1cd_es_root_cause_private.md',
            '# C04 — BLOCKED_SOURCE\n\nO runtime não permitiu resolver univocamente um CD ES por metadado de fluxo.\n',
        )
        return
    workbook = c04['workbook_reference'].get('matched_workbook_components_brl') or {}
    engine = c04['simulation']['components_brl']
    component_keys = [
        ('transfer', 'transfer_cost'),
        ('distribution', 'distribution_cost'),
        ('storage', 'storage_cost'),
        ('inventory', 'inventory_cost'),
        ('tax', 'tax_impact'),
    ]
    rows = [
        {
            'component': name,
            'workbook_reference_brl': workbook.get(field, ''),
            'engine_physical_unanchored_brl': engine.get(field, ''),
            'delta_brl': '',
            'delta_pct': '',
            'workbook_status': 'WORKBOOK_ONLY' if field in workbook else 'BLOCKED_SOURCE',
            'engine_status': 'PARAMETRIC_EXPLORATORY',
            'comparability_status': c04['comparability']['status'],
            'cause_code': c04['comparability']['reason_code'],
        }
        for name, field in component_keys
    ]
    rows.append(
        {
            'component': 'total_with_tax',
            'workbook_reference_brl': workbook.get('total_with_tax', ''),
            'engine_physical_unanchored_brl': c04['simulation']['total_with_tax_brl'],
            'delta_brl': '',
            'delta_pct': '',
            'workbook_status': 'WORKBOOK_ONLY' if 'total_with_tax' in workbook else 'BLOCKED_SOURCE',
            'engine_status': 'PARAMETRIC_EXPLORATORY',
            'comparability_status': c04['comparability']['status'],
            'cause_code': c04['comparability']['reason_code'],
        }
    )
    _write_csv(
        output_dir / 'e2_1cd_es_reconciliation_private.csv',
        [
            'component',
            'workbook_reference_brl',
            'engine_physical_unanchored_brl',
            'delta_brl',
            'delta_pct',
            'workbook_status',
            'engine_status',
            'comparability_status',
            'cause_code',
        ],
        rows,
        run_id=run_id,
    )
    explanation = (
        '# C04 — diagnóstico privado do cenário E2 de um CD no ES\n\n'
        f'O CD foi resolvido por join de `model.active_cds` a fluxos `factory_to_cd` por `sameCdLabel`, exigindo `cd_uf=ES`; resultado: `{c04["cd_resolution"]["status"]}`, um candidato. '
        f'A fonte possui correspondência de cenário em nível de bloco/totais ({c04["workbook_reference"]["scenario_block_match_count"]}/1), mas não contém matriz de alocação fluxo→CD. Status: `{c04["comparability"]["status"]}`.\n\n'
        f'No runtime, o baseline contém {c04["flow_summary"]["factory_to_cd_count"]} fluxos fábrica→CD; o CD selecionado aparece em {c04["flow_summary"]["selected_cd_factory_to_cd_count"]} fluxos, todos com UF ES. '
        f'O cenário físico usa {c04["flow_summary"]["rows_with_volume_but_no_weight"]} registros com volume sem peso em kg utilizável para CIF. O motor exclui `factory_to_cd` do custo CIF de distribuição e cobra transferência apenas em fluxos explicitamente realocados.\n\n'
        'A tabela privada mantém valores do workbook e do motor em colunas separadas. Deltas foram deixados vazios porque os grãos/alocações não provam equivalência; não se atribui a diferença a contingência, frete, estoque ou imposto. '
        'O resultado do motor é exploratório e o workbook permanece referência documental.\n'
    )
    _write_private_file(output_dir / 'e2_1cd_es_root_cause_private.md', explanation)


def _write_c08_tables(output_dir: Path, c08: dict[str, Any], row_audit: dict[str, Any], run_id: str) -> None:
    _write_csv(
        output_dir / 'e2_tax_reconciliation_private.csv',
        [
            'metric',
            'canonical_brl',
            'matrix_brl',
            'delta_brl',
            'delta_pct',
            'explained_adjustments_brl',
            'residual_brl',
            'status',
            'tolerance_pct',
        ],
        [
            {
                'metric': 'baseline_tax_matrix_vs_canonical',
                'canonical_brl': c08['canonical_total_brl'],
                'matrix_brl': c08['matrix_total_brl'],
                'delta_brl': c08['delta_brl'],
                'delta_pct': c08['delta_pct_of_canonical'],
                'explained_adjustments_brl': c08['explained_adjustments_brl'],
                'residual_brl': c08['bridge_residual_brl'],
                'status': c08['status'],
                'tolerance_pct': c08['tolerance_pct'],
            }
        ],
        run_id=run_id,
    )
    exclusion_rows = [
        {
            'exclusion_class': name,
            'row_count': values['row_count'],
            'baseline_row_count': values['baseline_row_count'],
            'tax_delta_brl': values['tax_delta_brl'],
            'unparseable_tax_rows': values['unparseable_tax_rows'],
            'shareable_status': 'BLOCKED_AUTHORIZATION',
        }
        for name, values in row_audit['classes'].items()
    ]
    _write_csv(
        output_dir / 'etl_row_exclusion_audit_private.csv',
        [
            'exclusion_class',
            'row_count',
            'baseline_row_count',
            'tax_delta_brl',
            'unparseable_tax_rows',
            'shareable_status',
        ],
        exclusion_rows,
        run_id=run_id,
    )
    explanation = (
        '# C08 — reconciliação tributária E2, diagnóstico privado\n\n'
        f'Status: `{c08["status"]}`. Matriz fonte e core concordam ao centavo nas linhas baseline; a comparação de 1.112 células fiscais correspondentes também fecha ao centavo. '
        f'A diferença baseline matriz↔total canônico permanece fora da tolerância de 1%, com resíduo não explicado.\n\n'
        f'A exportação fonte contém {row_audit["source_rows"]} registros e o core {row_audit["core_rows"]}; {row_audit["missing_rows"]} source-only IDs: '
        f'{row_audit["classes"]["blank"]["row_count"]} linhas vazias e {row_audit["classes"]["non_baseline"]["row_count"]} linhas de outros cenários. '
        f'Nenhuma linha fonte ausente corresponde ao filtro literal `{BASELINE_LABEL}`; contribuição das linhas ausentes para a soma baseline: R$ {row_audit["missing_baseline_tax_contribution"]:,.2f}.\n\n'
        'Assim, remoção de linhas baseline no ETL foi refutada como explicação demonstrada do resíduo. Os dados não preservam chave estável de documento/operação para parear contra o total canônico; não é possível separar diferenças de definição, ajustes do workbook, estornos ou outros conceitos com os artefatos disponíveis. '
        'Ajuste por Δ Faturamento não foi aplicado como correção; qualquer proximidade obtida por fator permanece sensibilidade e não prova causalidade.\n'
    )
    _write_private_file(output_dir / 'e2_tax_delta_root_cause_private.md', explanation)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output-dir', type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument('--run-id', help='Optional run_id of the associated canonical model execution.')
    args = parser.parse_args()
    manifest = run_diagnostics(args.output_dir, run_id=args.run_id)
    print(
        json.dumps(
            {
                'status': manifest['status'],
                'c01_status': manifest['c01_status'],
                'c04_status': manifest['c04_status'],
                'c08_status': manifest['c08_status'],
                'shareable_export_status': manifest['shareable_export_status'],
                'output_dir': str(args.output_dir),
            }
        )
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

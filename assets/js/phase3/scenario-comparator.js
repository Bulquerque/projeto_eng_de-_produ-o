import { buildScenarioSummary } from '../core/scenario-summary.js';
import { safeNumber } from '../core/common.js';
import { getCompanyModelDefaults } from '../core/model-configuration.js';
import { defaultReallocationRule } from './reallocation-policy.js';

export function isScenarioResultComparable(result) {
  const total = result?.total_with_tax ?? result?.costs?.total_with_tax;
  return Boolean(
    result &&
    (!result.simulation_status || result.simulation_status === 'success') &&
    !(result.errors?.length > 0) &&
    (typeof total === 'number' || (typeof total === 'string' && total.trim() !== '')) &&
    Number.isFinite(Number(total))
  );
}

function buildBaselineResult(bundle) {
  const modelDefaults = getCompanyModelDefaults(bundle?.model?.company_id, bundle);
  const costs = bundle?.costs?.costs || {};
  return {
    scenario_id: bundle?.model?.scenario_id || 'baseline',
    scenario_name: 'Baseline',
    company_id: bundle?.model?.company_id,
    scenario: {
      changes: {
        active_cds: bundle?.model?.active_cds || [],
        freight_multiplier: 1,
        demand_multiplier: 1,
        inventory_days: modelDefaults.inventory_days,
        wacc: modelDefaults.reference_wacc,
        tax_mode: 'current',
        reallocation_rule: defaultReallocationRule(bundle?.model?.company_id),
      },
    },
    total_with_tax: costs.total_with_tax ?? null,
    costs,
    tax_results: bundle?.tax_results?.tax_results || {},
  };
}

function assertSameCompany(companyId, result) {
  if (result.company_id && result.company_id !== companyId) {
    throw new Error('Comparação entre empresas diferentes bloqueada.');
  }
}

function comparisonRow({ base, companyId, result }) {
  assertSameCompany(companyId, result);
  const taxResults = result.tax_results || {};

  const summary = buildScenarioSummary({
    scenario: result?.scenario,
    result,
    baselineTotal: base.total_with_tax,
  });
  return {
    scenario_id: summary.scenario_id,
    scenario_name: summary.scenario_name,
    scenario_type: summary.scenario_type,
    active_cds_count: summary.active_cds_count,
    freight_multiplier: summary.freight_multiplier,
    demand_multiplier: summary.demand_multiplier,
    inventory_days: summary.inventory_days,
    tax_mode: result?.scenario?.changes?.tax_mode || 'current',
    tax_regime:
      taxResults.tax_regime ||
      result?.scenario?.changes?.tax_regime ||
      result?.scenario?.changes?.tax_mode,
    tax_regime_label: summary.tax_regime_label,
    tax_source_label: summary.tax_source_label,
    total_with_tax: summary.total_with_tax,
    total_logistics_cost: safeNumber(result.costs?.total_logistics_cost),
    transfer_cost: summary.transfer_cost,
    distribution_cost: safeNumber(result.costs?.distribution_cost),
    storage_cost: safeNumber(result.costs?.storage_cost),
    inventory_cost: safeNumber(result.costs?.inventory_cost),
    tax_impact: summary.tax_impact,
    tax_calculation_mode: taxResults.calculation_mode,
    tax_precision_mode: taxResults.precision_mode,
    tax_explanation: taxResults.explanation,
    saving_abs: summary.saving_abs,
    saving_pct: summary.saving_pct,
    status:
      summary.saving_abs > 0
        ? 'better_than_baseline'
        : summary.saving_abs < 0
          ? 'worse_than_baseline'
          : 'baseline',
  };
}

export function compareScenarios({
  companyId,
  baselineBundle,
  baselineResult = null,
  scenarioResults = [],
}) {
  const base = baselineResult || buildBaselineResult(baselineBundle);
  const candidates = [base, ...scenarioResults].filter(Boolean);
  candidates.forEach((result) => assertSameCompany(companyId, result));
  if (!isScenarioResultComparable(base)) {
    return {
      company_id: companyId,
      comparison: [],
      best_by_total_cost: null,
      warnings: [],
      errors: ['Baseline sem resultado válido para comparação.'],
    };
  }
  const rejected = candidates.filter((result) => !isScenarioResultComparable(result));
  const rows = candidates
    .filter(isScenarioResultComparable)
    .map((result) => comparisonRow({ base, companyId, result }));

  const ranked = [...rows].sort((a, b) => a.total_with_tax - b.total_with_tax);
  ranked.forEach((row, index) => {
    const target = rows.find((candidate) => candidate.scenario_id === row.scenario_id);
    if (target) target.rank_by_total_cost = index + 1;
  });

  return {
    company_id: companyId,
    comparison: rows,
    best_by_total_cost: ranked[0]?.scenario_id || null,
    warnings: rejected.map(
      (result) =>
        `Cenário ${result.scenario_id || 'sem identificador'} excluído: simulação sem resultado válido.`
    ),
    errors: [],
  };
}

export function componentDelta(baselineBundle, result) {
  if (!isScenarioResultComparable(result)) return null;
  const baselineCosts = baselineBundle?.costs?.costs || {};
  const scenarioCosts = result?.costs || {};
  const metrics = [
    'transfer_cost',
    'distribution_cost',
    'storage_cost',
    'inventory_cost',
    'tax_impact',
    'total_with_tax',
  ];

  return metrics.map((metric) => ({
    metric,
    baseline: safeNumber(baselineCosts[metric]),
    scenario: safeNumber(scenarioCosts[metric]),
    delta: safeNumber(scenarioCosts[metric]) - safeNumber(baselineCosts[metric]),
  }));
}

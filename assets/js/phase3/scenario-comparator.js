import { buildScenarioSummary } from '../shared/scenario-summary.js';
import { MODEL_ASSUMPTIONS } from '../shared/model-assumptions.js';
import { buildScenarioFromForm } from './scenario-builder.js';
import { runScenario } from './scenario-simulator.js';

function n(value, fallback = 0) {
  if (value == null || (typeof value === 'string' && !value.trim())) return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function bundleBaselineResult(bundle) {
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
        inventory_days: MODEL_ASSUMPTIONS.inventory.baseline_days,
        wacc: MODEL_ASSUMPTIONS.inventory.baseline_wacc,
        tax_mode: 'current',
        reallocation_rule: 'nearest_available_cd',
      },
    },
    total_with_tax: n(costs.total_with_tax),
    costs,
    tax_results: bundle?.tax_results?.tax_results || {},
  };
}

export function buildComparableBaselineResult({ companyId, baselineBundle, scenario } = {}) {
  const changes = scenario?.changes || {};
  const taxMode = changes.tax_mode || 'current';
  const taxRegime = changes.tax_regime || null;
  const referenceScenario = buildScenarioFromForm({
    companyId,
    baselineBundle,
    scenarioId: `${baselineBundle?.model?.scenario_id || `${companyId}_baseline`}__${taxRegime || taxMode}_reference`,
    formValues: {
      scenario_name: 'Baseline comparável',
      active_cds: baselineBundle?.model?.active_cds || [],
      freight_multiplier: 1,
      demand_multiplier: 1,
      inventory_days: MODEL_ASSUMPTIONS.inventory.baseline_days,
      wacc: MODEL_ASSUMPTIONS.inventory.baseline_wacc,
      tax_mode: taxMode,
      tax_regime: taxRegime,
      reallocation_rule: 'nearest_available_cd',
      scenario_type: 'comparison_baseline',
    },
  });
  return runScenario({ companyId, scenario: referenceScenario, baselineBundle });
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
    total_with_tax: summary.total_with_tax,
    total_logistics_cost: n(result.costs?.total_logistics_cost),
    transfer_cost: summary.transfer_cost,
    distribution_cost: n(result.costs?.distribution_cost),
    storage_cost: n(result.costs?.storage_cost),
    inventory_cost: n(result.costs?.inventory_cost),
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
  const base = baselineResult || bundleBaselineResult(baselineBundle);
  assertSameCompany(companyId, base);
  const rows = [base, ...scenarioResults]
    .filter(Boolean)
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
    warnings: [],
    errors: [],
  };
}

export function componentDelta(baselineBundle, result, baselineResult = null) {
  const baselineCosts = baselineResult?.costs || baselineBundle?.costs?.costs || {};
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
    baseline: n(baselineCosts[metric]),
    scenario: n(scenarioCosts[metric]),
    delta: n(scenarioCosts[metric]) - n(baselineCosts[metric]),
  }));
}

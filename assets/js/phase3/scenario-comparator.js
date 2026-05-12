function n(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function baselineResult(bundle) {
  const costs = bundle?.costs?.costs || {};
  return {
    scenario_id: bundle?.model?.scenario_id || 'baseline',
    scenario_name: 'Baseline',
    company_id: bundle?.model?.company_id,
    total_with_tax: n(costs.total_with_tax),
    costs,
    tax_results: bundle?.tax_results?.tax_results || {}
  };
}

function assertSameCompany(companyId, result) {
  if (result.company_id && result.company_id !== companyId) {
    throw new Error('Comparação entre empresas diferentes bloqueada.');
  }
}

function comparisonRow({ base, companyId, result }) {
  assertSameCompany(companyId, result);

  const total = n(result.total_with_tax ?? result.costs?.total_with_tax);
  const savingAbs = base.total_with_tax - total;
  const savingPct = base.total_with_tax ? (savingAbs / base.total_with_tax) * 100 : 0;
  const taxResults = result.tax_results || {};
  const scenarioChanges = result.scenario?.changes || {};

  return {
    scenario_id: result.scenario_id,
    scenario_name: result.scenario_name || result.scenario?.scenario_name || result.scenario_id,
    total_with_tax: total,
    total_logistics_cost: n(result.costs?.total_logistics_cost),
    tax_impact: n(result.costs?.tax_impact ?? taxResults.total_tax_impact),
    tax_regime: taxResults.tax_regime || scenarioChanges.tax_regime || scenarioChanges.tax_mode,
    tax_calculation_mode: taxResults.calculation_mode,
    tax_precision_mode: taxResults.precision_mode,
    tax_explanation: taxResults.explanation,
    saving_abs: savingAbs,
    saving_pct: savingPct,
    status: savingAbs > 0 ? 'better_than_baseline' : savingAbs < 0 ? 'worse_than_baseline' : 'baseline'
  };
}

export function compareScenarios({ companyId, baselineBundle, scenarioResults = [] }) {
  const base = baselineResult(baselineBundle);
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
    errors: []
  };
}

export function componentDelta(baselineBundle, result) {
  const baselineCosts = baselineBundle?.costs?.costs || {};
  const scenarioCosts = result?.costs || {};
  const metrics = [
    'transfer_cost',
    'distribution_cost',
    'storage_cost',
    'inventory_cost',
    'tax_impact',
    'total_with_tax'
  ];

  return metrics.map((metric) => ({
    metric,
    baseline: n(baselineCosts[metric]),
    scenario: n(scenarioCosts[metric]),
    delta: n(scenarioCosts[metric]) - n(baselineCosts[metric])
  }));
}

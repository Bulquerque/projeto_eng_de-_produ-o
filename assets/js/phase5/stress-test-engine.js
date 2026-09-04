import { runScenario } from '../phase3/scenario-simulator.js';
import { buildStressCaseLibrary } from './stress-case-library.js';
import { MODEL_ASSUMPTIONS } from '../shared/model-assumptions.js';
function clone(obj) {
  return JSON.parse(JSON.stringify(obj || {}));
}
function n(v, d = 0) {
  if (v == null || (typeof v === 'string' && !v.trim())) return d;
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}
export function applyStressCaseToScenario({ scenario, stressCase }) {
  const stressed = clone(scenario);
  stressed.scenario_id = `${scenario.scenario_id || 'scenario'}__stress_${stressCase.case_id}`;
  stressed.scenario_name = `${scenario.scenario_name || scenario.scenario_id || 'Cenário'} · ${stressCase.name}`;
  stressed.changes = { ...(scenario.changes || {}) };
  const c = stressCase.changes || {};
  if (c.freight_multiplier_delta !== undefined)
    stressed.changes.freight_multiplier =
      n(stressed.changes.freight_multiplier, 1) * (1 + n(c.freight_multiplier_delta));
  if (c.demand_multiplier_delta !== undefined)
    stressed.changes.demand_multiplier =
      n(stressed.changes.demand_multiplier, 1) * (1 + n(c.demand_multiplier_delta));
  if (c.wacc_delta !== undefined)
    stressed.changes.wacc =
      n(stressed.changes.wacc, MODEL_ASSUMPTIONS.inventory.baseline_wacc) + n(c.wacc_delta);
  if (c.inventory_days_delta !== undefined)
    stressed.changes.inventory_days =
      n(stressed.changes.inventory_days, MODEL_ASSUMPTIONS.inventory.baseline_days) +
      n(c.inventory_days_delta);
  if (c.tax_mode) stressed.changes.tax_mode = c.tax_mode;
  if (c.tax_regime) stressed.changes.tax_regime = c.tax_regime;
  stressed.metadata = {
    ...(stressed.metadata || {}),
    phase: 5,
    stress_case_id: stressCase.case_id,
    stress_case_name: stressCase.name,
  };
  return stressed;
}
export function runStressTests({
  companyId,
  selectedScenario,
  baselineBundle,
  baselineResult = null,
  stressCases = null,
} = {}) {
  const baseTotal = n(
    baselineResult?.total_with_tax ?? baselineBundle?.costs?.costs?.total_with_tax
  );
  const cases = stressCases || buildStressCaseLibrary({ companyId }).stress_cases;
  const stress_results = [];
  const warnings = [];
  for (const stressCase of cases) {
    const stressedScenario = applyStressCaseToScenario({ scenario: selectedScenario, stressCase });
    const result = runScenario({ companyId, scenario: stressedScenario, baselineBundle });
    const totalWithTax = n(result.total_with_tax);
    const savingAbs = baseTotal - totalWithTax;
    const savingPct = baseTotal ? (savingAbs / baseTotal) * 100 : 0;
    const stillBetter = totalWithTax <= baseTotal;
    const caseWarnings = [...(result.warnings || [])];
    if (!stillBetter) caseWarnings.push('Saving ficou negativo neste caso de stress.');
    stress_results.push({
      case_id: stressCase.case_id,
      case_name: stressCase.name,
      scenario_id: selectedScenario?.scenario_id,
      stressed_scenario_id: stressedScenario.scenario_id,
      total_with_tax: totalWithTax,
      total_logistics_cost: n(result.costs?.total_logistics_cost),
      tax_impact: n(result.tax_results?.total_tax_impact),
      saving_vs_baseline: savingAbs,
      saving_pct: savingPct,
      scenario_still_better_than_baseline: stillBetter,
      warnings: caseWarnings,
      errors: result.errors || [],
    });
  }
  const cases_positive = stress_results.filter((r) => r.scenario_still_better_than_baseline).length;
  const cases_negative = stress_results.length - cases_positive;
  return {
    company_id: companyId,
    scenario_id: selectedScenario?.scenario_id,
    baseline_total_with_tax: baseTotal,
    comparison_basis: baselineResult ? 'same_tax_regime' : 'bundle_baseline',
    stress_results,
    summary: { cases_run: stress_results.length, cases_positive, cases_negative },
    warnings,
    errors: [],
  };
}

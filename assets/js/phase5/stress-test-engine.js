import { runScenario } from '../phase3/scenario-simulator.js';
import { compareScenarios } from '../phase3/scenario-comparator.js';
import { buildStressCaseLibrary } from './stress-case-library.js';
function clone(obj) { return JSON.parse(JSON.stringify(obj || {})); }
function n(v, d = 0) { const x = Number(v); return Number.isFinite(x) ? x : d; }
export function applyStressCaseToScenario({ scenario, stressCase }) {
  const stressed = clone(scenario);
  stressed.scenario_id = `${scenario.scenario_id || 'scenario'}__stress_${stressCase.case_id}`;
  stressed.scenario_name = `${scenario.scenario_name || scenario.scenario_id || 'Cenário'} · ${stressCase.name}`;
  stressed.changes = { ...(scenario.changes || {}) };
  const c = stressCase.changes || {};
  if (c.freight_multiplier_delta !== undefined) stressed.changes.freight_multiplier = n(stressed.changes.freight_multiplier, 1) * (1 + n(c.freight_multiplier_delta));
  if (c.demand_multiplier_delta !== undefined) stressed.changes.demand_multiplier = n(stressed.changes.demand_multiplier, 1) * (1 + n(c.demand_multiplier_delta));
  if (c.wacc_delta !== undefined) stressed.changes.wacc = n(stressed.changes.wacc, 0.15) + n(c.wacc_delta);
  if (c.inventory_days_delta !== undefined) stressed.changes.inventory_days = n(stressed.changes.inventory_days, 45) + n(c.inventory_days_delta);
  if (c.tax_mode) stressed.changes.tax_mode = c.tax_mode;
  if (c.tax_regime) stressed.changes.tax_regime = c.tax_regime;
  stressed.metadata = { ...(stressed.metadata || {}), phase: 5, stress_case_id: stressCase.case_id, stress_case_name: stressCase.name };
  return stressed;
}
export function runStressTests({ companyId, selectedScenario, baselineBundle, baselineResult = null, stressCases = null } = {}) {
  const baseTotal = n(baselineResult?.total_with_tax ?? baselineBundle?.costs?.costs?.total_with_tax);
  const cases = stressCases || buildStressCaseLibrary({ companyId }).stress_cases;
  const stress_results = [];
  const warnings = [];
  for (const stressCase of cases) {
    const stressedScenario = applyStressCaseToScenario({ scenario: selectedScenario, stressCase });
    const result = runScenario({ companyId, scenario: stressedScenario, baselineBundle });
    const comparison = compareScenarios({ companyId, baselineResult: { scenario_id: baselineBundle?.model?.scenario_id, total_with_tax: baseTotal }, scenarioResults: [result] });
    const row = comparison.comparison?.[0] || {};
    const stillBetter = n(result.total_with_tax) <= baseTotal;
    const caseWarnings = [...(result.warnings || [])];
    if (!stillBetter) caseWarnings.push('Saving ficou negativo neste caso de stress.');
    stress_results.push({
      case_id: stressCase.case_id,
      case_name: stressCase.name,
      scenario_id: selectedScenario?.scenario_id,
      stressed_scenario_id: stressedScenario.scenario_id,
      total_with_tax: n(result.total_with_tax),
      total_logistics_cost: n(result.costs?.total_logistics_cost),
      tax_impact: n(result.tax_results?.total_tax_impact),
      saving_vs_baseline: n(row.saving_abs ?? (baseTotal - result.total_with_tax)),
      saving_pct: n(row.saving_pct),
      scenario_still_better_than_baseline: stillBetter,
      warnings: caseWarnings,
      errors: result.errors || []
    });
  }
  const cases_positive = stress_results.filter(r => r.scenario_still_better_than_baseline).length;
  const cases_negative = stress_results.length - cases_positive;
  return { company_id: companyId, scenario_id: selectedScenario?.scenario_id, stress_results, summary: { cases_run: stress_results.length, cases_positive, cases_negative }, warnings, errors: [] };
}

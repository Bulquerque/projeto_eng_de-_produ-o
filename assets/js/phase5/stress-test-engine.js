import { runScenario } from '../phase3/scenario-simulator.js';
import { buildStressCaseLibrary } from './stress-case-library.js';
import { safeNumber } from '../core/common.js';
import { calculateSaving, MODEL_DEFAULTS } from '../core/model-configuration.js';
function clone(obj) {
  return JSON.parse(JSON.stringify(obj || {}));
}
export function applyStressCaseToScenario({ scenario, stressCase }) {
  const stressed = clone(scenario);
  stressed.scenario_id = `${scenario.scenario_id || 'scenario'}__stress_${stressCase.case_id}`;
  stressed.scenario_name = `${scenario.scenario_name || scenario.scenario_id || 'Cenário'} · ${stressCase.name}`;
  stressed.changes = { ...(scenario.changes || {}) };
  const c = stressCase.changes || {};
  if (c.freight_multiplier_delta !== undefined)
    stressed.changes.freight_multiplier =
      safeNumber(stressed.changes.freight_multiplier, 1) *
      (1 + safeNumber(c.freight_multiplier_delta));
  if (c.demand_multiplier_delta !== undefined)
    stressed.changes.demand_multiplier =
      safeNumber(stressed.changes.demand_multiplier, 1) *
      (1 + safeNumber(c.demand_multiplier_delta));
  if (c.wacc_delta !== undefined)
    stressed.changes.wacc =
      safeNumber(stressed.changes.wacc, MODEL_DEFAULTS.reference_wacc) + safeNumber(c.wacc_delta);
  if (c.inventory_days_delta !== undefined)
    stressed.changes.inventory_days =
      safeNumber(stressed.changes.inventory_days, MODEL_DEFAULTS.inventory_days) +
      safeNumber(c.inventory_days_delta);
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
  const baseTotal = safeNumber(
    baselineResult?.total_with_tax ?? baselineBundle?.costs?.costs?.total_with_tax
  );
  const cases = stressCases || buildStressCaseLibrary({ companyId }).stress_cases;
  const stress_results = [];
  const warnings = [];
  for (const stressCase of cases) {
    const stressedScenario = applyStressCaseToScenario({ scenario: selectedScenario, stressCase });
    const result = runScenario({ companyId, scenario: stressedScenario, baselineBundle });
    const validResult =
      result.simulation_status === 'success' && Number.isFinite(Number(result.total_with_tax));
    if (!validResult) {
      const caseWarnings = [
        ...(result.warnings || []),
        'Caso de stress bloqueado: o cenário não produziu um resultado determinístico válido.',
      ];
      warnings.push(`${stressCase.case_id}: resultado inválido ou bloqueado.`);
      stress_results.push({
        case_id: stressCase.case_id,
        case_name: stressCase.name,
        scenario_id: selectedScenario?.scenario_id,
        stressed_scenario_id: stressedScenario.scenario_id,
        status: 'blocked',
        total_with_tax: null,
        total_logistics_cost: null,
        tax_impact: null,
        saving_vs_baseline: null,
        saving_pct: null,
        scenario_still_better_than_baseline: null,
        warnings: caseWarnings,
        errors: result.errors || ['resultado de stress inválido'],
      });
      continue;
    }
    const stillBetter = safeNumber(result.total_with_tax) <= baseTotal;
    const saving = calculateSaving({
      baselineTotal: baseTotal,
      scenarioTotal: result.total_with_tax,
    });
    const caseWarnings = [...(result.warnings || [])];
    if (!stillBetter) caseWarnings.push('Saving ficou negativo neste caso de stress.');
    stress_results.push({
      case_id: stressCase.case_id,
      case_name: stressCase.name,
      scenario_id: selectedScenario?.scenario_id,
      stressed_scenario_id: stressedScenario.scenario_id,
      status: 'success',
      total_with_tax: safeNumber(result.total_with_tax),
      total_logistics_cost: safeNumber(result.costs?.total_logistics_cost),
      tax_impact: safeNumber(result.tax_results?.total_tax_impact),
      saving_vs_baseline: saving.saving_abs,
      saving_pct: saving.saving_pct,
      scenario_still_better_than_baseline: stillBetter,
      warnings: caseWarnings,
      errors: result.errors || [],
    });
  }
  const validResults = stress_results.filter((r) => r.status === 'success');
  const cases_positive = validResults.filter((r) => r.scenario_still_better_than_baseline).length;
  const cases_negative = validResults.length - cases_positive;
  const cases_blocked = stress_results.length - validResults.length;
  return {
    company_id: companyId,
    scenario_id: selectedScenario?.scenario_id,
    stress_results,
    summary: {
      cases_run: stress_results.length,
      cases_evaluated: validResults.length,
      cases_positive,
      cases_negative,
      cases_blocked,
      status: cases_blocked ? 'inconclusive' : 'complete',
    },
    warnings,
    errors: [],
  };
}

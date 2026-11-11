import { runScenario } from '../phase3/scenario-simulator.js';
import { buildStressCaseLibrary } from './stress-case-library.js';
import { safeNumber } from '../core/common.js';
import { calculateSaving, getCompanyModelDefaults } from '../core/model-configuration.js';
import { isNumericallyUsableScenarioResult } from '../core/analysis-quality.js';
import { buildPhysicalComparisonBaseline } from './physical-comparison.js';
import { resolveTaxModeForRegime, resolveTaxRegime } from '../core/tax-reform-config.js';
function clone(obj) {
  return JSON.parse(JSON.stringify(obj || {}));
}
export function runStressTests({
  companyId,
  selectedScenario,
  baselineBundle,
  stressCases = null,
} = {}) {
  const reference = buildPhysicalComparisonBaseline({
    companyId,
    baselineBundle,
    selectedScenario,
  });
  const cases = stressCases || buildStressCaseLibrary({ companyId }).stress_cases;
  const stress_results = [];
  const warnings = [];
  for (const stressCase of cases) {
    const stressedScenario = applyStressCaseToScenario({
      companyId,
      scenario: selectedScenario,
      stressCase,
      baselineBundle,
    });
    const fiscalChanges = stressCase.changes || {};
    const caseReference =
      fiscalChanges.tax_mode || fiscalChanges.tax_regime || fiscalChanges.tax_year != null
        ? buildPhysicalComparisonBaseline({
            companyId,
            baselineBundle,
            selectedScenario: stressedScenario,
          })
        : reference;
    const baseTotal = caseReference?.total_with_tax ?? null;
    const result = runScenario({
      companyId,
      scenario: stressedScenario,
      baselineBundle,
      baselineMode: 'physical_unanchored',
    });
    const taxLimited =
      result.calculation_status === 'success_with_tax_limits' ||
      result.tax_results?.tax_coverage?.coverage_limited === true ||
      result.tax_results?.tax_coverage?.blocked === true;
    const validResult = isNumericallyUsableScenarioResult(result);
    if (!validResult || baseTotal == null) {
      const caseWarnings = [
        ...(result.warnings || []),
        baseTotal == null
          ? 'Baseline físico indisponível para comparação.'
          : 'Caso de stress bloqueado: o cenário não produziu um resultado determinístico válido.',
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
        errors:
          baseTotal == null
            ? [...(result.errors || []), 'baseline físico indisponível para comparação']
            : result.errors?.length
              ? result.errors
              : ['resultado de stress inválido'],
      });
      continue;
    }
    const stillBetter = safeNumber(result.total_with_tax) <= baseTotal;
    const saving = calculateSaving({
      baselineTotal: baseTotal,
      scenarioTotal: result.total_with_tax,
    });
    const caseWarnings = [...(result.warnings || [])];
    if (taxLimited)
      caseWarnings.push(
        'Caso calculado com cobertura fiscal parcial; comparação entregue para uso exploratório.'
      );
    if (!stillBetter) caseWarnings.push('Saving ficou negativo neste caso de stress.');
    stress_results.push({
      case_id: stressCase.case_id,
      case_name: stressCase.name,
      scenario_id: selectedScenario?.scenario_id,
      stressed_scenario_id: stressedScenario.scenario_id,
      status: 'success',
      data_quality_status: taxLimited ? 'limited_fiscal_coverage' : 'complete',
      decision_use: 'exploratory_only',
      total_with_tax: safeNumber(result.total_with_tax),
      total_logistics_cost: safeNumber(result.costs?.total_logistics_cost),
      tax_impact: safeNumber(result.tax_results?.total_tax_impact),
      baseline_total_with_tax: baseTotal,
      baseline_tax_regime: caseReference?.tax_results?.tax_regime ?? null,
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
  const cases_limited = validResults.filter(
    (result) => result.data_quality_status === 'limited_fiscal_coverage'
  ).length;
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
      cases_limited,
      status: cases_blocked
        ? 'inconclusive'
        : cases_limited
          ? 'complete_with_warnings'
          : 'complete',
    },
    warnings,
    errors: [],
  };
}

export function applyStressCaseToScenario({ companyId, scenario, stressCase, baselineBundle }) {
  const defaults = getCompanyModelDefaults(companyId || scenario?.company_id, baselineBundle);
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
      safeNumber(stressed.changes.wacc, defaults.reference_wacc) + safeNumber(c.wacc_delta);
  if (c.inventory_days_delta !== undefined)
    stressed.changes.inventory_days =
      safeNumber(stressed.changes.inventory_days, defaults.inventory_days) +
      safeNumber(c.inventory_days_delta);
  if (c.tax_mode || c.tax_regime || c.tax_year != null) {
    const regime = resolveTaxRegime({
      taxMode: c.tax_mode,
      taxRegime: c.tax_regime,
      year: c.tax_year,
    });
    stressed.changes.tax_mode = c.tax_mode || resolveTaxModeForRegime(regime);
    stressed.changes.tax_regime = regime;
    if (c.tax_year != null) stressed.changes.tax_year = c.tax_year;
    else delete stressed.changes.tax_year;
  }
  stressed.metadata = {
    ...(stressed.metadata || {}),
    phase: 5,
    stress_case_id: stressCase.case_id,
    stress_case_name: stressCase.name,
  };
  return stressed;
}

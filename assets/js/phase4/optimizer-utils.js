import { buildScenarioFromForm } from '../phase3/scenario-builder.js';
import { resolveTaxRegime } from '../shared/tax-reform-config.js';
import { MODEL_ASSUMPTIONS } from '../shared/model-assumptions.js';

export const SUPPORTED_METHOD = 'exact_discrete';
const RISK_ORDER = { low: 1, baixo: 1, medium: 2, medio: 2, médio: 2, high: 3, alto: 3 };

export function n(v, d = 0) {
  if (v == null || (typeof v === 'string' && !v.trim())) return d;
  const x = Number(v);
  return Number.isFinite(x) ? x : d;
}

export function riskVal(v) {
  return RISK_ORDER[String(v || 'medium').toLowerCase()] || 2;
}

export function compareExactRanking(a, b) {
  const scoreDiff = n(b.final_score) - n(a.final_score);
  if (scoreDiff) return scoreDiff;

  const totalA = n(a.result?.total_with_tax, Number.POSITIVE_INFINITY);
  const totalB = n(b.result?.total_with_tax, Number.POSITIVE_INFINITY);
  if (totalA !== totalB) return totalA - totalB;

  const riskDiff = riskVal(a.quality?.risk_level) - riskVal(b.quality?.risk_level);
  if (riskDiff) return riskDiff;

  const qualityDiff = n(b.quality?.quality_score) - n(a.quality?.quality_score);
  if (qualityDiff) return qualityDiff;

  return String(a.scenario_id || '').localeCompare(String(b.scenario_id || ''));
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function uniqueByChanges(list) {
  const seen = new Set();
  const out = [];
  for (const item of list) {
    const key = JSON.stringify(item?.scenario?.changes || item?.changes || {});
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function emptyCollections() {
  return {
    scenario_metrics: [],
    normalized_metrics: [],
    warnings: [],
    errors: [],
  };
}

export function buildBaselineScenario(
  companyId,
  baselineBundle,
  { taxMode = 'current', taxRegime = null } = {}
) {
  const base = baselineBundle?.model || {};
  const resolvedTaxRegime = resolveTaxRegime({ taxMode, taxRegime });
  return buildScenarioFromForm({
    companyId,
    baselineBundle,
    scenarioId: `${base.scenario_id || `${companyId}_baseline`}__${resolvedTaxRegime}_reference`,
    formValues: {
      scenario_name: 'Baseline comparável',
      active_cds: base.active_cds || [],
      freight_multiplier: 1,
      demand_multiplier: 1,
      inventory_days: MODEL_ASSUMPTIONS.inventory.baseline_days,
      wacc: MODEL_ASSUMPTIONS.inventory.baseline_wacc,
      tax_mode: taxMode,
      tax_regime: resolvedTaxRegime,
      reallocation_rule: 'nearest_available_cd',
      scenario_type: 'comparison_baseline',
    },
  });
}

export function attachBaselineReference(result, baselineResult) {
  const baselineTotal = n(baselineResult?.total_with_tax);
  const scenarioTotal = n(result?.total_with_tax);
  const savingAbs = baselineTotal - scenarioTotal;
  const transferSensitivity = result?.costs?.transfer_proxy_sensitivity;
  const costs = transferSensitivity
    ? {
        ...result.costs,
        transfer_proxy_sensitivity: {
          ...transferSensitivity,
          points: (transferSensitivity.points || []).map((point) => {
            const totalWithTax = scenarioTotal + n(point.delta_from_reference);
            const pointSavingAbs = baselineTotal - totalWithTax;
            return {
              ...point,
              total_with_tax: totalWithTax,
              saving_abs: pointSavingAbs,
              saving_pct: baselineTotal ? (pointSavingAbs / baselineTotal) * 100 : null,
            };
          }),
        },
      }
    : result?.costs;

  return {
    ...result,
    costs,
    baseline_total: baselineTotal,
    saving_abs: savingAbs,
    saving_pct: baselineTotal ? (savingAbs / baselineTotal) * 100 : null,
    comparison_basis: 'same_tax_regime',
    baseline_reference: {
      scenario_id: baselineResult?.scenario_id || null,
      total_with_tax: baselineTotal,
      tax_mode:
        baselineResult?.tax_results?.tax_mode ||
        baselineResult?.scenario?.changes?.tax_mode ||
        null,
      tax_regime:
        baselineResult?.tax_results?.tax_regime ||
        baselineResult?.scenario?.changes?.tax_regime ||
        null,
    },
  };
}

export function buildFailureResult({ companyId, searchLog, errors = [], warnings = [] }) {
  return {
    company_id: companyId,
    optimizer_status: 'error',
    search_strategy: 'broad_then_refine',
    best_scenarios: [],
    best_by_total_cost: null,
    scored_scenarios: [],
    scenario_records: [],
    metrics: emptyCollections(),
    normalized: emptyCollections(),
    search_log: searchLog,
    warnings,
    errors,
  };
}

export function buildSearchLog({
  searchStrategy = 'broad_then_refine',
  methodRequested,
  methodApplied,
  generatedCandidates = 0,
  simulatedCandidates = 0,
  validCandidates = 0,
  invalidCandidates = 0,
  candidateSpaceSize = 0,
  coverageRatio = 0,
  refinementRounds = 0,
  refinementSeedCount = 0,
  refinementCandidatesGenerated = 0,
  refinementCandidatesSimulated = 0,
  bestScore = null,
  bestScenarioId = null,
  bestByTotalCostScenarioId = null,
  bestByTotalCostValue = null,
  exactSearchSpace = true,
  spaceLimited = false,
  invalidReasons = [],
}) {
  return {
    search_strategy: searchStrategy,
    method_requested: methodRequested,
    method_applied: methodApplied,
    generated_candidates: generatedCandidates,
    simulated_candidates: simulatedCandidates,
    valid_candidates: validCandidates,
    invalid_candidates: invalidCandidates,
    candidate_space_size: candidateSpaceSize,
    coverage_ratio: coverageRatio,
    refinement_rounds: refinementRounds,
    refinement_seed_count: refinementSeedCount,
    refinement_candidates_generated: refinementCandidatesGenerated,
    refinement_candidates_simulated: refinementCandidatesSimulated,
    best_score: bestScore,
    best_scenario_id: bestScenarioId,
    best_by_total_cost_scenario_id: bestByTotalCostScenarioId,
    best_by_total_cost_value: bestByTotalCostValue,
    exact_search_space: exactSearchSpace,
    space_limited: spaceLimited,
    invalid_reasons: invalidReasons,
  };
}

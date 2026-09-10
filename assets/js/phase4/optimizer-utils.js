import { buildScenarioFromForm } from '../phase3/scenario-builder.js';
import { resolveTaxRegime } from '../core/tax-reform-config.js';
import { safeNumber } from '../core/common.js';
import { MODEL_DEFAULTS } from '../core/model-configuration.js';

export const SUPPORTED_METHOD = 'exact_discrete';
export const RISK_LEVELS = Object.freeze({
  low: 1,
  baixo: 1,
  medium: 2,
  medio: 2,
  médio: 2,
  high: 3,
  alto: 3,
});
export const SUPPORTED_RISK_LEVELS = Object.freeze(Object.keys(RISK_LEVELS));

export function riskVal(v) {
  return RISK_LEVELS[String(v || 'medium').toLowerCase()] || RISK_LEVELS.medium;
}

export function compareExactRanking(a, b) {
  const scoreDiff = safeNumber(b.final_score) - safeNumber(a.final_score);
  if (scoreDiff) return scoreDiff;

  const totalA = safeNumber(a.result?.total_with_tax, Number.POSITIVE_INFINITY);
  const totalB = safeNumber(b.result?.total_with_tax, Number.POSITIVE_INFINITY);
  if (totalA !== totalB) return totalA - totalB;

  const riskDiff = riskVal(a.quality?.risk_level) - riskVal(b.quality?.risk_level);
  if (riskDiff) return riskDiff;

  const qualityDiff = safeNumber(b.quality?.quality_score) - safeNumber(a.quality?.quality_score);
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
    const changes = item?.scenario?.changes || item?.changes || {};
    const key = scenarioChangesKey(changes);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])])
  );
}

export function scenarioChangesKey(changes = {}) {
  return JSON.stringify(
    stableValue({
      ...changes,
      active_cds: Array.isArray(changes.active_cds)
        ? [...new Set(changes.active_cds.map(String))].sort()
        : changes.active_cds,
      closed_cds: Array.isArray(changes.closed_cds)
        ? [...new Set(changes.closed_cds.map(String))].sort()
        : changes.closed_cds,
    })
  );
}

export function emptyCollections() {
  return {
    scenario_metrics: [],
    normalized_metrics: [],
    warnings: [],
    errors: [],
  };
}

export function buildBaselineScenario(companyId, baselineBundle) {
  const base = baselineBundle?.model || {};
  return buildScenarioFromForm({
    companyId,
    baselineBundle,
    scenarioId: base.scenario_id || `${companyId}_baseline`,
    formValues: {
      scenario_name: 'Baseline',
      active_cds: base.active_cds || [],
      freight_multiplier: 1,
      demand_multiplier: 1,
      inventory_days: MODEL_DEFAULTS.inventory_days,
      wacc: MODEL_DEFAULTS.reference_wacc,
      tax_mode: 'current',
      tax_regime: resolveTaxRegime({ taxMode: 'current' }),
      reallocation_rule: 'nearest_available_cd',
      scenario_type: 'baseline',
    },
  });
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
  dataQualityStatus = null,
  limitedFiscalCandidates = null,
  exactSearchSpace = true,
  exactnessReason = null,
  spaceLimited = false,
  invalidReasons = [],
  seed = null,
}) {
  return {
    search_strategy: searchStrategy,
    method_requested: methodRequested,
    method_applied: methodApplied,
    seed,
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
    data_quality_status: dataQualityStatus,
    limited_fiscal_candidates: limitedFiscalCandidates,
    exact_search_space: exactSearchSpace,
    exactness_reason: exactnessReason,
    space_limited: spaceLimited,
    invalid_reasons: invalidReasons,
  };
}

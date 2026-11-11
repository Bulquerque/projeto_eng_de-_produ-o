import { buildScenarioFromForm } from '../phase3/scenario-builder.js';
import { resolveTaxModeForRegime, resolveTaxRegime } from '../core/tax-reform-config.js';
import { safeNumber } from '../core/common.js';
import { getCompanyModelDefaults } from '../core/model-configuration.js';

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

function sameDomainValue(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

export function isScenarioWithinDeclaredSearchSpace(scenario, domain = {}) {
  const changes = scenario?.scenario?.changes || scenario?.changes || {};
  const activeCds = Array.isArray(changes.active_cds)
    ? [...new Set(changes.active_cds.map(String))]
    : [];
  const declaredCds = new Set((domain.active_cd_ids || []).map(String));
  if (!activeCds.length || activeCds.some((cd) => !declaredCds.has(cd))) return false;

  const activeSet = new Set(activeCds);
  const expectedClosedCds = (domain.active_cd_ids || [])
    .map(String)
    .filter((cd) => !activeSet.has(cd))
    .sort();
  const actualClosedCds = Array.isArray(changes.closed_cds)
    ? [...new Set(changes.closed_cds.map(String))].sort()
    : [];
  if (!sameDomainValue(actualClosedCds, expectedClosedCds)) return false;

  const dimensions = domain.dimensions || {};
  const fields = [
    ['freight_multiplier', 'freight_multipliers'],
    ['demand_multiplier', 'demand_multipliers'],
    ['inventory_days', 'inventory_days_options'],
    ['tax_mode', 'tax_modes'],
  ];
  for (const [field, domainField] of fields) {
    if (!(dimensions[domainField] || []).some((value) => sameDomainValue(value, changes[field])))
      return false;
  }

  const fixed = domain.fixed_changes || {};
  for (const field of ['wacc', 'tax_regime', 'tax_year', 'reallocation_rule']) {
    if (!sameDomainValue(fixed[field], changes[field])) return false;
  }
  return true;
}

export function classifyRefinementCandidates({
  candidates = [],
  baseScenarioKeys = new Set(),
  domain = {},
  baseCandidateSpaceSize = 0,
} = {}) {
  const uniqueCandidates = uniqueByChanges(candidates);
  const newToCatalog = uniqueCandidates.filter(
    (candidate) =>
      !baseScenarioKeys.has(
        scenarioChangesKey(candidate?.changes || candidate?.scenario?.changes || {})
      )
  );
  const withinDeclaredSpace = newToCatalog.filter((candidate) =>
    isScenarioWithinDeclaredSearchSpace(candidate, domain)
  );
  return {
    uniqueCandidateCount: uniqueCandidates.length,
    newToCatalogCount: newToCatalog.length,
    withinDeclaredSpaceCount: withinDeclaredSpace.length,
    outsideDeclaredSpaceCount: newToCatalog.length - withinDeclaredSpace.length,
    candidateSpaceSize:
      Number(baseCandidateSpaceSize) + (newToCatalog.length - withinDeclaredSpace.length),
  };
}

export function emptyCollections() {
  return {
    scenario_metrics: [],
    normalized_metrics: [],
    warnings: [],
    errors: [],
  };
}

export function buildBaselineScenario(companyId, baselineBundle, taxContext = {}) {
  const base = baselineBundle?.model || {};
  const modelDefaults = getCompanyModelDefaults(companyId, baselineBundle);
  const hasTaxContext = Boolean(
    taxContext.tax_mode || taxContext.tax_regime || taxContext.tax_year != null
  );
  const taxRegime = hasTaxContext
    ? resolveTaxRegime({
        taxMode: taxContext.tax_mode,
        taxRegime: taxContext.tax_regime,
        year: taxContext.tax_year,
      })
    : resolveTaxRegime({ taxMode: 'current' });
  return buildScenarioFromForm({
    companyId,
    baselineBundle,
    scenarioId: base.scenario_id || `${companyId}_baseline`,
    formValues: {
      scenario_name: 'Baseline',
      active_cds: base.active_cds || [],
      freight_multiplier: 1,
      demand_multiplier: 1,
      inventory_days: modelDefaults.inventory_days,
      wacc: modelDefaults.reference_wacc,
      tax_mode: taxContext.tax_mode || resolveTaxModeForRegime(taxRegime),
      tax_regime: taxRegime,
      ...(taxContext.tax_year != null ? { tax_year: taxContext.tax_year } : {}),
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
  refinementCandidatesUnique = 0,
  refinementCandidatesNewToCatalog = 0,
  refinementCandidatesWithinDeclaredSpace = 0,
  refinementCandidatesOutsideDeclaredSpace = 0,
  baseCandidateSpaceSize = null,
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
    refinement_candidates_unique: refinementCandidatesUnique,
    refinement_candidates_new_to_catalog: refinementCandidatesNewToCatalog,
    refinement_candidates_within_declared_space: refinementCandidatesWithinDeclaredSpace,
    refinement_candidates_outside_declared_space: refinementCandidatesOutsideDeclaredSpace,
    base_candidate_space_size: baseCandidateSpaceSize,
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

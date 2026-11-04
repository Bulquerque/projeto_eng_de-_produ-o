import { DEFAULT_OBJECTIVE_PROFILES } from '../assets/js/phase4/objective-profile-library.js';
import { calculateSaving } from '../assets/js/core/model-configuration.js';
import { evaluateScenarioQuality } from '../assets/js/phase3/scenario-quality-check.js';

export const ACADEMIC_OPTIMIZER_CONFIG = Object.freeze({
  constraints: Object.freeze({
    min_active_cds: 1,
    max_active_cds: 999,
    max_cd_volume_share: 1,
    max_risk_level: 'high',
    allow_tax_disabled: true,
  }),
  optimizer: Object.freeze({
    method: 'exact_discrete',
    max_candidates: 5000,
    seed: 42,
  }),
});

export function getAcademicOptimizerProfiles() {
  return DEFAULT_OBJECTIVE_PROFILES.map((profile) => ({
    profile_id: profile.profile_id,
    profile_name: profile.profile_name,
    description: profile.description,
    weights: { ...profile.weights },
  }));
}

export function applyAcademicReallocationRule(scenario, companyId = 'empresa1') {
  return prepareAcademicReallocation(scenario, companyId).scenario;
}

export function prepareAcademicReallocation(scenario, companyId) {
  const sourceRule = scenario?.changes?.reallocation_rule ?? null;
  const effectiveRule =
    companyId === 'empresa1' ? 'lowest_freight_available_cd' : sourceRule || 'nearest_available_cd';
  return {
    scenario: {
      ...scenario,
      changes: {
        ...(scenario?.changes || {}),
        reallocation_rule: effectiveRule,
      },
    },
    source_reallocation_rule: sourceRule,
    effective_reallocation_rule: effectiveRule,
  };
}

export function buildScenarioExecutionEvidence(result = {}) {
  return {
    simulation_status: result.simulation_status ?? null,
    calculation_status: result.calculation_status ?? null,
    data_quality: result.data_quality ?? null,
    errors: result.errors || [],
    warnings: result.warnings || [],
    validation: result.validation || null,
  };
}

export function buildScenarioQualityEvidence(result, baselineBundle) {
  if (result?.simulation_status !== 'success' || result?.errors?.length) return null;
  return evaluateScenarioQuality({ scenarioResult: result, baselineBundle });
}

export function buildMonteCarloExecutionEvidence(result = {}) {
  return {
    monte_carlo_status: result.monte_carlo_status ?? null,
    errors: result.errors || [],
    warnings: result.warnings || [],
    summary: result.summary || null,
  };
}

export function buildOptimizerCompletenessEvidence(result = {}) {
  const searchLog = result.search_log || {};
  const exactSearchSpace = searchLog.exact_search_space === true;
  const invalidCandidates = normalizeEvidenceNumber(searchLog.invalid_candidates);
  const simulatedCandidates = normalizeEvidenceNumber(searchLog.simulated_candidates);
  const validCandidates = normalizeEvidenceNumber(searchLog.valid_candidates);
  const candidateSpaceSize = normalizeEvidenceNumber(searchLog.candidate_space_size);
  const countsKnown = [
    invalidCandidates,
    simulatedCandidates,
    validCandidates,
    candidateSpaceSize,
  ].every((value) => value != null);
  const searchComplete =
    exactSearchSpace &&
    countsKnown &&
    invalidCandidates === 0 &&
    validCandidates > 0 &&
    candidateSpaceSize > 0 &&
    simulatedCandidates >= candidateSpaceSize &&
    searchLog.space_limited !== true;
  const completenessReason = !exactSearchSpace
    ? (searchLog.exactness_reason ?? 'O espaço declarado não foi enumerado integralmente.')
    : !countsKnown
      ? 'A busca não registrou contagens suficientes para confirmar a completude.'
      : invalidCandidates > 0
        ? 'Um ou mais candidatos não foram avaliados com sucesso.'
        : validCandidates === 0
          ? 'Nenhum candidato válido foi avaliado.'
          : simulatedCandidates < candidateSpaceSize
            ? 'A quantidade simulada é menor que o espaço candidato declarado.'
            : searchLog.space_limited === true
              ? 'A busca foi limitada pelo espaço configurado.'
              : (searchLog.exactness_reason ?? 'Busca concluída no espaço declarado.');
  return {
    exact_search_space: exactSearchSpace,
    search_complete: searchComplete,
    completeness_reason: completenessReason,
    result_scope: result.result_scope ?? null,
    exactness_reason: searchLog.exactness_reason ?? null,
    space_limited: searchLog.space_limited ?? !exactSearchSpace,
    candidate_space_size: searchLog.candidate_space_size ?? null,
    simulated_candidates: searchLog.simulated_candidates ?? null,
    valid_candidates: searchLog.valid_candidates ?? null,
    invalid_candidates: searchLog.invalid_candidates ?? null,
    coverage_ratio: searchLog.coverage_ratio ?? null,
  };
}

export function normalizeEvidenceNumber(value) {
  if (
    value == null ||
    typeof value === 'boolean' ||
    (typeof value === 'string' && value.trim() === '')
  )
    return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function buildOptimizerBestEvidence(candidate = {}, baseline = {}) {
  const result = candidate.result || {};
  const scenarioTotal = normalizeEvidenceNumber(result.total_with_tax);
  return {
    scenario_id: candidate.scenario_id,
    scenario_name: candidate.scenario?.scenario_name,
    active_cds: candidate.scenario?.changes?.active_cds,
    simulation_status: result.simulation_status ?? null,
    score: candidate.final_score ?? null,
    total_with_tax: scenarioTotal,
    saving_pct: buildScenarioSavingEvidence(result, baseline),
    risk_level: candidate.quality?.risk_level,
  };
}

export function buildScenarioSavingEvidence(result = {}, baseline = {}) {
  const baselineTotal = normalizeEvidenceNumber(baseline.total_with_tax);
  const scenarioTotal = normalizeEvidenceNumber(result.total_with_tax);
  return baseline.simulation_status === 'success' &&
    !baseline.errors?.length &&
    result.simulation_status === 'success' &&
    !result.errors?.length &&
    baselineTotal > 0 &&
    scenarioTotal != null
    ? calculateSaving({ baselineTotal, scenarioTotal }).saving_pct
    : null;
}

export function compareInventoryCosts(oneCdResult, allCdsResult) {
  if (
    oneCdResult?.simulation_status !== 'success' ||
    allCdsResult?.simulation_status !== 'success'
  ) {
    return { equal_inventory_cost: null, comparison_status: 'not_comparable' };
  }
  const oneCdCost = normalizeEvidenceNumber(oneCdResult?.costs?.inventory_cost);
  const allCdsCost = normalizeEvidenceNumber(allCdsResult?.costs?.inventory_cost);
  if (oneCdCost == null || allCdsCost == null) {
    return { equal_inventory_cost: null, comparison_status: 'not_comparable' };
  }
  return {
    equal_inventory_cost: Math.abs(oneCdCost - allCdsCost) < 1e-8,
    comparison_status: 'compared',
  };
}

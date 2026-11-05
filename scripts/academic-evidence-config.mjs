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
export const ACADEMIC_EVIDENCE_SCHEMA_VERSION = '1.1.0';

function normalizeCdLabel(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const E1_ACADEMIC_SCENARIOS = Object.freeze([
  {
    scenario_id: 'e1_14_cds_sem_ribeirao_preto',
    scenario_name: 'E1 — 14 CDs sem Ribeirão Preto',
    exclude_label: 'ribeirao preto',
  },
  {
    scenario_id: 'e1_14_cds_sem_cajamar',
    scenario_name: 'E1 — 14 CDs sem Cajamar',
    exclude_label: 'cajamar',
  },
]);

/** Pure, data-in/data-out plan for reproducible E1 scenarios; does not run engines. */
export function buildAcademicScenarioPlan(companyId, baselineBundle = {}, baselineScenario = {}) {
  if (companyId !== 'empresa1')
    return {
      scenario_status: 'not_applicable',
      scenarios: [],
      reason: 'Cenários solicitados são específicos da E1.',
    };

  const activeCds = Array.isArray(baselineBundle?.model?.active_cds)
    ? [...baselineBundle.model.active_cds]
    : [];
  const baseChanges = baselineScenario?.changes || {};
  const makeEntry = (definition, selectedCds, reason = null) => ({
    scenario_id: definition.scenario_id,
    scenario_name: definition.scenario_name,
    status: reason ? 'not_reproducible' : 'ready',
    reason,
    changes: reason
      ? null
      : {
          ...baseChanges,
          active_cds: selectedCds,
          freight_multiplier: 1,
        },
  });
  const scenarios = E1_ACADEMIC_SCENARIOS.map((definition) => {
    const matches = activeCds.filter((cd) =>
      normalizeCdLabel(cd).includes(definition.exclude_label)
    );
    if (activeCds.length !== 15)
      return makeEntry(
        definition,
        [],
        `A fonte deve conter exatamente 15 CDs ativos; encontrados ${activeCds.length}.`
      );
    if (matches.length !== 1)
      return makeEntry(
        definition,
        [],
        `Era esperado exatamente um CD correspondente a ${definition.exclude_label}; encontrados ${matches.length}.`
      );
    return makeEntry(
      definition,
      activeCds.filter((cd) => cd !== matches[0])
    );
  });

  if (activeCds.length !== 15) {
    scenarios.push({
      scenario_id: 'e1_cd_unico',
      scenario_name: 'E1 — um CD por rodada; frete ×1,0',
      status: 'not_reproducible',
      reason: `A fonte deve conter exatamente 15 CDs ativos; encontrados ${activeCds.length}.`,
      changes: null,
    });
  } else {
    activeCds.forEach((cd, index) =>
      scenarios.push({
        scenario_id: `e1_cd_unico_${String(index + 1).padStart(2, '0')}`,
        scenario_name: `E1 — CD único: ${cd}; frete ×1,0`,
        status: 'ready',
        reason: null,
        changes: { ...baseChanges, active_cds: [cd], freight_multiplier: 1 },
      })
    );
  }
  return {
    scenario_status: scenarios.every((scenario) => scenario.status === 'ready')
      ? 'ready'
      : 'partial',
    scenarios,
  };
}

/** Scenario N is only reproducible when the source explicitly includes a flow-to-CD mapping. */
export function buildScenarioNAvailabilityEvidence(scenario = {}) {
  const allocation = scenario.flow_to_cd_allocation ?? scenario.allocation?.flow_to_cd;
  const available =
    (Array.isArray(allocation) && allocation.length > 0) ||
    (allocation &&
      typeof allocation === 'object' &&
      !Array.isArray(allocation) &&
      Object.keys(allocation).length > 0);
  return {
    scenario_id: scenario.scenario_id ?? 'scenario_n',
    status: available ? 'allocation_available' : 'not_reproducible',
    execution_status: 'not_run_by_academic_evidence_generator',
    required_inputs: available ? [] : ['flow_to_cd_allocation'],
    reason: available
      ? null
      : 'A alocação de fluxo para CD não está presente na fonte; nenhuma alocação foi inferida.',
  };
}

export function buildAcademicScenarioEvidence({ plan, deterministic, monteCarlo } = {}) {
  return {
    scenario: plan ? { ...plan, changes: plan.changes ? { ...plan.changes } : null } : null,
    deterministic: deterministic ?? null,
    monte_carlo: {
      ...buildMonteCarloExecutionEvidence(monteCarlo),
      iterations: normalizeEvidenceNumber(monteCarlo?.iterations),
      seed: normalizeEvidenceNumber(monteCarlo?.seed),
      profile: monteCarlo?.config?.profile ?? null,
      scatter_driver: monteCarlo?.config?.scatter_driver ?? null,
      provenance: monteCarlo?.provenance ?? null,
      data_quality: monteCarlo?.data_quality ?? null,
    },
  };
}

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
  ].every((value) => Number.isSafeInteger(value) && value >= 0);
  const countsReconcile =
    countsKnown && validCandidates + invalidCandidates === simulatedCandidates;
  const searchComplete =
    exactSearchSpace &&
    countsKnown &&
    invalidCandidates === 0 &&
    validCandidates > 0 &&
    candidateSpaceSize > 0 &&
    simulatedCandidates === candidateSpaceSize &&
    countsReconcile &&
    searchLog.space_limited !== true;
  const completenessReason = !exactSearchSpace
    ? (searchLog.exactness_reason ?? 'O espaço declarado não foi enumerado integralmente.')
    : !countsKnown
      ? 'A busca não registrou contagens suficientes para confirmar a completude.'
      : !countsReconcile
        ? 'As contagens de candidatos simulados, válidos e inválidos não fecham.'
        : invalidCandidates > 0
          ? 'Um ou mais candidatos não foram avaliados com sucesso.'
          : validCandidates === 0
            ? 'Nenhum candidato válido foi avaliado.'
            : simulatedCandidates !== candidateSpaceSize
              ? 'A quantidade simulada difere do espaço candidato declarado.'
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
    !['number', 'string'].includes(typeof value) ||
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

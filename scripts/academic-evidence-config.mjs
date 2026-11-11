import { DEFAULT_OBJECTIVE_PROFILES } from '../assets/js/phase4/objective-profile-library.js';
import { calculateSaving } from '../assets/js/core/model-configuration.js';
import { evaluateScenarioQuality } from '../assets/js/phase3/scenario-quality-check.js';
import { listTaxModes } from '../assets/js/core/tax-reform-config.js';

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
export const ACADEMIC_EVIDENCE_SCHEMA_VERSION = '1.2.0';
const SAFE_SCENARIO_ID =
  /^(?:baseline|scenario_n|sample_\d{3}|scenario_plan_\d{3}|inventory_(?:one_cd|all_cds)|candidate_rank_\d{4})$/;
const TAX_MODE_ALLOWLIST = new Set(listTaxModes());
const MONTE_CARLO_ENUMS = Object.freeze({
  risk_band: new Set(['low', 'medium', 'high']),
  risk_band_policy: new Set(['project_monte_carlo_risk_v1']),
  decision_use: new Set(['decision_support', 'exploratory_only']),
  analysis_type: new Set(['empirical_uncertainty_analysis', 'exploratory_uncertainty_analysis']),
  uncertainty_source: new Set([
    'empirical_historical',
    'hybrid_empirical_parametric',
    'parametric_assumptions',
  ]),
  probability_interpretation: new Set([
    'conditional_on_available_history_and_model',
    'conditional_on_parametric_assumptions',
    'condicional_ao_historico_disponivel_e_ao_modelo',
    'condicional_as_premissas_parametricas',
  ]),
  scatter_driver: new Set([
    'freight_multiplier',
    'demand_multiplier',
    'inventory_days',
    'wacc',
    'tax_multiplier',
  ]),
  most_sensitive_driver: new Set([
    'freight_multiplier',
    'demand_multiplier',
    'inventory_days',
    'wacc',
    'tax_multiplier',
  ]),
});
const MONTE_CARLO_PROFILE_ALLOWLIST = new Set(['conservative', 'balanced', 'broad']);
const HISTORICAL_PROVENANCE_STATUS_ALLOWLIST = new Set([
  'declared',
  'missing_or_incomplete',
  'not_applicable',
]);

function projectEnum(value, allowed) {
  return typeof value === 'string' && allowed.has(value) ? value : null;
}

function projectSafeScenarioId(value) {
  return typeof value === 'string' && SAFE_SCENARIO_ID.test(value) ? value : null;
}

const COST_FIELDS = Object.freeze([
  'freight_cost',
  'transfer_cost',
  'distribution_cost',
  'storage_cost',
  'inventory_cost',
  'tax_impact',
  'total_logistics_cost',
  'total_with_tax',
]);
const FALLBACK_COUNT_FIELDS = Object.freeze([
  'missing_freight_rate',
  'revenue_fallback',
  'missing_transfer_distance',
  'transfer_fallback',
  'heuristic_fallback',
  'proportional_storage',
  'missing_cif_row',
  'missing_weight',
  'unknown_company',
]);
const FALLBACK_RATE_FIELDS = Object.freeze([
  'missing_freight_rate',
  'missing_cif_row',
  'missing_weight',
  'revenue_fallback',
  'missing_transfer_distance',
  'transfer_fallback',
]);
const DIAGNOSTIC_NUMBER_FIELDS = Object.freeze([
  'flow_count',
  'distribution_eligible_flow_count',
  'distribution_observed_flow_count',
  'distribution_observed_coverage',
  'distribution_unpriced_or_fallback_flow_count',
  'distribution_unpriced_or_fallback_rate',
]);
const MC_SUMMARY_NUMBER_FIELDS = Object.freeze([
  'iterations',
  'iterations_requested',
  'iterations_valid',
  'seed_effective',
  'mean_delta_cost_brl',
  'probability_tie',
  'p10_delta_cost',
  'p50_delta_cost',
  'p90_delta_cost',
  'invalid_sample_count',
  'baseline_total_with_tax',
  'deterministic_total_with_tax',
  'deterministic_saving_pct',
  'deterministic_percentile_saving_pct',
  'mean_total_with_tax',
  'median_total_with_tax',
  'p10_total_with_tax',
  'p90_total_with_tax',
  'mean_saving_pct',
  'median_saving_pct',
  'p10_saving_pct',
  'p90_saving_pct',
  'best_case_saving_pct',
  'worst_case_saving_pct',
  'probability_saving_positive',
  'probability_saving_loss',
  'probability_saving_strong_positive',
  'stddev_total_with_tax',
  'stddev_saving_pct',
  'monte_carlo_probability_positive_standard_error',
  'monte_carlo_probability_positive_lower_95',
  'monte_carlo_probability_positive_upper_95',
  'most_sensitive_driver_correlation',
  'historical_min_observations',
  'historical_joint_observations',
  'historical_complete_joint_observations',
  'historical_unique_joint_support',
  'historical_rejected_value_count',
  'effective_historical_sample_size',
]);

function safeNumberFields(source, fields) {
  return Object.fromEntries(
    fields
      .filter((field) => source?.[field] != null)
      .map((field) => [field, normalizeEvidenceNumber(source[field])])
  );
}

function safeCount(value) {
  return Array.isArray(value) ? value.length : value == null ? 0 : 1;
}

function projectDataQuality(value = {}) {
  value = value || {};
  const coverage = safeNumberFields(value.coverage, [
    'eligible_flow_count',
    'uncovered_flow_count',
    'missing_origin_uf_count',
    'complete_fiscal_flow_count',
    'complete_fiscal_coverage_ratio',
  ]);
  return {
    status: ['complete', 'limited_fiscal_coverage'].includes(value.status) ? value.status : null,
    decision_use: ['decision_support', 'exploratory_only'].includes(value.decision_use)
      ? value.decision_use
      : null,
    coverage_limited: typeof value.coverage_limited === 'boolean' ? value.coverage_limited : null,
    coverage,
  };
}

function projectDiagnostics(value = {}) {
  value = value || {};
  const counts = Object.fromEntries(
    FALLBACK_COUNT_FIELDS.map((key) => [
      key,
      normalizeEvidenceNumber(value.fallback_counts?.[key]) ?? 0,
    ])
  );
  const rates = safeNumberFields(value.fallback_rates, FALLBACK_RATE_FIELDS);
  const denominators = safeNumberFields(value.fallback_denominators, [
    'all_flows',
    'distribution',
    'transfer',
  ]);
  const events = safeNumberFields(value.fallback_event_counts, [
    'heuristic_fallback',
    'proportional_storage',
    'unknown_company',
  ]);
  return {
    ...safeNumberFields(value, DIAGNOSTIC_NUMBER_FIELDS),
    fallback_counts: counts,
    fallback_rates: rates,
    fallback_denominators: denominators,
    fallback_event_counts: events,
  };
}

function projectQuality(value = {}) {
  value = value || {};
  const metrics = safeNumberFields(value.quality_metrics, [
    'max_cd_volume_share',
    'reallocated_flow_share',
    'uncovered_flow_share',
    'cost_increase_pct',
  ]);
  return {
    quality_score: normalizeEvidenceNumber(value.quality_score),
    risk_level: ['low', 'medium', 'high'].includes(value.risk_level) ? value.risk_level : null,
    quality_metrics: metrics,
    evidence_score: normalizeEvidenceNumber(value.evidence_score),
    evidence_status: ['high', 'medium', 'low', 'insufficient', 'unknown'].includes(
      value.evidence_status
    )
      ? value.evidence_status
      : null,
    alert_count: safeCount(value.alerts),
  };
}

function projectCosts(value = {}) {
  const costs = safeNumberFields(value, COST_FIELDS);
  const method = typeof value.calculation_method === 'string' ? value.calculation_method : null;
  return {
    ...costs,
    calculation_method: method && /^[a-z0-9_]{1,80}$/i.test(method) ? method : null,
    diagnostics: projectDiagnostics(value.diagnostics),
  };
}

function projectValidation(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    valid: typeof value.valid === 'boolean' ? value.valid : null,
    error_count: safeCount(value.errors),
    warning_count: safeCount(value.warnings),
    checked_count: normalizeEvidenceNumber(
      value.checked_count ?? value.row_count ?? value.flow_count
    ),
  };
}

function projectMetricRows(rows = []) {
  const safeMetrics = new Set([
    'transfer_cost',
    'distribution_cost',
    'storage_cost',
    'inventory_cost',
    'tax_impact',
    'total_logistics_cost',
    'total_with_tax',
  ]);
  return Array.isArray(rows)
    ? rows.slice(0, 100).map((row, index) => ({
        metric: safeMetrics.has(row?.metric)
          ? row.metric
          : `metric_${String(index + 1).padStart(2, '0')}`,
        reference: normalizeEvidenceNumber(row?.reference),
        simulated: normalizeEvidenceNumber(row?.simulated),
        absolute_error: normalizeEvidenceNumber(row?.absolute_error),
        percentage_error: normalizeEvidenceNumber(row?.percentage_error),
        status: ['aligned', 'tolerable', 'divergent', 'pending'].includes(row?.status)
          ? row.status
          : 'unknown',
      }))
    : [];
}

function projectReconciliation(value = {}) {
  const taxSummary = value.tax?.summary || {};
  const taxNumbers = safeNumberFields(taxSummary, [
    'canonical_total',
    'matrix_total',
    'raw_matrix_total',
    'raw_difference',
    'raw_difference_pct',
    'difference_pct',
    'adjusted_total',
    'adjusted_difference_pct',
    'adjustment_factor',
    'matched_count',
    'unmatched_count',
    'excluded_count',
  ]);
  const operational = value.operational || {};
  const tax = value.tax || {};
  const overall = value.overall || {};
  const status = (entry) =>
    [
      'pending',
      'aligned',
      'partial',
      'within_tolerance',
      'divergent',
      'fully_reconciled',
      'partial_tax_divergence',
    ].includes(entry)
      ? entry
      : 'unknown';
  return {
    company_id: ['empresa1', 'empresa2'].includes(value.company_id) ? value.company_id : null,
    operational: {
      status: status(operational.status),
      rows: projectMetricRows(operational.rows),
      summary: safeNumberFields(operational.summary, [
        'compared_metrics',
        'missing_metrics',
        'mean_abs_error_pct',
        'max_abs_error_pct',
        'aligned_metrics',
        'tolerable_metrics',
        'divergent_metrics',
      ]),
      warning_count: safeCount(operational.warnings),
    },
    tax: {
      status: status(tax.status),
      summary: tax.summary ? taxNumbers : null,
      warning_count: safeCount(tax.warnings),
    },
    overall: { status: status(overall.status) },
    warning_count: safeCount(value.warnings),
  };
}

export function projectAcademicReconciliation(value = {}) {
  return projectReconciliation(value);
}

function projectMonteCarloSummary(value) {
  if (!value || typeof value !== 'object') return null;
  const summary = safeNumberFields(value, MC_SUMMARY_NUMBER_FIELDS);
  summary.rng_algorithm = value.rng_algorithm === 'mulberry32-v1' ? 'mulberry32-v1' : null;
  for (const [field, allowed] of Object.entries(MONTE_CARLO_ENUMS)) {
    const fieldValue =
      field === 'risk_band_policy' && value[field] && typeof value[field] === 'object'
        ? value[field].id
        : value[field];
    summary[field] = projectEnum(fieldValue, allowed);
  }
  for (const field of ['forecast', 'historical_distribution'])
    if (typeof value[field] === 'boolean') summary[field] = value[field];
  for (const field of ['histogram', 'percentile_curve', 'total_percentile_curve']) {
    if (Array.isArray(value[field]))
      summary[field] = value[field].slice(0, 100).map((point) => ({
        percentile: normalizeEvidenceNumber(point?.percentile),
        value: normalizeEvidenceNumber(point?.value),
        bin: normalizeEvidenceNumber(point?.bin),
        count: normalizeEvidenceNumber(point?.count),
        min: normalizeEvidenceNumber(point?.min),
        max: normalizeEvidenceNumber(point?.max),
      }));
  }
  if (value.driver_correlations && typeof value.driver_correlations === 'object')
    summary.driver_correlations = safeNumberFields(value.driver_correlations, [
      'freight_multiplier',
      'demand_multiplier',
      'inventory_days',
      'wacc',
      'tax_multiplier',
    ]);
  return summary;
}

export function projectMonteCarloExecutionEvidence(result = {}) {
  return {
    pairing: result.pairing
      ? {
          method: result.pairing.method,
          status: result.pairing.status,
          baseline_mode: result.pairing.baseline_mode,
          paired_baseline_iterations: result.pairing.paired_baseline_iterations,
        }
      : null,
    monte_carlo_status: ['success', 'error', 'blocked'].includes(result.monte_carlo_status)
      ? result.monte_carlo_status
      : null,
    errors: Array.from({ length: Math.min(20, safeCount(result.errors)) }, () => 'error_present'),
    warnings: Array.from(
      { length: Math.min(20, safeCount(result.warnings)) },
      () => 'warning_present'
    ),
    data_quality_status: ['complete', 'limited_fiscal_coverage'].includes(
      result.data_quality_status
    )
      ? result.data_quality_status
      : null,
    summary: projectMonteCarloSummary(result.summary),
  };
}

export function projectAcademicScenarioResult({
  result = {},
  reallocationAudit = {},
  baselineResult = null,
  quality = null,
  scenarioId = null,
} = {}) {
  const activeCds = result.scenario?.changes?.active_cds || result.active_cds;
  const projectedCount = normalizeEvidenceNumber(result.active_cds_count);
  const assumptions = buildScenarioAssumptionEvidence(result, baselineResult, result.scenario);
  return {
    scenario_id: projectSafeScenarioId(scenarioId),
    company_id: ['empresa1', 'empresa2'].includes(result.company_id) ? result.company_id : null,
    active_cds_count: Array.isArray(activeCds)
      ? activeCds.length
      : Number.isInteger(projectedCount) && projectedCount >= 0
        ? projectedCount
        : 0,
    ...assumptions,
    reallocation_rule_original: ['nearest_available_cd', 'lowest_freight_available_cd'].includes(
      reallocationAudit.source_reallocation_rule ?? result.reallocation_rule_original
    )
      ? (reallocationAudit.source_reallocation_rule ?? result.reallocation_rule_original)
      : null,
    reallocation_rule_effective: ['nearest_available_cd', 'lowest_freight_available_cd'].includes(
      reallocationAudit.effective_reallocation_rule ??
        result.scenario?.changes?.reallocation_rule ??
        result.reallocation_rule_effective
    )
      ? (reallocationAudit.effective_reallocation_rule ??
        result.scenario?.changes?.reallocation_rule ??
        result.reallocation_rule_effective)
      : null,
    costs: projectCosts(result.costs),
    total_with_tax: normalizeEvidenceNumber(result.total_with_tax),
    saving_pct: baselineResult ? buildScenarioSavingEvidence(result, baselineResult) : null,
    quality: projectQuality(quality ?? result.quality),
    simulation_status: ['success', 'invalid', 'error'].includes(result.simulation_status)
      ? result.simulation_status
      : null,
    calculation_status: ['success', 'success_with_tax_limits', 'invalid', 'error'].includes(
      result.calculation_status
    )
      ? result.calculation_status
      : null,
    data_quality: projectDataQuality(result.data_quality),
    diagnostics: projectDiagnostics(result.diagnostics || result.costs?.diagnostics),
    errors: Array.from({ length: Math.min(20, safeCount(result.errors)) }, () => 'error_present'),
    warnings: Array.from(
      { length: Math.min(20, safeCount(result.warnings)) },
      () => 'warning_present'
    ),
    validation: projectValidation(result.validation),
  };
}

export function projectAcademicScenarioPlan(plan = {}) {
  return {
    scenario_status: ['ready', 'partial', 'not_applicable'].includes(plan.scenario_status)
      ? plan.scenario_status
      : 'unknown',
    scenarios: (plan.scenarios || []).map((scenario, index) => ({
      scenario_id: `scenario_plan_${String(index + 1).padStart(3, '0')}`,
      scenario_kind:
        scenario.scenario_id === 'e1_14_cds_sem_ribeirao_preto'
          ? 'e1_exclusion_a'
          : scenario.scenario_id === 'e1_14_cds_sem_cajamar'
            ? 'e1_exclusion_b'
            : /^e1_cd_unico_\d{2}$/.test(scenario.scenario_id || '')
              ? 'e1_single_cd_anonymized'
              : 'other',
      scenario_name: `Cenário planejado ${index + 1}`,
      status: ['ready', 'not_reproducible'].includes(scenario.status) ? scenario.status : 'unknown',
      reason_code: scenario.status === 'ready' ? null : 'required_source_inputs_unavailable',
      active_cd_count: Array.isArray(scenario.changes?.active_cds)
        ? scenario.changes.active_cds.length
        : null,
      changes: scenario.changes
        ? {
            freight_multiplier: normalizeEvidenceNumber(scenario.changes.freight_multiplier),
            demand_multiplier: normalizeEvidenceNumber(scenario.changes.demand_multiplier),
            inventory_days: normalizeEvidenceNumber(scenario.changes.inventory_days),
            wacc: normalizeEvidenceNumber(scenario.changes.wacc),
          }
        : null,
    })),
  };
}

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
    scenario_id: 'scenario_n',
    status: available ? 'allocation_available' : 'not_reproducible',
    execution_status: 'not_run_by_academic_evidence_generator',
    required_inputs: available ? [] : ['flow_to_cd_allocation'],
    reason: available
      ? 'A matriz existe, mas o gerador acadêmico não a aplica ao motor de simulação; nenhum resultado foi calculado.'
      : 'A alocação de fluxo para CD não está presente na fonte; nenhuma alocação foi inferida.',
  };
}

export function isScenarioNScenario(scenario = {}) {
  const label = normalizeCdLabel(`${scenario.scenario_id || ''} ${scenario.scenario_name || ''}`);
  return /\b(?:scenario|cenario)\s+n\b/.test(label);
}

/** Run ordinary sample scenarios; explicitly report Scenario N without executing it. */
export function mapAcademicSampleScenarios(
  sampleList = [],
  executeScenario = () => null,
  companyId = ''
) {
  return sampleList.map((sourceScenario, index) => {
    if (companyId === 'empresa2' && isScenarioNScenario(sourceScenario)) {
      const availability = buildScenarioNAvailabilityEvidence(sourceScenario);
      return {
        ...availability,
        scenario_name: `Cenário N — execução ${availability.status === 'allocation_available' ? 'não suportada' : 'bloqueada'}`,
      };
    }
    const result = executeScenario(sourceScenario, index);
    return result;
  });
}

export function buildAcademicScenarioEvidence({
  plan,
  deterministic,
  monteCarlo,
  scenarioId,
} = {}) {
  const projectedPlan = plan
    ? {
        ...projectAcademicScenarioPlan({ scenarios: [plan] }).scenarios[0],
        ...(projectSafeScenarioId(scenarioId)
          ? { scenario_id: projectSafeScenarioId(scenarioId) }
          : {}),
      }
    : null;
  return {
    scenario: projectedPlan,
    deterministic: deterministic
      ? {
          ...projectAcademicScenarioResult({
            result: deterministic,
            scenarioId: projectedPlan?.scenario_id,
          }),
          saving_pct: normalizeEvidenceNumber(deterministic.saving_pct),
        }
      : null,
    monte_carlo: {
      ...projectMonteCarloExecutionEvidence(monteCarlo),
      iterations: normalizeEvidenceNumber(monteCarlo?.iterations),
      seed: normalizeEvidenceNumber(monteCarlo?.seed),
      profile: projectEnum(monteCarlo?.config?.profile, MONTE_CARLO_PROFILE_ALLOWLIST),
      scatter_driver: projectEnum(
        monteCarlo?.config?.scatter_driver,
        MONTE_CARLO_ENUMS.scatter_driver
      ),
      provenance_status:
        projectEnum(
          monteCarlo?.config?.historical_provenance_status,
          HISTORICAL_PROVENANCE_STATUS_ALLOWLIST
        ) || 'not_applicable',
      data_quality_status: ['complete', 'limited_fiscal_coverage'].includes(
        monteCarlo?.data_quality_status
      )
        ? monteCarlo.data_quality_status
        : null,
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
    ? 'O espaço declarado não foi enumerado integralmente.'
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
                : 'Busca concluída no espaço declarado.';
  return {
    exact_search_space: exactSearchSpace,
    search_complete: searchComplete,
    completeness_reason: completenessReason,
    result_scope: ['conditional_declared_catalog', 'full_declared_catalog'].includes(
      result.result_scope
    )
      ? result.result_scope
      : null,
    space_limited: searchLog.space_limited === true || !exactSearchSpace,
    candidate_space_size: normalizeEvidenceNumber(searchLog.candidate_space_size),
    simulated_candidates: simulatedCandidates,
    valid_candidates: validCandidates,
    invalid_candidates: invalidCandidates,
    coverage_ratio: normalizeEvidenceNumber(searchLog.coverage_ratio),
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

export function buildScenarioAssumptionEvidence(
  result = {},
  baselineResult = {},
  sourceScenario = null
) {
  const changes = sourceScenario?.changes ?? result?.scenario?.changes ?? result?.changes ?? result;
  const baselineChanges = baselineResult?.scenario?.changes ?? baselineResult?.changes ?? {};
  return {
    freight_multiplier: normalizeEvidenceNumber(
      changes.freight_multiplier ?? baselineChanges.freight_multiplier ?? 1
    ),
    demand_multiplier: normalizeEvidenceNumber(
      changes.demand_multiplier ?? baselineChanges.demand_multiplier ?? 1
    ),
    inventory_days: normalizeEvidenceNumber(
      changes.inventory_days ?? baselineChanges.inventory_days ?? 45
    ),
    wacc: normalizeEvidenceNumber(changes.wacc ?? baselineChanges.wacc ?? 0.15),
    tax_mode:
      projectEnum(changes.tax_mode ?? baselineChanges.tax_mode ?? 'current', TAX_MODE_ALLOWLIST) ||
      null,
  };
}

export function buildOptimizerBestEvidence(candidate = {}, baseline = {}, rank = 1) {
  const result = candidate.result || {};
  const scenarioTotal = normalizeEvidenceNumber(result.total_with_tax);
  return {
    scenario_id: `candidate_rank_${String(Math.max(1, Math.min(9999, Math.floor(Number(rank) || 1)))).padStart(4, '0')}`,
    active_cd_count: Array.isArray(candidate.scenario?.changes?.active_cds)
      ? candidate.scenario.changes.active_cds.length
      : null,
    simulation_status: result.simulation_status ?? null,
    score: normalizeEvidenceNumber(candidate.final_score),
    total_with_tax: scenarioTotal,
    saving_pct: buildScenarioSavingEvidence(result, baseline),
    risk_level: ['low', 'medium', 'high'].includes(candidate.quality?.risk_level)
      ? candidate.quality.risk_level
      : null,
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

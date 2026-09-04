import { MODEL_ASSUMPTIONS } from '../shared/model-assumptions.js';

export function buildAuditTrail({
  companyId,
  selectedScenario,
  baselineBundle,
  objective = {},
  recommendation = {},
  optimizerResult = null,
  extraSources = [],
} = {}) {
  const scenarioId =
    selectedScenario?.scenario_id ||
    selectedScenario?.scenario?.scenario_id ||
    selectedScenario?.result?.scenario_id;
  const searchLog = optimizerResult?.search_log || null;
  const monteCarlo =
    selectedScenario?.monte_carlo?.summary ||
    selectedScenario?.scenario?.monte_carlo?.summary ||
    selectedScenario?.monte_carlo_summary ||
    null;
  const monteCarloEnvelope =
    selectedScenario?.monte_carlo || selectedScenario?.scenario?.monte_carlo || null;
  const selectedResult = selectedScenario?.result || selectedScenario || {};
  const sources = [
    `data/${companyId}/phase2/phase2_bundle.json.enc.json`,
    `data/${companyId}/phase3/sample_scenarios.json.enc.json`,
    `data/${companyId}/phase4/default_objectives.json.enc.json`,
    ...extraSources,
  ];
  return {
    audit_id: `${companyId}_audit_final_${scenarioId || 'sem_cenario'}`,
    company_id: companyId,
    selected_scenario_id: scenarioId,
    baseline_scenario_id: baselineBundle?.model?.scenario_id,
    data_sources: sources,
    assumptions: selectedScenario?.scenario?.changes || selectedScenario?.changes || {},
    model_assumptions_version: MODEL_ASSUMPTIONS.version,
    fallback_usage: selectedResult?.costs?.fallback_usage || null,
    inventory_calculation_mode:
      selectedResult?.costs?.inventory_calculation_mode || 'days_wacc_only',
    objective,
    recommendation_status: recommendation.recommendation_status || null,
    probabilistic_summary: monteCarlo
      ? {
          iterations: monteCarlo.iterations ?? null,
          seed: monteCarlo.seed ?? null,
          profile: monteCarlo.profile || null,
          probability_saving_positive: monteCarlo.probability_saving_positive ?? null,
          p10_saving_pct: monteCarlo.p10_saving_pct ?? null,
          median_saving_pct: monteCarlo.median_saving_pct ?? null,
          p90_saving_pct: monteCarlo.p90_saving_pct ?? null,
          risk_band: monteCarlo.risk_band || null,
          most_sensitive_driver: monteCarlo.most_sensitive_driver || null,
          spread: monteCarloEnvelope?.config?.spread || null,
          calibration_status:
            monteCarloEnvelope?.methodology?.calibration_status ||
            monteCarloEnvelope?.config?.calibration_status ||
            'manual_spreads_not_historically_calibrated',
        }
      : null,
    optimization: searchLog
      ? {
          method_requested: searchLog.method_requested || null,
          method_applied: searchLog.method_applied || null,
          exact_search_space: Boolean(searchLog.exact_search_space),
          generated_candidates: searchLog.generated_candidates ?? null,
          valid_candidates: searchLog.valid_candidates ?? null,
          best_scenario_id: searchLog.best_scenario_id || null,
        }
      : null,
    model_versions: {
      phase1: 'implemented',
      phase2: 'implemented',
      phase3: 'implemented',
      phase4: 'implemented',
      phase5: 'implemented',
    },
    warnings: [...(selectedResult?.warnings || []), ...(monteCarloEnvelope?.warnings || [])],
    created_at: 'browser_runtime',
  };
}
export function validateAuditTrail(audit) {
  const errors = [];
  ['company_id', 'selected_scenario_id', 'baseline_scenario_id'].forEach((k) => {
    if (!audit?.[k]) errors.push(`${k} ausente`);
  });
  if (!Array.isArray(audit?.data_sources) || audit.data_sources.length === 0)
    errors.push('fontes de dados ausentes');
  return { valid: errors.length === 0, errors };
}

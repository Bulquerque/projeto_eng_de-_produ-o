export function buildAuditTrail({
  companyId,
  selectedScenario,
  baselineBundle,
  objective = {},
  recommendation = {},
  optimizerResult = null,
  rankingSensitivity = null,
  extraSources = [],
} = {}) {
  const scenarioId =
    selectedScenario?.scenario_id ||
    selectedScenario?.scenario?.scenario_id ||
    selectedScenario?.result?.scenario_id;
  const searchLog = optimizerResult?.search_log || null;
  const evidence = selectedScenario?.result?.evidence || selectedScenario?.evidence || null;
  const monteCarlo =
    selectedScenario?.monte_carlo?.summary ||
    selectedScenario?.scenario?.monte_carlo?.summary ||
    selectedScenario?.monte_carlo_summary ||
    null;
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
    objective,
    recommendation_status: recommendation.recommendation_status || null,
    probabilistic_summary: monteCarlo
      ? {
          iterations: monteCarlo.iterations ?? null,
          iterations_requested: monteCarlo.iterations_requested ?? null,
          iterations_valid: monteCarlo.iterations_valid ?? null,
          seed: monteCarlo.seed ?? null,
          seed_effective: monteCarlo.seed_effective ?? null,
          rng_algorithm: monteCarlo.rng_algorithm || null,
          baseline_scenario_id: monteCarlo.baseline_scenario_id || null,
          deterministic_scenario_id: monteCarlo.deterministic_scenario_id || null,
          profile: monteCarlo.profile || null,
          analysis_type: monteCarlo.analysis_type || null,
          uncertainty_source: monteCarlo.uncertainty_source || null,
          historical_distribution: Boolean(monteCarlo.historical_distribution),
          historical_drivers: monteCarlo.historical_drivers || [],
          historical_observation_counts: monteCarlo.historical_observation_counts || {},
          historical_min_observations: monteCarlo.historical_min_observations ?? null,
          historical_sample_warning: monteCarlo.historical_sample_warning || null,
          probability_interpretation: monteCarlo.probability_interpretation || null,
          probability_saving_positive: monteCarlo.probability_saving_positive ?? null,
          p10_saving_pct: monteCarlo.p10_saving_pct ?? null,
          median_saving_pct: monteCarlo.median_saving_pct ?? null,
          p90_saving_pct: monteCarlo.p90_saving_pct ?? null,
          risk_band: monteCarlo.risk_band || null,
          most_sensitive_driver: monteCarlo.most_sensitive_driver || null,
        }
      : null,
    optimization: searchLog
      ? {
          method_requested: searchLog.method_requested || null,
          method_applied: searchLog.method_applied || null,
          seed: searchLog.seed ?? null,
          exact_search_space: Boolean(searchLog.exact_search_space),
          generated_candidates: searchLog.generated_candidates ?? null,
          simulated_candidates: searchLog.simulated_candidates ?? null,
          valid_candidates: searchLog.valid_candidates ?? null,
          invalid_candidates: searchLog.invalid_candidates ?? null,
          candidate_space_size: searchLog.candidate_space_size ?? null,
          coverage_ratio: searchLog.coverage_ratio ?? null,
          space_limited: Boolean(searchLog.space_limited),
          exactness_reason: searchLog.exactness_reason || null,
          refinement_rounds: searchLog.refinement_rounds ?? null,
          refinement_seed_count: searchLog.refinement_seed_count ?? null,
          refinement_candidates_generated: searchLog.refinement_candidates_generated ?? null,
          refinement_candidates_simulated: searchLog.refinement_candidates_simulated ?? null,
          best_score: searchLog.best_score ?? null,
          best_scenario_id: searchLog.best_scenario_id || null,
          best_by_total_cost_scenario_id: searchLog.best_by_total_cost_scenario_id || null,
          best_by_total_cost_value: searchLog.best_by_total_cost_value ?? null,
        }
      : null,
    evidence,
    ranking_sensitivity: rankingSensitivity || optimizerResult?.ranking_sensitivity || null,
    model_versions: {
      phase1: 'implemented',
      phase2: 'implemented',
      phase3: 'implemented',
      phase4: 'implemented',
      phase5: 'implemented',
    },
    warnings: [],
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

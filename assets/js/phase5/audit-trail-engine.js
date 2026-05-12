export function buildAuditTrail({ companyId, selectedScenario, baselineBundle, objective = {}, recommendation = {}, optimizerResult = null, extraSources = [] } = {}) {
  const scenarioId = selectedScenario?.scenario_id || selectedScenario?.scenario?.scenario_id || selectedScenario?.result?.scenario_id;
  const searchLog = optimizerResult?.search_log || null;
  const sources = [
    `data/${companyId}/phase2/phase2_bundle.json.enc.json`,
    `data/${companyId}/phase3/sample_scenarios.json.enc.json`,
    `data/${companyId}/phase4/default_objectives.json.enc.json`,
    ...extraSources
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
    optimization: searchLog ? {
      method_requested: searchLog.method_requested || null,
      method_applied: searchLog.method_applied || null,
      exact_search_space: Boolean(searchLog.exact_search_space),
      generated_candidates: searchLog.generated_candidates ?? null,
      valid_candidates: searchLog.valid_candidates ?? null,
      best_scenario_id: searchLog.best_scenario_id || null
    } : null,
    model_versions: { phase1: 'implemented', phase2: 'implemented', phase3: 'implemented', phase4: 'implemented', phase5: 'implemented' },
    warnings: [],
    created_at: 'browser_runtime'
  };
}
export function validateAuditTrail(audit) {
  const errors = [];
  ['company_id', 'selected_scenario_id', 'baseline_scenario_id'].forEach(k => { if (!audit?.[k]) errors.push(`${k} ausente`); });
  if (!Array.isArray(audit?.data_sources) || audit.data_sources.length === 0) errors.push('fontes de dados ausentes');
  return { valid: errors.length === 0, errors };
}

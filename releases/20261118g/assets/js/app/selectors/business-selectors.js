import { formatMetric, readMetric } from '../metric-registry.js';

export function selectActiveCompany(state) {
  return state?.context?.company_id || null;
}

export function selectBaseline(state) {
  return state?.data?.baseline || null;
}

export function selectScenarios(state) {
  return state?.data?.scenarios || [];
}

export function selectActiveScenario(state) {
  const selectedId = state?.context?.selected_scenario_id;
  return (
    state?.data?.selected_scenario ||
    selectScenarios(state).find((scenario) => scenario?.scenario_id === selectedId) ||
    null
  );
}

export function selectDecision(state) {
  return {
    scenario: selectActiveScenario(state),
    result: state?.data?.scenario_result || null,
    quality: state?.data?.scenario_quality || null,
    comparison: state?.data?.comparison || null,
    risk: {
      monte_carlo: state?.data?.monte_carlo || null,
      stress: state?.data?.stress || null,
      sensitivity: state?.data?.sensitivity || null,
      sensitivity_matrix: state?.data?.sensitivity_matrix || null,
      robustness: state?.data?.robustness || null,
    },
    optimizer: state?.data?.optimizer || null,
    recommendation: state?.data?.recommendation || null,
    audit: state?.data?.audit || null,
    final_qa: state?.data?.final_qa || null,
    release: state?.data?.release || null,
    export_package: state?.data?.export_package || null,
  };
}

export function selectEvidence(state) {
  return selectDecision(state).result?.evidence || null;
}

export function selectMetricViewModel(state) {
  const decision = selectDecision(state);
  return {
    model: selectBaseline(state)?.model || null,
    scenario: decision.scenario,
    result: decision.result,
    quality: decision.scenario?.quality || decision.quality || decision.result?.quality || null,
    comparison: decision.comparison,
    robustness: decision.risk.robustness,
    optimizer: decision.optimizer,
    recommendation: decision.recommendation,
    release: decision.release,
  };
}

export function selectMetric(state, metricId) {
  return readMetric(selectMetricViewModel(state), metricId);
}

export function formatSelectedMetric(state, metricId) {
  return formatMetric(metricId, selectMetric(state, metricId));
}

export function selectCompanyHealth(state) {
  return {
    company_id: selectActiveCompany(state),
    provider_kind: state?.context?.provider_kind || null,
    runtime_mode: state?.context?.runtime_mode || null,
    status: state?.meta?.status || 'unknown',
    error: state?.ui?.error || null,
  };
}

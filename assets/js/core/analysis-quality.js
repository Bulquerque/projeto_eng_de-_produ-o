/**
 * Common quality semantics shared by the scenario, optimizer and uncertainty
 * layers. Data limitations change the interpretation of a result; they do not
 * invalidate a numerically calculable scenario by themselves.
 */

export const DATA_QUALITY_STATUS = Object.freeze({
  COMPLETE: 'complete',
  LIMITED_FISCAL_COVERAGE: 'limited_fiscal_coverage',
  TECHNICAL_ERROR: 'technical_error',
});

export function isTaxCoverageLimited({ taxResults = {}, scenario = {} } = {}) {
  const taxMode = taxResults.tax_mode || scenario?.changes?.tax_mode || 'current';
  if (taxMode === 'disabled' || scenario?.changes?.tax_mode === 'disabled') return false;

  const coverage = taxResults.tax_coverage || {};
  const completeFiscalCoverage = Number(coverage.complete_fiscal_coverage_ratio);
  const inputCoverage = Number(coverage.input_coverage_ratio);
  const proxyFlowCount = Number(coverage.proxy_flow_count || 0);
  const structuralOrLegacyLimit = coverage.coverage_limited === true || coverage.blocked === true;
  const incompleteCoverage =
    (Number.isFinite(completeFiscalCoverage) && completeFiscalCoverage < 1) ||
    (Number.isFinite(inputCoverage) && inputCoverage < 1) ||
    proxyFlowCount > 0;
  return structuralOrLegacyLimit || incompleteCoverage;
}

export function buildDataQualityAssessment({ taxResults = {}, scenario = {} } = {}) {
  const limited = isTaxCoverageLimited({ taxResults, scenario });
  const coverage = taxResults.tax_coverage || {};
  const uncovered = Number(coverage.uncovered_flow_count || 0);
  const missingOrigin = Number(coverage.missing_origin_uf_count || 0);
  const completeFiscal = Number(coverage.flows_with_complete_fiscal_data || 0);
  const eligibleFlowCount = Number(coverage.eligible_flow_count || 0);

  return {
    status: limited ? DATA_QUALITY_STATUS.LIMITED_FISCAL_COVERAGE : DATA_QUALITY_STATUS.COMPLETE,
    decision_use: limited ? 'exploratory_only' : 'decision_support',
    coverage_limited: limited,
    limitation: limited
      ? 'Resultado calculável com cobertura fiscal parcial; não constitui validação fiscal oficial.'
      : null,
    coverage: {
      uncovered_flow_count: uncovered,
      missing_origin_uf_count: missingOrigin,
      complete_fiscal_flow_count: completeFiscal,
      eligible_flow_count: eligibleFlowCount,
      complete_fiscal_coverage_ratio: Number.isFinite(
        Number(coverage.complete_fiscal_coverage_ratio)
      )
        ? Number(coverage.complete_fiscal_coverage_ratio)
        : null,
    },
  };
}

export function isNumericallyUsableScenarioResult(result = {}) {
  return Boolean(
    result.simulation_status === 'success' &&
    Number.isFinite(Number(result.total_with_tax)) &&
    Number.isFinite(Number(result.costs?.total_logistics_cost)) &&
    Number.isFinite(Number(result.costs?.tax_impact))
  );
}

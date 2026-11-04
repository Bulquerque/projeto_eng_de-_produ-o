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

function finiteNumberOrNull(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function isTaxCoverageLimited({ taxResults = {}, scenario = {} } = {}) {
  const taxMode = taxResults.tax_mode || scenario?.changes?.tax_mode || 'current';
  if (taxMode === 'disabled' || scenario?.changes?.tax_mode === 'disabled') return false;

  const coverage = taxResults.tax_coverage || {};
  const completeFiscalCoverage = finiteNumberOrNull(coverage.complete_fiscal_coverage_ratio);
  const inputCoverage = finiteNumberOrNull(coverage.input_coverage_ratio);
  const proxyFlowCount = finiteNumberOrNull(coverage.proxy_flow_count);
  const structuralOrLegacyLimit = coverage.coverage_limited === true || coverage.blocked === true;
  const incompleteCoverage =
    completeFiscalCoverage == null ||
    completeFiscalCoverage < 1 ||
    completeFiscalCoverage > 1 ||
    inputCoverage == null ||
    inputCoverage < 1 ||
    inputCoverage > 1 ||
    proxyFlowCount == null ||
    proxyFlowCount !== 0;
  return structuralOrLegacyLimit || incompleteCoverage;
}

export function buildDataQualityAssessment({ taxResults = {}, scenario = {} } = {}) {
  const limited = isTaxCoverageLimited({ taxResults, scenario });
  const coverage = taxResults.tax_coverage || {};
  const uncovered = finiteNumberOrNull(coverage.uncovered_flow_count);
  const missingOrigin = finiteNumberOrNull(coverage.missing_origin_uf_count);
  const completeFiscal = finiteNumberOrNull(coverage.flows_with_complete_fiscal_data);
  const eligibleFlowCount = finiteNumberOrNull(coverage.eligible_flow_count);

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
      complete_fiscal_coverage_ratio: finiteNumberOrNull(coverage.complete_fiscal_coverage_ratio),
    },
  };
}

export function isNumericallyUsableScenarioResult(result = {}) {
  const isFiniteValue = (value) =>
    (typeof value === 'number' || (typeof value === 'string' && value.trim() !== '')) &&
    Number.isFinite(Number(value));
  return Boolean(
    result?.simulation_status === 'success' &&
    !(result?.errors?.length > 0) &&
    isFiniteValue(result?.total_with_tax) &&
    isFiniteValue(result?.costs?.total_logistics_cost) &&
    isFiniteValue(result?.costs?.tax_impact)
  );
}

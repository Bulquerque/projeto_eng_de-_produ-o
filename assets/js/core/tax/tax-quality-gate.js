export function auditTaxFlowCoverage(fiscalFlows = [], flowContext = {}) {
  const total = Array.isArray(fiscalFlows) ? fiscalFlows.length : 0;
  const inputFlowCount = Math.max(total, Number(flowContext.input_flow_count || total));
  const missingOriginCount = Math.max(
    0,
    Number(
      flowContext.missing_origin_uf_count ?? fiscalFlows.filter((flow) => !flow.origin_uf).length
    )
  );
  const complete = fiscalFlows.filter(
    (flow) => flow.origin_uf && flow.destination_uf && flow.gross_revenue > 0
  ).length;
  const destinationCovered = fiscalFlows.filter((flow) => flow.destination_uf).length;
  const originCovered = fiscalFlows.filter((flow) => flow.origin_uf).length;
  const proxy = fiscalFlows.filter((flow) => !flow.ncm || !flow.cfop || !flow.cst).length;
  const completeFiscalData = fiscalFlows.filter(
    (flow) =>
      flow.origin_uf &&
      flow.destination_uf &&
      flow.gross_revenue > 0 &&
      flow.ncm &&
      flow.cfop &&
      flow.cst
  ).length;
  const score = total
    ? Math.max(0, Math.min(100, Math.round((complete / total) * 100 - (proxy / total) * 20)))
    : 0;
  const inputCoverageRatio = inputFlowCount ? total / inputFlowCount : 0;
  const eligibleFlowCoverageRatio = inputFlowCount ? total / inputFlowCount : 0;
  const destinationCoverageRatio = total ? destinationCovered / total : 0;
  const originCoverageRatio = total ? originCovered / total : 0;
  const fiscalClassificationCoverage = total ? completeFiscalData / total : 0;
  const precision_mode =
    total === 0 ? 'top_down_fallback' : proxy > 0 ? 'realistic_proxy' : 'bottom_up_flow';
  const warnings = [];
  if (!total)
    warnings.push({
      code: 'NO_FISCAL_FLOWS',
      severity: 'warning',
      message: 'Sem fiscal_flows; usando fallback top-down.',
    });
  if (proxy > 0)
    warnings.push({
      code: 'PROXY_FLOWS',
      severity: 'warning',
      message: 'Parte dos fluxos fiscais usa proxy por falta de NCM/CFOP/CST.',
    });
  const structurallyLimited =
    inputFlowCount > 0 &&
    (Number(flowContext.excluded_missing_destination_count || 0) > 0 ||
      Number(flowContext.excluded_missing_revenue_count || 0) > 0 ||
      missingOriginCount > 0 ||
      fiscalFlows.some((flow) => !flow.destination_uf));
  const coverageLimited =
    structurallyLimited ||
    (inputFlowCount > 0 &&
      (proxy > 0 ||
        completeFiscalData < fiscalFlows.length ||
        fiscalFlows.length < inputFlowCount));
  if (coverageLimited)
    warnings.push({
      code: 'PARTIAL_FISCAL_COVERAGE',
      severity: 'warning',
      message:
        'O resultado numérico é entregue com cobertura fiscal parcial e uso exploratório; os campos ausentes não são inventados.',
    });
  return {
    data_quality_score: score / 100,
    input_flow_count: inputFlowCount,
    eligible_flow_count: total,
    excluded_missing_destination_count: Number(flowContext.excluded_missing_destination_count || 0),
    excluded_missing_revenue_count: Number(flowContext.excluded_missing_revenue_count || 0),
    uncovered_flow_count: Math.max(0, inputFlowCount - total),
    missing_origin_uf_count: missingOriginCount,
    precision_mode,
    input_coverage_ratio: inputCoverageRatio,
    input_coverage_pct: inputCoverageRatio * 100,
    eligible_coverage_ratio: eligibleFlowCoverageRatio,
    eligible_flow_coverage_pct: eligibleFlowCoverageRatio * 100,
    destination_coverage_ratio: destinationCoverageRatio,
    destination_coverage_pct: destinationCoverageRatio * 100,
    origin_coverage_ratio: originCoverageRatio,
    origin_coverage_pct: originCoverageRatio * 100,
    revenue_coverage_ratio: inputFlowCount ? total / inputFlowCount : 0,
    revenue_coverage_pct: inputFlowCount ? (total / inputFlowCount) * 100 : 0,
    complete_fiscal_coverage_ratio: fiscalClassificationCoverage,
    complete_fiscal_coverage_pct: fiscalClassificationCoverage * 100,
    fiscal_classification_coverage: fiscalClassificationCoverage,
    coverage_destination_uf: destinationCoverageRatio,
    // Compatibility alias: this remains structural flow coverage. Consumers
    // displaying fiscal quality must use complete_fiscal_coverage_pct.
    coverage_pct: eligibleFlowCoverageRatio * 100,
    flows_with_tax_data: complete,
    flows_with_complete_fiscal_data: completeFiscalData,
    proxy_flow_count: proxy,
    warnings,
    // Kept for compatibility with old exports. Data incompleteness is a
    // limitation, not a blocker; consumers must use `coverage_limited`.
    blocked: false,
    legacy_blocked_by_coverage: structurallyLimited,
    coverage_limited: coverageLimited,
    coverage_status: coverageLimited ? 'limited' : 'complete',
    decision_gate: coverageLimited ? 'warning' : 'pass',
    result_usable: Boolean(total),
    calculation_mode: total
      ? proxy > 0
        ? 'realistic_proxy'
        : 'bottom_up_flow'
      : 'top_down_fallback',
  };
}

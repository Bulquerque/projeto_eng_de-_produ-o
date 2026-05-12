export function auditTaxFlowCoverage(fiscalFlows = []) {
  const total = Array.isArray(fiscalFlows) ? fiscalFlows.length : 0;
  const complete = fiscalFlows.filter(flow => flow.origin_uf && flow.destination_uf && flow.gross_revenue > 0).length;
  const proxy = fiscalFlows.filter(flow => !flow.ncm || !flow.cfop || !flow.cst).length;
  const score = total ? Math.max(0, Math.min(100, Math.round((complete / total) * 100 - (proxy / total) * 20))) : 0;
  const precision_mode = total === 0 ? 'top_down_fallback' : (proxy > 0 ? 'realistic_proxy' : 'bottom_up_flow');
  const warnings = [];
  if (!total) warnings.push({ code: 'NO_FISCAL_FLOWS', severity: 'warning', message: 'Sem fiscal_flows; usando fallback top-down.' });
  if (proxy > 0) warnings.push({ code: 'PROXY_FLOWS', severity: 'warning', message: 'Parte dos fluxos fiscais usa proxy por falta de NCM/CFOP/CST.' });
  return {
    data_quality_score: score / 100,
    precision_mode,
    coverage_destination_uf: total ? complete / total : 0,
    proxy_flow_count: proxy,
    warnings,
    blocked: total > 0 && fiscalFlows.some(flow => !flow.destination_uf),
    calculation_mode: total ? (proxy > 0 ? 'realistic_proxy' : 'bottom_up_flow') : 'top_down_fallback'
  };
}

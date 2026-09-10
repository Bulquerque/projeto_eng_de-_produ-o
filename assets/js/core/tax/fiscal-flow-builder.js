import { getFiscalCategoryRule, normalizeFiscalCategory } from './fiscal-category-rules.js';
import { safeNumber } from '../common.js';

function getFlowRevenue(flow) {
  return safeNumber(
    flow?.annual_revenue ?? flow?.revenue ?? flow?.monthly_revenue ?? flow?.gross_revenue ?? 0
  );
}

export function buildFiscalFlows({
  baselineBundle,
  scenario: _scenario,
  rebuiltFlows = [],
  fiscalCategoryRules = null,
} = {}) {
  const baseTax = baselineBundle?.tax_results?.tax_results || baselineBundle?.costs?.costs || {};
  const baseRevenue = safeNumber(
    baselineBundle?.flow_summary?.total_annual_revenue ??
      baselineBundle?.flow_summary?.total_revenue_cd_to_destination ??
      baselineBundle?.costs?.costs?.total_logistics_cost ??
      0
  );
  const baselineTaxPerRevenue =
    baseRevenue > 0 ? safeNumber(baseTax.total_tax_impact, 0) / baseRevenue : 0.18;
  const flows = Array.isArray(rebuiltFlows) ? rebuiltFlows : [];
  const fiscalFlows = [];
  const warnings = [];
  const errors = [];
  let excludedMissingDestination = 0;
  let excludedMissingRevenue = 0;
  let missingOrigin = 0;

  for (const [index, flow] of flows.entries()) {
    const destinationUf = String(flow?.destination_uf || '')
      .trim()
      .toUpperCase();
    if (!destinationUf) {
      excludedMissingDestination += 1;
      errors.push({
        code: 'MISSING_DESTINATION_UF',
        severity: 'error',
        message: 'Fluxo sem UF destino não pode ser calculado no motor bottom-up.',
      });
      continue;
    }
    const grossRevenue = getFlowRevenue(flow);
    if (!(grossRevenue > 0)) {
      excludedMissingRevenue += 1;
      warnings.push({
        code: 'MISSING_REVENUE',
        severity: 'warning',
        message: `Fluxo ${flow?.flow_id || index + 1} sem receita válida; cálculo ignorado.`,
      });
      continue;
    }

    const originUf = String(flow?.origin_uf || '')
      .trim()
      .toUpperCase();
    if (!originUf) {
      missingOrigin += 1;
      warnings.push({
        code: 'MISSING_ORIGIN_UF',
        severity: 'warning',
        message: `Fluxo ${flow?.flow_id || index + 1} sem UF origem; associação fiscal fica bloqueada ou proxy.`,
      });
    }

    const rawCategory =
      flow?.fiscal_category ||
      flow?.category ||
      flow?.tax_category ||
      flow?.sku ||
      flow?.flow_type ||
      'default_goods';
    const fiscal_category = normalizeFiscalCategory(rawCategory, fiscalCategoryRules || undefined);
    const categoryRule = getFiscalCategoryRule(fiscal_category, fiscalCategoryRules || undefined);
    const hasCategoryProxy = !flow?.ncm || !flow?.cfop || !flow?.cst;
    if (hasCategoryProxy) {
      warnings.push({
        code: 'PROXY_FISCAL_CATEGORY',
        severity: 'warning',
        message: `Fluxo ${flow?.flow_id || index + 1} sem NCM/CFOP/CST completo; usando categoria fiscal proxy.`,
      });
    }

    fiscalFlows.push({
      flow_id: flow?.flow_id || `flow_${String(index + 1).padStart(4, '0')}`,
      origin_uf:
        String(flow?.origin_uf || '')
          .trim()
          .toUpperCase() || null,
      destination_uf: destinationUf,
      sku_or_category: flow?.sku || flow?.batch || flow?.flow_type || fiscal_category,
      fiscal_category,
      gross_revenue: grossRevenue,
      freight_cost: safeNumber(flow?.freight_cost ?? flow?.distribution_cost ?? 0),
      current_tax_baseline: grossRevenue * baselineTaxPerRevenue,
      ncm: flow?.ncm || null,
      cfop: flow?.cfop || null,
      cst: flow?.cst || null,
      document_type: flow?.document_type || null,
      credit_base: safeNumber(flow?.credit_base ?? grossRevenue),
      credit_eligible:
        flow?.credit_eligible != null
          ? Boolean(flow.credit_eligible)
          : Boolean(categoryRule.credit_eligible),
      specific_regime: flow?.specific_regime || null,
      selective_tax_category:
        flow?.selective_tax_category ||
        (fiscal_category === 'selective_goods' ? fiscal_category : null),
      source_flow: flow,
    });
  }

  const precision_mode = fiscalFlows.length
    ? fiscalFlows.some((flow) => !flow.ncm || !flow.cfop || !flow.cst)
      ? 'realistic_proxy'
      : 'bottom_up_flow'
    : 'top_down_fallback';
  const calculation_mode = fiscalFlows.length ? precision_mode : 'top_down_fallback';

  return {
    fiscal_flows: fiscalFlows,
    warnings,
    errors,
    quality_report: {
      input_flow_count: flows.length,
      flow_count: fiscalFlows.length,
      eligible_flow_count: fiscalFlows.length,
      missing_origin_uf_count: missingOrigin,
      excluded_missing_destination_count: excludedMissingDestination,
      excluded_missing_revenue_count: excludedMissingRevenue,
      uncovered_flow_count: Math.max(0, flows.length - fiscalFlows.length),
      coverage_destination_uf: flows.length ? fiscalFlows.length / flows.length : 0,
      input_coverage_ratio: flows.length ? fiscalFlows.length / flows.length : 0,
      precision_mode,
      calculation_mode,
      warnings,
      errors,
    },
    baseline_tax_per_revenue: baselineTaxPerRevenue,
  };
}

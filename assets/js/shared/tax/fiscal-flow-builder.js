import { flowMeasure } from '../../phase3/scenario-flow-rebuilder.js';
import { getFiscalCategoryRule, normalizeFiscalCategory } from './fiscal-category-rules.js';

function n(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getFlowRevenue(flow) {
  return n(flow?.annual_revenue ?? flow?.revenue ?? flow?.monthly_revenue ?? flow?.gross_revenue ?? flowMeasure(flow));
}

export function buildFiscalFlows({ baselineBundle, scenario, rebuiltFlows = [], fiscalCategoryRules = null } = {}) {
  const baseTax = baselineBundle?.tax_results?.tax_results || baselineBundle?.costs?.costs || {};
  const baseRevenue = n(
    baselineBundle?.flow_summary?.total_annual_revenue ??
    baselineBundle?.flow_summary?.total_revenue_cd_to_destination ??
    baselineBundle?.costs?.costs?.total_logistics_cost ??
    0
  );
  const baselineTaxPerRevenue = baseRevenue > 0 ? n(baseTax.total_tax_impact, 0) / baseRevenue : 0.18;
  const flows = Array.isArray(rebuiltFlows) ? rebuiltFlows : [];
  const fiscalFlows = [];
  const warnings = [];
  const errors = [];

  for (const [index, flow] of flows.entries()) {
    const destinationUf = String(flow?.destination_uf || '').trim().toUpperCase();
    if (!destinationUf) {
      errors.push({ code: 'MISSING_DESTINATION_UF', severity: 'error', message: 'Fluxo sem UF destino não pode ser calculado no motor bottom-up.' });
      continue;
    }
    const grossRevenue = getFlowRevenue(flow);
    if (!(grossRevenue > 0)) {
      warnings.push({ code: 'MISSING_REVENUE', severity: 'warning', message: `Fluxo ${flow?.flow_id || index + 1} sem receita válida; cálculo ignorado.` });
      continue;
    }

    const rawCategory = flow?.fiscal_category || flow?.category || flow?.tax_category || flow?.sku || flow?.flow_type || 'default_goods';
    const fiscal_category = normalizeFiscalCategory(rawCategory, fiscalCategoryRules || undefined);
    const categoryRule = getFiscalCategoryRule(fiscal_category, fiscalCategoryRules || undefined);
    const hasCategoryProxy = !flow?.ncm || !flow?.cfop || !flow?.cst;
    if (hasCategoryProxy) {
      warnings.push({ code: 'PROXY_FISCAL_CATEGORY', severity: 'warning', message: `Fluxo ${flow?.flow_id || index + 1} sem NCM/CFOP/CST completo; usando categoria fiscal proxy.` });
    }

    fiscalFlows.push({
      flow_id: flow?.flow_id || `flow_${String(index + 1).padStart(4, '0')}`,
      origin_uf: String(flow?.origin_uf || '').trim().toUpperCase() || null,
      destination_uf: destinationUf,
      sku_or_category: flow?.sku || flow?.batch || flow?.flow_type || fiscal_category,
      fiscal_category,
      gross_revenue: grossRevenue,
      freight_cost: n(flow?.freight_cost ?? flow?.distribution_cost ?? 0),
      legacy_tax_baseline: grossRevenue * baselineTaxPerRevenue,
      ncm: flow?.ncm || null,
      cfop: flow?.cfop || null,
      cst: flow?.cst || null,
      document_type: flow?.document_type || null,
      credit_base: n(flow?.credit_base ?? grossRevenue),
      credit_eligible: flow?.credit_eligible != null ? Boolean(flow.credit_eligible) : Boolean(categoryRule.credit_eligible),
      specific_regime: flow?.specific_regime || null,
      selective_tax_category: flow?.selective_tax_category || (fiscal_category === 'selective_goods' ? fiscal_category : null),
      source_flow: flow
    });
  }

  const precision_mode = fiscalFlows.length
    ? (fiscalFlows.some(flow => !flow.ncm || !flow.cfop || !flow.cst) ? 'realistic_proxy' : 'bottom_up_flow')
    : 'top_down_fallback';
  const calculation_mode = fiscalFlows.length ? precision_mode : 'top_down_fallback';

  return {
    fiscal_flows: fiscalFlows,
    warnings,
    errors,
    quality_report: {
      flow_count: fiscalFlows.length,
      coverage_destination_uf: flows.length ? fiscalFlows.length / flows.length : 0,
      precision_mode,
      calculation_mode,
      warnings,
      errors
    },
    baseline_tax_per_revenue: baselineTaxPerRevenue
  };
}

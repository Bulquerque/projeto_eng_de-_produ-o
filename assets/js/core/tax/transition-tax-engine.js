import { safeNumber } from '../common.js';

export function combineTaxResults({ currentResult = {}, reformResult = {}, regime = {} } = {}) {
  const currentWeight = safeNumber(regime.current_weight, 1);
  const reformWeight =
    regime.reform_weight != null
      ? safeNumber(regime.reform_weight, 1 - currentWeight)
      : 1 - currentWeight;
  const currentComponent =
    safeNumber(currentResult.total_current_tax, currentResult.total_tax) * currentWeight;
  const reformComponent =
    safeNumber(reformResult.total_reform_tax, reformResult.total_tax) * reformWeight;
  const totalTax = currentComponent + reformComponent;
  return {
    total_tax: totalTax,
    total_current_tax: currentComponent,
    total_reform_tax: reformComponent,
    cbs_total: safeNumber(reformResult.cbs_total),
    ibs_total: safeNumber(reformResult.ibs_total),
    selective_tax_total: safeNumber(reformResult.selective_tax_total),
    credits_total: safeNumber(reformResult.credits_total),
    flow_breakdown: reformResult.flow_breakdown || currentResult.flow_breakdown || [],
    tax_breakdown_by_component: {
      current_tax: currentComponent,
      cbs_total: safeNumber(reformResult.cbs_total),
      ibs_total: safeNumber(reformResult.ibs_total),
      selective_tax_total: safeNumber(reformResult.selective_tax_total),
      credits_total: safeNumber(reformResult.credits_total),
    },
    tax_breakdown_by_destination_uf:
      reformResult.tax_breakdown_by_destination_uf ||
      currentResult.tax_breakdown_by_destination_uf ||
      {},
    tax_breakdown_by_fiscal_category:
      reformResult.tax_breakdown_by_fiscal_category ||
      currentResult.tax_breakdown_by_fiscal_category ||
      {},
  };
}

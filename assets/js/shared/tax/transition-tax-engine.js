function n(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function combineTransitionTaxes({ legacyResult = {}, reformResult = {}, regime = {} } = {}) {
  const legacyWeight = n(regime.legacy_weight, 1);
  const reformWeight = regime.reform_weight != null ? n(regime.reform_weight, 1 - legacyWeight) : 1 - legacyWeight;
  const legacyComponent = n(legacyResult.total_legacy_tax, legacyResult.total_tax) * legacyWeight;
  const reformComponent = n(reformResult.total_reform_tax, reformResult.total_tax) * reformWeight;
  const totalTax = legacyComponent + reformComponent;
  return {
    total_tax: totalTax,
    total_legacy_tax: legacyComponent,
    total_reform_tax: reformComponent,
    cbs_total: n(reformResult.cbs_total),
    ibs_total: n(reformResult.ibs_total),
    selective_tax_total: n(reformResult.selective_tax_total),
    credits_total: n(reformResult.credits_total),
    flow_breakdown: reformResult.flow_breakdown || legacyResult.flow_breakdown || [],
    tax_breakdown_by_component: {
      legacy_tax: legacyComponent,
      cbs_total: n(reformResult.cbs_total),
      ibs_total: n(reformResult.ibs_total),
      selective_tax_total: n(reformResult.selective_tax_total),
      credits_total: n(reformResult.credits_total)
    },
    tax_breakdown_by_destination_uf: reformResult.tax_breakdown_by_destination_uf || legacyResult.tax_breakdown_by_destination_uf || {},
    tax_breakdown_by_fiscal_category: reformResult.tax_breakdown_by_fiscal_category || legacyResult.tax_breakdown_by_fiscal_category || {}
  };
}

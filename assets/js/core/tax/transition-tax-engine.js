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
  const currentRows = new Map(
    (currentResult.flow_breakdown || []).map((row) => [String(row.flow_id), row])
  );
  const flowBreakdown = (reformResult.flow_breakdown || []).map((row) => {
    const currentRow = currentRows.get(String(row.flow_id)) || {};
    const currentTax = safeNumber(currentRow.current_tax, currentRow.total_tax) * currentWeight;
    const cbs = safeNumber(row.cbs) * reformWeight;
    const ibs = safeNumber(row.ibs) * reformWeight;
    const selective = safeNumber(row.selective_tax) * reformWeight;
    const credits = safeNumber(row.credits) * reformWeight;
    return {
      ...row,
      current_tax: currentTax,
      cbs,
      ibs,
      selective_tax: selective,
      credits,
      total_tax: currentTax + cbs + ibs + selective - credits,
      current_weight: currentWeight,
      reform_weight: reformWeight,
    };
  });
  const weightedBy = (field) => {
    const current = currentResult[`tax_breakdown_by_${field}`] || {};
    const reform = reformResult[`tax_breakdown_by_${field}`] || {};
    return Object.fromEntries(
      [...new Set([...Object.keys(current), ...Object.keys(reform)])].map((key) => [
        key,
        safeNumber(current[key]) * currentWeight + safeNumber(reform[key]) * reformWeight,
      ])
    );
  };
  return {
    total_tax: totalTax,
    total_current_tax: currentComponent,
    total_reform_tax: reformComponent,
    cbs_total: safeNumber(reformResult.cbs_total) * reformWeight,
    ibs_total: safeNumber(reformResult.ibs_total) * reformWeight,
    selective_tax_total: safeNumber(reformResult.selective_tax_total) * reformWeight,
    credits_total: safeNumber(reformResult.credits_total) * reformWeight,
    flow_breakdown: flowBreakdown.length ? flowBreakdown : currentResult.flow_breakdown || [],
    tax_breakdown_by_component: {
      current_tax: currentComponent,
      cbs_total: safeNumber(reformResult.cbs_total) * reformWeight,
      ibs_total: safeNumber(reformResult.ibs_total) * reformWeight,
      selective_tax_total: safeNumber(reformResult.selective_tax_total) * reformWeight,
      credits_total: safeNumber(reformResult.credits_total) * reformWeight,
    },
    tax_breakdown_by_destination_uf: weightedBy('destination_uf'),
    tax_breakdown_by_fiscal_category: weightedBy('fiscal_category'),
  };
}

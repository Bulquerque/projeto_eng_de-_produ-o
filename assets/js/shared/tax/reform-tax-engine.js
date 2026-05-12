import { getFiscalCategoryRule } from './fiscal-category-rules.js';
import { getRegimeTaxRates } from './tax-reform-parameters.js';

function n(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function groupBy(items, keyGetter) {
  const out = {};
  for (const item of items) {
    const key = keyGetter(item) || 'unknown';
    out[key] = out[key] || [];
    out[key].push(item);
  }
  return out;
}

export function calculateReformTax({ fiscalFlows = [], taxRegime = 'reform_full_2033', demandMultiplier = 1, parameters = null } = {}) {
  const rates = getRegimeTaxRates(taxRegime, parameters || undefined);
  const flowBreakdown = fiscalFlows.map(flow => {
    const rule = getFiscalCategoryRule(flow.fiscal_category);
    const grossRevenue = n(flow.gross_revenue) * n(demandMultiplier, 1);
    const cbs = grossRevenue * n(rates.cbs) * n(rule.cbs_rate_multiplier, 1);
    const ibs = grossRevenue * n(rates.ibs) * n(rule.ibs_rate_multiplier, 1);
    const selective = grossRevenue * n(rates.selective) * n(rule.selective_rate_multiplier, 0);
    const credits = flow.credit_eligible === false ? 0 : (cbs + ibs) * n(rule.credit_rate, 0);
    const total = Math.max(0, cbs + ibs + selective - credits);
    return {
      flow_id: flow.flow_id,
      destination_uf: flow.destination_uf,
      fiscal_category: flow.fiscal_category,
      gross_revenue: grossRevenue,
      cbs,
      ibs,
      selective_tax: selective,
      credits,
      total_tax: total
    };
  });

  const totals = flowBreakdown.reduce(
    (acc, row) => {
      acc.cbs_total += n(row.cbs);
      acc.ibs_total += n(row.ibs);
      acc.selective_tax_total += n(row.selective_tax);
      acc.credits_total += n(row.credits);
      acc.total_reform_tax += n(row.total_tax);
      return acc;
    },
    { cbs_total: 0, ibs_total: 0, selective_tax_total: 0, credits_total: 0, total_reform_tax: 0 }
  );

  const byDestination = groupBy(flowBreakdown, row => row.destination_uf);
  const byCategory = groupBy(flowBreakdown, row => row.fiscal_category);

  return {
    ...totals,
    flow_breakdown: flowBreakdown,
    tax_breakdown_by_destination_uf: Object.fromEntries(Object.entries(byDestination).map(([key, rows]) => [key, rows.reduce((sum, row) => sum + n(row.total_tax), 0)])),
    tax_breakdown_by_fiscal_category: Object.fromEntries(Object.entries(byCategory).map(([key, rows]) => [key, rows.reduce((sum, row) => sum + n(row.total_tax), 0)])),
    tax_breakdown_by_component: {
      legacy_tax: 0,
      cbs_total: totals.cbs_total,
      ibs_total: totals.ibs_total,
      selective_tax_total: totals.selective_tax_total,
      credits_total: totals.credits_total
    },
    regime_rates: rates
  };
}

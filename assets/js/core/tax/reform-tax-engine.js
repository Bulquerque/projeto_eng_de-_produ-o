import { getFiscalCategoryRule } from './fiscal-category-rules.js';
import { getRegimeTaxRates } from './tax-reform-parameters.js';
import { groupBy, safeNumber } from '../common.js';

export function calculateReformTax({
  fiscalFlows = [],
  taxRegime = 'reform_full_2033',
  demandMultiplier = 1,
  parameters = null,
  regimeDefinition = null,
} = {}) {
  const parameterRates = getRegimeTaxRates(taxRegime, parameters || undefined);
  const rates = regimeDefinition
    ? {
        ...parameterRates,
        cbs: regimeDefinition.cbs_rate ?? parameterRates.cbs,
        ibs: regimeDefinition.ibs_rate ?? parameterRates.ibs,
        selective: regimeDefinition.selective_rate ?? parameterRates.selective,
      }
    : parameterRates;
  const flowBreakdown = fiscalFlows.map((flow) => {
    const rule =
      regimeDefinition?.category_rules?.[flow.fiscal_category] ||
      regimeDefinition?.category_rules?.default_goods ||
      getFiscalCategoryRule(flow.fiscal_category);
    const grossRevenue = safeNumber(flow.gross_revenue) * safeNumber(demandMultiplier, 1);
    const cbs = grossRevenue * safeNumber(rates.cbs) * safeNumber(rule.cbs_rate_multiplier, 1);
    const ibs = grossRevenue * safeNumber(rates.ibs) * safeNumber(rule.ibs_rate_multiplier, 1);
    const selective =
      grossRevenue * safeNumber(rates.selective) * safeNumber(rule.selective_rate_multiplier, 0);
    const credits =
      flow.credit_eligible === false ? 0 : (cbs + ibs) * safeNumber(rule.credit_rate, 0);
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
      total_tax: total,
    };
  });

  const totals = flowBreakdown.reduce(
    (acc, row) => {
      acc.cbs_total += safeNumber(row.cbs);
      acc.ibs_total += safeNumber(row.ibs);
      acc.selective_tax_total += safeNumber(row.selective_tax);
      acc.credits_total += safeNumber(row.credits);
      acc.total_reform_tax += safeNumber(row.total_tax);
      return acc;
    },
    { cbs_total: 0, ibs_total: 0, selective_tax_total: 0, credits_total: 0, total_reform_tax: 0 }
  );

  const byDestination = groupBy(flowBreakdown, (row) => row.destination_uf);
  const byCategory = groupBy(flowBreakdown, (row) => row.fiscal_category);

  return {
    ...totals,
    flow_breakdown: flowBreakdown,
    tax_breakdown_by_destination_uf: Object.fromEntries(
      Object.entries(byDestination).map(([key, rows]) => [
        key,
        rows.reduce((sum, row) => sum + safeNumber(row.total_tax), 0),
      ])
    ),
    tax_breakdown_by_fiscal_category: Object.fromEntries(
      Object.entries(byCategory).map(([key, rows]) => [
        key,
        rows.reduce((sum, row) => sum + safeNumber(row.total_tax), 0),
      ])
    ),
    tax_breakdown_by_component: {
      current_tax: 0,
      cbs_total: totals.cbs_total,
      ibs_total: totals.ibs_total,
      selective_tax_total: totals.selective_tax_total,
      credits_total: totals.credits_total,
    },
    regime_rates: rates,
    rate_provenance: {
      source: regimeDefinition
        ? 'tax_reform_config_model_parameter'
        : 'tax_reform_parameters_default',
      status: 'parametric_model_assumption_not_observed_rate',
    },
  };
}

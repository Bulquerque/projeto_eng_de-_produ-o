import { groupBy, safeNumber } from '../common.js';

function normalizeText(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

function normalizeTaxRate(value) {
  const numeric = safeNumber(value, 0);
  return numeric > 1 ? numeric / 100 : numeric;
}

function firstValue(row, keys) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== '') return row[key];
  }
  return null;
}

function observedRate(row) {
  const direct = safeNumber(
    firstValue(row, [
      'Alq ICMS - Original',
      'alq_icms_original',
      'Alq ICMS Efetiva',
      'alq_icms_efetiva',
      'aliquota_icms_interestadual_base',
    ]),
    0
  );
  if (direct > 0) return normalizeTaxRate(direct);
  const taxValue = safeNumber(firstValue(row, ['Vlr ICMS - Original', 'vlr_icms_original']), 0);
  const revenue = safeNumber(
    firstValue(row, ['Receita Líquida', 'receita_liquida', 'Vlr. Total SD2']),
    0
  );
  return taxValue > 0 && revenue > 0 ? normalizeTaxRate(taxValue / revenue) : 0;
}

function buildObservedTaxIndex(taxData) {
  const exact = new Map();
  const byDestination = new Map();
  for (const row of taxData || []) {
    const destination = normalizeText(firstValue(row, ['UF_DESTINO', 'UF Destino']));
    const origin = normalizeText(firstValue(row, ['UF_ORIGEM', 'UF Origem']));
    const category = normalizeText(firstValue(row, ['CATEGORIA_NCM', 'Categoria NCM']));
    const rate = observedRate(row);
    if (!destination || !(rate > 0)) continue;
    const weightedRevenue = safeNumber(
      firstValue(row, ['Receita Líquida', 'receita_liquida', 'Vlr. Total SD2']),
      0
    );
    const entry = { rate, weight: Math.max(weightedRevenue, 1) };
    const exactKey = `${origin}|${destination}|${category}`;
    exact.set(exactKey, [...(exact.get(exactKey) || []), entry]);
    byDestination.set(destination, [...(byDestination.get(destination) || []), entry]);
  }
  const weightedRate = (rows) => {
    if (!rows?.length) return null;
    const totalWeight = rows.reduce((sum, row) => sum + row.weight, 0);
    return totalWeight > 0
      ? rows.reduce((sum, row) => sum + row.rate * row.weight, 0) / totalWeight
      : null;
  };
  return { exact, byDestination, weightedRate };
}

export function calculateCurrentTax({
  fiscalFlows = [],
  baseTaxBlock = {},
  demandMultiplier = 1,
  baselineBundle = {},
} = {}) {
  const totalTax = safeNumber(baseTaxBlock.total_tax_impact, 0);
  const totalRevenue = fiscalFlows.reduce((sum, flow) => sum + safeNumber(flow.gross_revenue), 0);
  const isEmpresa1 = baselineBundle?.model?.company_id === 'empresa1';
  const referenceRateReconciled = totalRevenue > 0 && totalTax > 0;
  const referenceRate = referenceRateReconciled ? totalTax / totalRevenue : 0.18;

  const taxData = baselineBundle?.core_data?.tax_data || [];
  const hasDetailedTax = Array.isArray(taxData) && taxData.length > 0;
  const observedIndex = buildObservedTaxIndex(hasDetailedTax ? taxData : []);
  const matchCounts = { exact: 0, destination_proxy: 0, fallback: 0 };

  const flowBreakdown = fiscalFlows.map((flow) => {
    const grossRevenue = safeNumber(flow.gross_revenue);
    let current = 0;

    let source = 'parametric_reference_rate';
    let appliedRate = referenceRate;

    if (isEmpresa1 && hasDetailedTax) {
      const originUf = String(flow.origin_uf || '')
        .trim()
        .toUpperCase();
      const destUf = String(flow.destination_uf || '')
        .trim()
        .toUpperCase();
      const match = taxData.find(
        (row) =>
          normalizeText(firstValue(row, ['UF_ORIGEM', 'uf_origem', 'UF Origem'])) === originUf &&
          normalizeText(firstValue(row, ['UF_DESTINO', 'uf_destino', 'UF Destino'])) === destUf
      );
      const observed = match ? observedRate(match) : 0;
      if (observed > 0) {
        appliedRate = observed;
        source = 'observed_origin_destination';
        matchCounts.exact += 1;
      } else {
        source = 'parametric_reference_rate';
        matchCounts.fallback += 1;
      }
    } else if (hasDetailedTax) {
      const origin = normalizeText(flow.origin_uf);
      const destination = normalizeText(flow.destination_uf);
      const category = normalizeText(flow.fiscal_category);
      const exactRows =
        origin && destination && category
          ? observedIndex.exact.get(`${origin}|${destination}|${category}`)
          : null;
      const exactRate = observedIndex.weightedRate(exactRows);
      const destinationRate = observedIndex.weightedRate(
        observedIndex.byDestination.get(destination)
      );
      if (exactRate != null) {
        appliedRate = exactRate;
        source = 'observed_origin_destination_category';
        matchCounts.exact += 1;
      } else if (destinationRate != null) {
        appliedRate = destinationRate;
        source = 'observed_destination_proxy';
        matchCounts.destination_proxy += 1;
      } else {
        matchCounts.fallback += 1;
      }
    } else {
      matchCounts.fallback += 1;
    }
    current = grossRevenue * appliedRate * safeNumber(demandMultiplier, 1);
    return {
      flow_id: flow.flow_id,
      destination_uf: flow.destination_uf,
      fiscal_category: flow.fiscal_category,
      current_tax: current,
      total_tax: current,
      tax_rate: appliedRate,
      tax_input_source: source,
      tax_input_confidence: source.startsWith('observed_')
        ? isEmpresa1
          ? 'external_official_reference'
          : 'observed_tenant'
        : referenceRateReconciled
          ? 'reconciled_baseline_parameter'
          : 'default_parameter',
    };
  });
  const totalCurrentTax = flowBreakdown.reduce((sum, row) => sum + safeNumber(row.current_tax), 0);
  const byDestination = groupBy(flowBreakdown, (row) => row.destination_uf);
  const byCategory = groupBy(flowBreakdown, (row) => row.fiscal_category);
  return {
    total_current_tax: totalCurrentTax,
    total_tax: totalCurrentTax,
    flow_breakdown: flowBreakdown,
    tax_breakdown_by_destination_uf: Object.fromEntries(
      Object.entries(byDestination).map(([key, rows]) => [
        key,
        rows.reduce((sum, row) => sum + safeNumber(row.current_tax), 0),
      ])
    ),
    tax_breakdown_by_fiscal_category: Object.fromEntries(
      Object.entries(byCategory).map(([key, rows]) => [
        key,
        rows.reduce((sum, row) => sum + safeNumber(row.current_tax), 0),
      ])
    ),
    tax_breakdown_by_component: {
      current_tax: totalCurrentTax,
      cbs_total: 0,
      ibs_total: 0,
      selective_tax_total: 0,
      credits_total: 0,
    },
    tax_input_match_summary: {
      ...matchCounts,
      observed_flow_count: matchCounts.exact + matchCounts.destination_proxy,
      fallback_flow_count: matchCounts.fallback,
      reference_rate: referenceRate,
      reference_rate_source: referenceRateReconciled
        ? 'reconciled_baseline_tax_over_revenue'
        : 'default_parameter_18_percent',
    },
  };
}

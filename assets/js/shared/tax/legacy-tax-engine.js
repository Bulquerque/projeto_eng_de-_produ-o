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

export function calculateLegacyTax({ fiscalFlows = [], baseTaxBlock = {}, demandMultiplier = 1, baselineBundle = {} } = {}) {
  const totalTax = n(baseTaxBlock.total_tax_impact, 0);
  const totalRevenue = fiscalFlows.reduce((sum, flow) => sum + n(flow.gross_revenue), 0);
  const referenceRate = totalRevenue > 0 ? totalTax / totalRevenue : 0.18;
  
  const taxData = baselineBundle?.core_data?.tax_data || [];
  const hasDetailedTax = Array.isArray(taxData) && taxData.length > 0;

  const flowBreakdown = fiscalFlows.map(flow => {
    const grossRevenue = n(flow.gross_revenue);
    let legacy = 0;

    if (hasDetailedTax) {
      // Look for a match in tax_data (dados_tributario)
      const match = taxData.find(row => 
        row.UF_DESTINO === flow.destination_uf && 
        (row.CATEGORIA_NCM === flow.fiscal_category || row['Categoria NCM'] === flow.fiscal_category)
      );
      if (match) {
        const alq = n(match['Alq ICMS - Original'] || match.alq_icms_original || match.Alq_ICMS_Cenário || match['Alq ICMS Efetiva'], referenceRate * 100) / 100;
        legacy = grossRevenue * alq * n(demandMultiplier, 1);
      } else {
        legacy = grossRevenue * referenceRate * n(demandMultiplier, 1);
      }
    } else {
      legacy = grossRevenue * referenceRate * n(demandMultiplier, 1);
    }
    return {
      flow_id: flow.flow_id,
      destination_uf: flow.destination_uf,
      fiscal_category: flow.fiscal_category,
      legacy_tax: legacy,
      total_tax: legacy
    };
  });
  const totalLegacyTax = flowBreakdown.reduce((sum, row) => sum + n(row.legacy_tax), 0);
  const byDestination = groupBy(flowBreakdown, row => row.destination_uf);
  const byCategory = groupBy(flowBreakdown, row => row.fiscal_category);
  return {
    total_legacy_tax: totalLegacyTax,
    total_tax: totalLegacyTax,
    flow_breakdown: flowBreakdown,
    tax_breakdown_by_destination_uf: Object.fromEntries(Object.entries(byDestination).map(([key, rows]) => [key, rows.reduce((sum, row) => sum + n(row.legacy_tax), 0)])),
    tax_breakdown_by_fiscal_category: Object.fromEntries(Object.entries(byCategory).map(([key, rows]) => [key, rows.reduce((sum, row) => sum + n(row.legacy_tax), 0)])),
    tax_breakdown_by_component: { legacy_tax: totalLegacyTax, cbs_total: 0, ibs_total: 0, selective_tax_total: 0, credits_total: 0 }
  };
}

import { groupBy, safeNumber } from '../common.js';

export function calculateCurrentTax({
  fiscalFlows = [],
  baseTaxBlock = {},
  demandMultiplier = 1,
  baselineBundle = {},
} = {}) {
  const totalTax = safeNumber(baseTaxBlock.total_tax_impact, 0);
  const totalRevenue = fiscalFlows.reduce((sum, flow) => sum + safeNumber(flow.gross_revenue), 0);
  const isEmpresa1 = baselineBundle?.model?.company_id === 'empresa1';
  const referenceRate = totalRevenue > 0 && totalTax > 0 ? totalTax / totalRevenue : 0.18;

  const taxData = baselineBundle?.core_data?.tax_data || [];
  const hasDetailedTax = Array.isArray(taxData) && taxData.length > 0;

  const flowBreakdown = fiscalFlows.map((flow) => {
    const grossRevenue = safeNumber(flow.gross_revenue);
    let current = 0;

    if (isEmpresa1 && hasDetailedTax) {
      const originUf = String(flow.origin_uf || '')
        .trim()
        .toUpperCase();
      const destUf = String(flow.destination_uf || '')
        .trim()
        .toUpperCase();
      const match = taxData.find(
        (row) =>
          String(row.uf_origem || '')
            .trim()
            .toUpperCase() === originUf &&
          String(row.uf_destino || '')
            .trim()
            .toUpperCase() === destUf
      );
      const alq =
        match && match.aliquota_icms_interestadual_base != null
          ? safeNumber(match.aliquota_icms_interestadual_base)
          : 0.18;
      current = grossRevenue * alq * safeNumber(demandMultiplier, 1);
    } else if (hasDetailedTax) {
      // Look for a match in tax_data (dados_tributario)
      const match = taxData.find(
        (row) =>
          row.UF_DESTINO === flow.destination_uf &&
          (row.CATEGORIA_NCM === flow.fiscal_category ||
            row['Categoria NCM'] === flow.fiscal_category)
      );
      if (match) {
        const alq =
          safeNumber(
            match['Alq ICMS - Original'] ||
              match.alq_icms_original ||
              match.Alq_ICMS_Cenário ||
              match['Alq ICMS Efetiva'],
            referenceRate * 100
          ) / 100;
        current = grossRevenue * alq * safeNumber(demandMultiplier, 1);
      } else {
        current = grossRevenue * referenceRate * safeNumber(demandMultiplier, 1);
      }
    } else {
      current = grossRevenue * referenceRate * safeNumber(demandMultiplier, 1);
    }
    return {
      flow_id: flow.flow_id,
      destination_uf: flow.destination_uf,
      fiscal_category: flow.fiscal_category,
      current_tax: current,
      total_tax: current,
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
  };
}

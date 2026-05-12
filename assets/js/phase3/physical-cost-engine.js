/**
 * physical-cost-engine.js
 *
 * Calculates per-flow logistics costs from real data tables.
 *
 * Empresa 1 — distance_matrix  : weight_kg × Frete(R$/kg)
 * Empresa 2 — tabelas_cif_dist : weight-bracket rate lookup
 *             aux_custo_transferencia : real NF-based transfer rates
 *             aux_custo_armazenagem   : real storage tariffs per CD
 */

function toNum(value, fallback = 0) {
  const x = Number(value);
  return Number.isFinite(x) ? x : fallback;
}

function up(value) {
  return String(value || '').trim().toUpperCase();
}

function flowWeight(flow) {
  return toNum(flow.annual_weight_kg ?? flow.weight_kg ?? flow.volume ?? 0);
}

function flowRevenue(flow) {
  return toNum(flow.annual_revenue ?? flow.revenue ?? 0);
}

/** Proportional storage estimate when the real table has no match. */
function storageRatioCost(base, activeCds, baselineCds, dm) {
  const ratio = 0.65 + 0.35 * (activeCds.length / (baselineCds || 1));
  return toNum(base.storage_cost) * dm * ratio;
}

/** Heuristic baseline costs scaled by freight and demand multipliers. */
function heuristicFallback(base, fm, dm) {
  return {
    transfer_cost: toNum(base.transfer_cost) * fm * dm,
    distribution_cost: toNum(base.distribution_cost) * fm * dm,
  };
}


// ── Empresa 1 helpers ────────────────────────────────────────────────────────

/**
 * Returns the freight rate (R$/kg) for origin→destination from the
 * distance_matrix, or null when the pair is not found.
 */
function lookupFreightRateE1(origin, dest, matrix) {
  if (!Array.isArray(matrix) || !matrix.length) return null;

  const o = up(origin);
  const d = up(dest);

  const row =
    matrix.find(r => up(r.ORIGEM || r.UF_ORIGEM) === o && up(r.DESTINO || r.UF_DESTINO) === d) ||
    matrix.find(r => up(r.UF_ORIGEM) === o && up(r.UF_DESTINO) === d);

  return row ? toNum(row['Frete (R$/Kg)'] ?? row.frete_por_kg, null) : null;
}

/** Returns { cost, method, rate } for one flow using the distance matrix. */
function calcFlowFreightE1(flow, matrix, fm) {
  const weightKg = flowWeight(flow);
  if (weightKg <= 0) return { cost: 0, method: 'zero_weight', rate: 0 };

  const cd   = flow.cd   || flow.origin        || flow.cd_uf  || '';
  const dest = flow.destination || flow.destination_uf || flow.centroid || '';

  let rate = lookupFreightRateE1(cd, dest, matrix);

  if (rate === null) {
    const cdUf = flow.cd_uf  || String(cd).slice(0, 2);
    const dUf  = flow.destination_uf || String(dest).slice(0, 2);
    rate = lookupFreightRateE1(cdUf, dUf, matrix);
  }

  if (rate === null) return { cost: 0, method: 'missing_rate', rate: 0 };

  return { cost: weightKg * rate * toNum(fm, 1), method: 'distance_matrix', rate };
}


// ── Empresa 2 helpers ────────────────────────────────────────────────────────

/** Selects the CIF rate (R$/kg) for the appropriate weight bracket. */
function getCifRateForWeight(row, weightKg) {
  if (weightKg <= 10)  return toNum(row['Até 10kg']           ?? row['Ate 10kg']);
  if (weightKg <= 20)  return toNum(row['10 a 20kg']);
  if (weightKg <= 30)  return toNum(row['20 a 30kg']);
  if (weightKg <= 50)  return toNum(row['30 a 50kg']);
  if (weightKg <= 70)  return toNum(row['50 a 70kg']);
  if (weightKg <= 100) return toNum(row['70 a 100kg']);
  return toNum(row['Acima 100kg (R$/kg)'] ?? row['Acima 100kg']);
}

function lookupCifRow(origin, dest, cifTable) {
  if (!Array.isArray(cifTable) || !cifTable.length) return null;

  const o = up(origin);
  const d = up(dest);

  return (
    cifTable.find(r => up(r.Origem) === o && up(r.Destino) === d) ||
    cifTable.find(r => up(r.UF || r.Origem) === o && up(r.Destino) === d) ||
    // Last resort: UF-level partial match
    cifTable.find(r =>
      up(r.UF) === String(origin || '').slice(0, 2).toUpperCase() &&
      up(r.Destino).includes(String(dest || '').slice(0, 2).toUpperCase())
    )
  );
}

/** Returns { cost, method, rate } for one flow using the CIF table. */
function calcFlowFreightE2(flow, cifTable, fm) {
  const weightKg = flowWeight(flow);
  if (weightKg <= 0) return { cost: 0, method: 'zero_weight', rate: 0 };

  const origin = flow.cd || flow.origin || flow.cd_uf || flow.origin_uf || '';
  const dest   = flow.destination || flow.destination_uf || '';
  const fmNum  = toNum(fm, 1);

  const row = lookupCifRow(origin, dest, cifTable);

  if (!row) {
    const revenue = flowRevenue(flow);
    if (revenue > 0) {
      const pct = 0.025; // 2.5% revenue fallback when no CIF row exists
      return { cost: revenue * pct * fmNum, method: 'revenue_pct_fallback', rate: pct };
    }
    return { cost: 0, method: 'missing_cif_row', rate: 0 };
  }

  const rate = getCifRateForWeight(row, weightKg);

  if (rate <= 0) {
    // Row exists but bracket is zero — fall back to the flat % on revenue
    const pct     = toNum(row['Frete Valor (Decimal)'], 0);
    const revenue = flowRevenue(flow);
    if (pct > 0 && revenue > 0) {
      return { cost: revenue * pct * fmNum, method: 'cif_pct_revenue', rate: pct };
    }
    return { cost: 0, method: 'zero_rate', rate: 0 };
  }

  return { cost: weightKg * rate * fmNum, method: 'cif_bracket', rate };
}

/**
 * Builds a map of average R$/kg transfer rates per origin→destination UF
 * pair, derived from real NF data in aux_custo_transferencia.
 */
function buildTransferRateMapE2(transferTable) {
  if (!Array.isArray(transferTable) || !transferTable.length) return {};

  const acc = {};
  for (const row of transferTable) {
    const key   = `${up(row.ORIGEM || row['ORIGEM UF'])}→${up(row['DESTINO UF'])}`;
    const peso  = toNum(row.PESO);
    const frete = toNum(row['FRETE VALOR']);
    if (peso <= 0 || frete <= 0) continue;
    acc[key] = acc[key] || { totalFrete: 0, totalPeso: 0 };
    acc[key].totalFrete += frete;
    acc[key].totalPeso  += peso;
  }

  return Object.fromEntries(
    Object.entries(acc).map(([k, v]) => [k, v.totalPeso > 0 ? v.totalFrete / v.totalPeso : 0])
  );
}

/**
 * Builds a map of total monthly storage cost per CD filial
 * from aux_custo_armazenagem.
 */
function buildStorageCostMapE2(storageTable) {
  if (!Array.isArray(storageTable) || !storageTable.length) return {};

  const map = {};
  for (const row of storageTable) {
    const filial = up(row.Filial);
    if (!filial) continue;
    map[filial] = (map[filial] || 0) + toNum(row.Custo);
  }
  return map;
}

/** Returns the real annual storage cost for the active CDs, or null if no match. */
function resolveStorageCostFromTable(storageCostMap, activeCds, dm) {
  if (!Object.keys(storageCostMap).length) return null;

  let total = 0;
  for (const cd of activeCds) {
    const key = up(cd);
    const cost =
      storageCostMap[key] ||
      Object.entries(storageCostMap).find(([k]) => key.includes(k) || k.includes(key))?.[1] ||
      0;
    total += cost;
  }

  return total > 0 ? total * 12 * dm : null; // annualise monthly figures
}


// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Calculates physical logistics costs bottom-up for all rebuilt flows.
 *
 * @param {{ companyId: string, scenario: object, baselineBundle: object, rebuilt: object }} params
 * @returns {{ transfer_cost, distribution_cost, storage_cost, inventory_cost,
 *             calculation_method, flow_cost_detail, warnings }}
 */
export function calculatePhysicalCosts({ companyId, scenario, baselineBundle, rebuilt }) {
  const c         = scenario.changes || {};
  const fm        = toNum(c.freight_multiplier, 1);
  const dm        = toNum(c.demand_multiplier, 1);
  const invDays   = toNum(c.inventory_days, 45);
  const wacc      = toNum(c.wacc, 0.15);
  const activeCds = c.active_cds || [];
  const base      = baselineBundle?.costs?.costs || {};
  const coreData  = baselineBundle?.core_data || {};
  const baselineCds = (baselineBundle?.model?.active_cds || []).length;
  const inventory = toNum(base.inventory_cost) * dm * (invDays / 45) * (wacc / 0.15);
  const warnings  = [];

  if (companyId === 'empresa1') {
    const matrix = coreData.distance_matrix || [];
    if (!matrix.length) warnings.push('distance_matrix não disponível; usando fallback heurístico.');

    let totalDist = 0;
    let totalTransfer = 0;
    let missingCount = 0;
    const flowCostDetail = [];

    for (const flow of rebuilt.flows) {
      const { cost, method, rate } = calcFlowFreightE1(flow, matrix, fm);
      const distCost     = cost * dm;
      // Reallocated flows carry an inbound transfer leg (≈40% of outbound).
      const transferCost = flow.reallocation_status === 'reallocated' ? distCost * 0.40 : 0;

      totalDist     += distCost;
      totalTransfer += transferCost;
      if (method === 'missing_rate') missingCount++;
      flowCostDetail.push({ flow_id: flow.flow_id, distribution_cost: distCost, transfer_cost: transferCost, method, rate });
    }

    if (missingCount > 0) {
      warnings.push(`${missingCount} fluxo(s) sem tarifa na distance_matrix; custo zerado nesses fluxos.`);
    }

    const anyPriced = flowCostDetail.some(r => r.method === 'distance_matrix');
    if (!anyPriced && toNum(base.distribution_cost) > 0) {
      warnings.push('Nenhum fluxo precificado pela distance_matrix; aplicando fallback heurístico.');
      ({ transfer_cost: totalTransfer, distribution_cost: totalDist } = heuristicFallback(base, fm, dm));
    }

    return {
      transfer_cost:      totalTransfer,
      distribution_cost:  totalDist,
      storage_cost:       storageRatioCost(base, activeCds, baselineCds, dm),
      inventory_cost:     inventory,
      calculation_method: anyPriced ? 'physical_distance_matrix' : 'heuristic_fallback',
      flow_cost_detail:   flowCostDetail,
      warnings,
    };
  }

  if (companyId === 'empresa2') {
    const cifTable      = coreData.tabelas_cif_dist || coreData.cif_table || [];
    const transferTable = coreData.aux_custo_transferencia || [];
    const storageTable  = coreData.aux_custo_armazenagem   || [];

    if (!cifTable.length)      warnings.push('tabelas_cif_dist não disponível; usando % da receita como fallback.');
    if (!transferTable.length) warnings.push('aux_custo_transferencia não disponível; estimando transferência.');
    if (!storageTable.length)  warnings.push('aux_custo_armazenagem não disponível; usando custo proporcional do baseline.');

    const transferRateMap = buildTransferRateMapE2(transferTable);
    const storageCostMap  = buildStorageCostMapE2(storageTable);

    let totalDist = 0;
    let totalTransfer = 0;
    let missingCount = 0;
    const flowCostDetail = [];

    for (const flow of rebuilt.flows) {
      const { cost: distCost, method: distMethod, rate: distRate } = calcFlowFreightE2(flow, cifTable, fm);
      const distributionCost = distCost * dm;

      let transferCost = 0;
      if (flow.reallocation_status === 'reallocated') {
        const originUf = up(flow.cd_uf || flow.origin_uf || flow.cd).slice(0, 2);
        const destUf   = up(flow.destination_uf);
        const key      = `${originUf}→${destUf}`;
        const ratePerKg = transferRateMap[key] || transferRateMap[`${originUf}→`] || 0;
        const wKg       = flowWeight(flow);
        transferCost = wKg > 0 && ratePerKg > 0
          ? wKg * ratePerKg * fm * dm
          : flowRevenue(flow) * 0.025 * fm * dm; // 2.5% revenue fallback
      }

      totalDist     += distributionCost;
      totalTransfer += transferCost;
      if (distMethod === 'missing_cif_row') missingCount++;
      flowCostDetail.push({ flow_id: flow.flow_id, distribution_cost: distributionCost, transfer_cost: transferCost, dist_method: distMethod, dist_rate: distRate });
    }

    if (missingCount > 0) {
      warnings.push(`${missingCount} fluxo(s) sem linha na tabela CIF; custo zerado nesses fluxos.`);
    }

    const anyPriced = flowCostDetail.some(r => r.dist_method === 'cif_bracket' || r.dist_method === 'cif_pct_revenue');
    if (!anyPriced && toNum(base.distribution_cost) > 0) {
      warnings.push('Nenhum fluxo precificado pela tabela CIF; aplicando fallback heurístico.');
      ({ transfer_cost: totalTransfer, distribution_cost: totalDist } = heuristicFallback(base, fm, dm));
    }

    const realStorage = resolveStorageCostFromTable(storageCostMap, activeCds, dm);
    if (realStorage === null) {
      warnings.push('CDs do cenário sem correspondência na tabela de armazenagem; usando custo proporcional do baseline.');
    }
    const storage = realStorage ?? storageRatioCost(base, activeCds, baselineCds, dm);

    return {
      transfer_cost:      totalTransfer,
      distribution_cost:  totalDist,
      storage_cost:       storage,
      inventory_cost:     inventory,
      calculation_method: anyPriced ? 'physical_cif_table' : 'heuristic_fallback',
      flow_cost_detail:   flowCostDetail,
      warnings,
    };
  }

  // Unknown company — explicit safe fallback
  warnings.push(`companyId desconhecido: "${companyId}"; usando heurística genérica.`);
  return {
    transfer_cost:      toNum(base.transfer_cost)     * fm * dm,
    distribution_cost:  toNum(base.distribution_cost) * fm * dm,
    storage_cost:       storageRatioCost(base, activeCds, baselineCds, dm),
    inventory_cost:     inventory,
    calculation_method: 'heuristic_fallback',
    flow_cost_detail:   [],
    warnings,
  };
}

/**
 * physical-cost-engine.js
 *
 * Calculates per-flow physical freight costs using real data tables
 * instead of generic percentage heuristics.
 *
 * Empresa 1: distance_matrix → weight_kg × freight_rate_R$/kg
 * Empresa 2: tabelas_cif_dist → weight bracket lookup (R$/kg table)
 *            aux_custo_transferencia → real NF-based transfer rates
 *            aux_custo_armazenagem  → real storage tariffs
 */

function n(value, fallback = 0) {
  const x = Number(value);
  return Number.isFinite(x) ? x : fallback;
}

// ─────────────────────────────────────────────
// EMPRESA 1: distance_matrix based freight
// ─────────────────────────────────────────────

/**
 * Returns the freight rate (R$/kg) for origin→destination from the
 * distance_matrix. Falls back to null when the pair is absent.
 *
 * distance_matrix row fields (from catalog):
 *   UF_ORIGEM, ORIGEM, UF_DESTINO, DESTINO,
 *   Latitude_Origem, Longitude_Origem, Latitude_Destino, Longitude_Destino,
 *   Distancia(KM), Frete (R$/Kg)
 */
function lookupFreightRateE1(origin, destino, distanceMatrix) {
  if (!Array.isArray(distanceMatrix) || !distanceMatrix.length) return null;

  const o = String(origin || '').trim().toUpperCase();
  const d = String(destino || '').trim().toUpperCase();

  // Try exact city match first, then UF match
  const row =
    distanceMatrix.find(
      r =>
        String(r.ORIGEM || r.UF_ORIGEM || '').trim().toUpperCase() === o &&
        String(r.DESTINO || r.UF_DESTINO || '').trim().toUpperCase() === d
    ) ||
    distanceMatrix.find(
      r =>
        String(r.UF_ORIGEM || '').trim().toUpperCase() === o &&
        String(r.UF_DESTINO || '').trim().toUpperCase() === d
    );

  if (!row) return null;
  return n(row['Frete (R$/Kg)'] ?? row.frete_por_kg, null);
}

/**
 * Calculates distribution cost for a single flow using the real freight
 * rate from the distance matrix.
 *
 * Returns { cost, method, rate } where method signals how cost was found.
 */
function calcFlowFreightE1(flow, distanceMatrix, freightMultiplier) {
  const weightKg = n(flow.annual_weight_kg ?? flow.weight_kg ?? flow.volume ?? 0);
  if (weightKg <= 0) return { cost: 0, method: 'zero_weight', rate: 0 };

  const cd = flow.cd || flow.origin || flow.cd_uf || '';
  const dest = flow.destination || flow.destination_uf || flow.centroid || '';

  // 1st try: CD city → destination city
  let rate = lookupFreightRateE1(cd, dest, distanceMatrix);
  if (rate === null) {
    // 2nd try: CD UF → destination UF
    const cdUf = flow.cd_uf || String(cd).slice(0, 2);
    const dUf = flow.destination_uf || String(dest).slice(0, 2);
    rate = lookupFreightRateE1(cdUf, dUf, distanceMatrix);
  }

  if (rate === null) {
    return { cost: 0, method: 'missing_rate', rate: 0 };
  }

  const cost = weightKg * rate * n(freightMultiplier, 1);
  return { cost, method: 'distance_matrix', rate };
}

// ─────────────────────────────────────────────
// EMPRESA 2: CIF table bracket lookup
// ─────────────────────────────────────────────

/**
 * tabelas_cif_dist row fields (from catalog):
 *   Origem, UF, Destino,
 *   Até 10kg, 10 a 20kg, 20 a 30kg, 30 a 50kg,
 *   50 a 70kg, 70 a 100kg, Acima 100kg (R$/kg),
 *   Frete Valor (Decimal)
 *
 * Returns rate in R$/kg for the given weight bracket.
 */
function getCifRateForWeight(row, weightKg) {
  if (weightKg <= 10) return n(row['Até 10kg'] ?? row['Ate 10kg']);
  if (weightKg <= 20) return n(row['10 a 20kg']);
  if (weightKg <= 30) return n(row['20 a 30kg']);
  if (weightKg <= 50) return n(row['30 a 50kg']);
  if (weightKg <= 70) return n(row['50 a 70kg']);
  if (weightKg <= 100) return n(row['70 a 100kg']);
  return n(row['Acima 100kg (R$/kg)'] ?? row['Acima 100kg']);
}

function lookupCifRow(origin, dest, cifTable) {
  if (!Array.isArray(cifTable) || !cifTable.length) return null;

  const o = String(origin || '').trim().toUpperCase();
  const d = String(dest || '').trim().toUpperCase();

  return (
    cifTable.find(
      r =>
        String(r.Origem || '').trim().toUpperCase() === o &&
        String(r.Destino || '').trim().toUpperCase() === d
    ) ||
    cifTable.find(
      r =>
        String(r.UF || r.Origem || '').trim().toUpperCase() === o &&
        String(r.Destino || '').trim().toUpperCase() === d
    ) ||
    // UF-level match as last resort
    cifTable.find(
      r =>
        String(r.UF || '').trim().toUpperCase() === String(origin || '').slice(0, 2).toUpperCase() &&
        String(r.Destino || '').trim().toUpperCase().includes(String(dest || '').slice(0, 2).toUpperCase())
    )
  );
}

function calcFlowFreightE2(flow, cifTable, freightMultiplier) {
  const weightKg = n(flow.annual_weight_kg ?? flow.weight_kg ?? flow.volume ?? 0);
  if (weightKg <= 0) return { cost: 0, method: 'zero_weight', rate: 0 };

  const origin = flow.cd || flow.origin || flow.cd_uf || flow.origin_uf || '';
  const dest = flow.destination || flow.destination_uf || '';

  const row = lookupCifRow(origin, dest, cifTable);
  if (!row) {
    // Fallback: use "Frete Valor (Decimal)" field as percentage of revenue
    const revenue = n(flow.annual_revenue ?? flow.revenue ?? 0);
    if (revenue > 0) {
      const pct = n(row?.['Frete Valor (Decimal)'], 0.025); // 2.5% default
      return { cost: revenue * pct * n(freightMultiplier, 1), method: 'revenue_pct_fallback', rate: pct };
    }
    return { cost: 0, method: 'missing_cif_row', rate: 0 };
  }

  const rate = getCifRateForWeight(row, weightKg);
  if (rate <= 0) {
    // Try the flat percentage rate on revenue
    const revenue = n(flow.annual_revenue ?? flow.revenue ?? 0);
    const pct = n(row['Frete Valor (Decimal)'], 0);
    if (pct > 0 && revenue > 0) {
      return { cost: revenue * pct * n(freightMultiplier, 1), method: 'cif_pct_revenue', rate: pct };
    }
    return { cost: 0, method: 'zero_rate', rate: 0 };
  }

  const cost = weightKg * rate * n(freightMultiplier, 1);
  return { cost, method: 'cif_bracket', rate };
}

// ─────────────────────────────────────────────
// Transfer cost lookup (Empresa 2)
// ─────────────────────────────────────────────

/**
 * aux_custo_transferencia fields:
 *   ORIGEM, ORIGEM UF, DESTINO UF, PESO, FRETE VALOR, FRETE %
 *
 * Computes an average R$/kg rate from real NFs for the given O→D pair.
 */
function buildTransferRateMapE2(transferTable) {
  if (!Array.isArray(transferTable) || !transferTable.length) return {};
  const map = {};
  for (const row of transferTable) {
    const key = `${String(row.ORIGEM || row['ORIGEM UF'] || '').trim().toUpperCase()}→${String(row['DESTINO UF'] || '').trim().toUpperCase()}`;
    const peso = n(row.PESO);
    const frete = n(row['FRETE VALOR']);
    if (peso > 0 && frete > 0) {
      if (!map[key]) map[key] = { totalFrete: 0, totalPeso: 0 };
      map[key].totalFrete += frete;
      map[key].totalPeso += peso;
    }
  }
  // Convert to average R$/kg
  return Object.fromEntries(
    Object.entries(map).map(([k, v]) => [k, v.totalPeso > 0 ? v.totalFrete / v.totalPeso : 0])
  );
}

// ─────────────────────────────────────────────
// Storage cost lookup (Empresa 2)
// ─────────────────────────────────────────────

/**
 * aux_custo_armazenagem fields:
 *   Filial, Itens, Tipo, Tarifas, UN, Qtd. Média 3M, Custo
 *
 * Returns total monthly storage cost per CD.
 */
function buildStorageCostMapE2(storageTable) {
  if (!Array.isArray(storageTable) || !storageTable.length) return {};
  const map = {};
  for (const row of storageTable) {
    const filial = String(row.Filial || '').trim().toUpperCase();
    if (!filial) continue;
    if (!map[filial]) map[filial] = 0;
    map[filial] += n(row.Custo);
  }
  return map;
}

// ─────────────────────────────────────────────
// MAIN PUBLIC API
// ─────────────────────────────────────────────

/**
 * Calculates physical costs bottom-up for all rebuilt flows.
 *
 * @param {object} params
 * @param {string} params.companyId  - 'empresa1' | 'empresa2'
 * @param {object} params.scenario   - scenario object with changes
 * @param {object} params.baselineBundle - decrypted phase2 bundle (with core_data)
 * @param {object} params.rebuilt    - output of rebuildScenarioFlows
 *
 * @returns {{
 *   transfer_cost: number,
 *   distribution_cost: number,
 *   storage_cost: number,
 *   inventory_cost: number,
 *   calculation_method: string,
 *   flow_cost_detail: object[],
 *   warnings: string[]
 * }}
 */
export function calculatePhysicalCosts({ companyId, scenario, baselineBundle, rebuilt }) {
  const c = scenario.changes || {};
  const fm = n(c.freight_multiplier, 1);
  const dm = n(c.demand_multiplier, 1);
  const invDays = n(c.inventory_days, 45);
  const wacc = n(c.wacc, 0.15);
  const activeCds = (c.active_cds || []);
  const base = baselineBundle?.costs?.costs || {};

  const coreData = baselineBundle?.core_data || {};
  const warnings = [];

  // ── Empresa 1 ───────────────────────────────
  if (companyId === 'empresa1') {
    const distanceMatrix = coreData.distance_matrix || [];
    if (!distanceMatrix.length) {
      warnings.push('distance_matrix não disponível; usando heurística de fallback.');
    }

    let totalDistribution = 0;
    let totalTransfer = 0;
    const flowCostDetail = [];
    let missingRateCount = 0;

    for (const flow of rebuilt.flows) {
      const { cost, method, rate } = calcFlowFreightE1(flow, distanceMatrix, fm);

      // Flows that moved between CDs carry a transfer leg too (industry→CD).
      // We approximate the transfer leg as 40% of the distribution cost
      // (inbound is typically cheaper than outbound in Brazilian logistics).
      const isTransfer = flow.reallocation_status === 'reallocated';
      const distributionCost = cost * dm;
      const transferCost = isTransfer ? distributionCost * 0.40 : 0;

      totalDistribution += distributionCost;
      totalTransfer += transferCost;

      if (method === 'missing_rate') missingRateCount++;
      flowCostDetail.push({ flow_id: flow.flow_id, distribution_cost: distributionCost, transfer_cost: transferCost, method, rate });
    }

    if (missingRateCount > 0) {
      warnings.push(`${missingRateCount} fluxo(s) sem tarifa na distance_matrix; custo de frete zerado para esses fluxos.`);
    }

    // If we couldn't price any flow at all, fall back to heuristic
    const anyPriced = flowCostDetail.some(r => r.method === 'distance_matrix');
    if (!anyPriced && n(base.distribution_cost) > 0) {
      warnings.push('Nenhum fluxo foi precificado pela distance_matrix; aplicando fallback heurístico.');
      totalDistribution = n(base.distribution_cost) * fm * dm;
      totalTransfer = n(base.transfer_cost) * fm * dm;
    }

    // Storage: no detailed table for E1 → ratio model based on open CDs
    const baseCds = (baselineBundle?.model?.active_cds || []).length || 1;
    const storageRatio = 0.65 + 0.35 * (activeCds.length / baseCds);
    const storage = n(base.storage_cost) * dm * storageRatio;

    // Inventory
    const inventory = n(base.inventory_cost) * dm * (invDays / 45) * (wacc / 0.15);

    return {
      transfer_cost: totalTransfer,
      distribution_cost: totalDistribution,
      storage_cost: storage,
      inventory_cost: inventory,
      calculation_method: anyPriced ? 'physical_distance_matrix' : 'heuristic_fallback',
      flow_cost_detail: flowCostDetail,
      warnings
    };
  }

  // ── Empresa 2 ───────────────────────────────
  if (companyId === 'empresa2') {
    const cifTable = coreData.tabelas_cif_dist || coreData.cif_table || [];
    const transferTable = coreData.aux_custo_transferencia || [];
    const storageTable = coreData.aux_custo_armazenagem || [];

    if (!cifTable.length) warnings.push('tabelas_cif_dist não disponível; fallback para frete % da receita.');
    if (!transferTable.length) warnings.push('aux_custo_transferencia não disponível; estimando transferência.');
    if (!storageTable.length) warnings.push('aux_custo_armazenagem não disponível; usando custo de armazenagem do baseline.');

    const transferRateMap = buildTransferRateMapE2(transferTable);
    const storageCostMap = buildStorageCostMapE2(storageTable);

    let totalDistribution = 0;
    let totalTransfer = 0;
    const flowCostDetail = [];
    let missingCifCount = 0;

    for (const flow of rebuilt.flows) {
      // Distribution cost via CIF table
      const { cost: distCost, method: distMethod, rate: distRate } = calcFlowFreightE2(flow, cifTable, fm);
      const distributionCost = distCost * dm;

      // Transfer cost via real NF rates
      let transferCost = 0;
      if (flow.reallocation_status === 'reallocated') {
        const originUf = String(flow.cd_uf || flow.origin_uf || flow.cd || '').trim().toUpperCase().slice(0, 2);
        const destUf = String(flow.destination_uf || '').trim().toUpperCase();
        const key = `${originUf}→${destUf}`;
        const ratePerKg = transferRateMap[key] || transferRateMap[`${originUf}→`] || 0;
        const weightKg = n(flow.annual_weight_kg ?? flow.weight_kg ?? flow.volume ?? 0);
        transferCost = weightKg > 0 && ratePerKg > 0
          ? weightKg * ratePerKg * fm * dm
          : n(flow.transfer_cost ?? flow.annual_revenue ?? 0) * 0.025 * fm * dm; // 2.5% revenue fallback
      }

      totalDistribution += distributionCost;
      totalTransfer += transferCost;
      if (distMethod === 'missing_cif_row') missingCifCount++;

      flowCostDetail.push({
        flow_id: flow.flow_id,
        distribution_cost: distributionCost,
        transfer_cost: transferCost,
        dist_method: distMethod,
        dist_rate: distRate
      });
    }

    if (missingCifCount > 0) {
      warnings.push(`${missingCifCount} fluxo(s) sem linha na tabela CIF; custo zerado para esses fluxos.`);
    }

    // If nothing could be priced, fall back to baseline heuristic
    const anyPriced = flowCostDetail.some(r => r.dist_method === 'cif_bracket' || r.dist_method === 'cif_pct_revenue');
    if (!anyPriced && n(base.distribution_cost) > 0) {
      warnings.push('Nenhum fluxo foi precificado pela tabela CIF; aplicando fallback heurístico.');
      totalDistribution = n(base.distribution_cost) * fm * dm;
      totalTransfer = n(base.transfer_cost) * fm * dm;
    }

    // Storage: use real tariff table aggregated by active CDs
    let storage = 0;
    if (Object.keys(storageCostMap).length > 0) {
      for (const cd of activeCds) {
        const cdKey = String(cd).trim().toUpperCase();
        // Try exact match, then prefix match
        const cost =
          storageCostMap[cdKey] ||
          Object.entries(storageCostMap).find(([k]) => cdKey.includes(k) || k.includes(cdKey))?.[1] ||
          0;
        storage += cost;
      }
      // Annualize if values appear monthly (12×)
      storage = storage * 12 * dm;
      if (storage === 0) {
        // No match found in real table; fall back to baseline ratio
        const baseCds = (baselineBundle?.model?.active_cds || []).length || 1;
        const storageRatio = 0.65 + 0.35 * (activeCds.length / baseCds);
        storage = n(base.storage_cost) * dm * storageRatio;
        warnings.push('CDs do cenário não encontrados na tabela de armazenagem; usando baseline proporcional.');
      }
    } else {
      const baseCds = (baselineBundle?.model?.active_cds || []).length || 1;
      const storageRatio = 0.65 + 0.35 * (activeCds.length / baseCds);
      storage = n(base.storage_cost) * dm * storageRatio;
    }

    // Inventory
    const inventory = n(base.inventory_cost) * dm * (invDays / 45) * (wacc / 0.15);

    return {
      transfer_cost: totalTransfer,
      distribution_cost: totalDistribution,
      storage_cost: storage,
      inventory_cost: inventory,
      calculation_method: anyPriced ? 'physical_cif_table' : 'heuristic_fallback',
      flow_cost_detail: flowCostDetail,
      warnings
    };
  }

  // ── Unknown company → safe fallback ──────────
  warnings.push(`Empresa "${companyId}" desconhecida; usando heurística genérica.`);
  const baseCds = (baselineBundle?.model?.active_cds || []).length || 1;
  const storageRatio = 0.65 + 0.35 * (activeCds.length / baseCds);
  return {
    transfer_cost: n(base.transfer_cost) * fm * dm,
    distribution_cost: n(base.distribution_cost) * fm * dm,
    storage_cost: n(base.storage_cost) * dm * storageRatio,
    inventory_cost: n(base.inventory_cost) * dm * (invDays / 45) * (wacc / 0.15),
    calculation_method: 'heuristic_fallback',
    flow_cost_detail: [],
    warnings
  };
}

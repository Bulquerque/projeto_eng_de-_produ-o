/**
 * physical-cost-engine.js
 *
 * Calculates per-flow logistics costs from real data tables.
 *
 * Empresa 1 — distance_matrix       : weight_kg × Frete(R$/kg) for distribution
 *             aux_custo_transferencia: kilometric rate (R$/kg-km) from Empresa 2
 *               → Transfer = weight_kg × rate_per_kg_km[destUF] × distance_km
 * Empresa 2 — tabelas_cif_dist : weight-bracket rate lookup
 *             aux_custo_transferencia : real NF-based transfer rates
 *             aux_custo_armazenagem   : real storage tariffs per CD
 *
 * Kilometric rates for Empresa 1 transfer (calibrated from Empresa 2 NF data):
 *   SP: 0.0083 R$/kg-km  |  MG: 0.0049 R$/kg-km
 *   ES: 0.0176 R$/kg-km  |  RJ: 0.0133 R$/kg-km
 *   fallback (cross-state): 0.0050 R$/kg-km
 */

function toNum(value, fallback = 0) {
  const x = Number(value);
  return Number.isFinite(x) ? x : fallback;
}

function up(value) {
  return String(value || '')
    .trim()
    .toUpperCase();
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
function heuristicFallback(base, fm, dm, companyId = '') {
  const baseDist = toNum(base.distribution_cost);
  const baseTransfer = toNum(base.transfer_cost);
  if (companyId === 'empresa1' && baseTransfer === 0) {
    return {
      transfer_cost: baseDist * fm * dm * 0.4,
      distribution_cost: baseDist * fm * dm,
    };
  }
  return {
    transfer_cost: baseTransfer * fm * dm,
    distribution_cost: baseDist * fm * dm,
  };
}

// ── Empresa 1 helpers ────────────────────────────────────────────────────────

function buildFreightMapE1(matrix) {
  const exactMap = new Map();
  const ufMap = new Map();
  if (Array.isArray(matrix)) {
    for (const r of matrix) {
      const o = up(r.ORIGEM || r.UF_ORIGEM);
      const d = up(r.DESTINO || r.UF_DESTINO);
      const rate = toNum(r['Frete (R$/Kg)'] ?? r.frete_por_kg, null);
      if (o && d && rate !== null) {
        const key = `${o}→${d}`;
        if (!exactMap.has(key)) exactMap.set(key, rate);
      }
      const oUf = up(r.UF_ORIGEM);
      const dUf = up(r.UF_DESTINO);
      if (oUf && dUf && rate !== null) {
        const key = `${oUf}→${dUf}`;
        if (!ufMap.has(key)) ufMap.set(key, rate);
      }
    }
  }
  return { exactMap, ufMap };
}

/**
 * Returns the freight rate (R$/kg) for origin→destination from the
 * distance_matrix, or null when the pair is not found.
 */
function lookupFreightRateE1(origin, dest, maps) {
  if (!maps || typeof maps.exactMap === 'undefined') return null;

  const o = up(origin);
  const d = up(dest);
  const key = `${o}→${d}`;

  if (maps.exactMap.has(key)) return maps.exactMap.get(key);
  if (maps.ufMap.has(key)) return maps.ufMap.get(key);
  return null;
}

/** Returns { cost, method, rate } for one flow using the distance matrix. */
function calcFlowFreightE1(flow, maps, fm) {
  const weightKg = flowWeight(flow);
  if (weightKg <= 0) return { cost: 0, method: 'zero_weight', rate: 0 };

  const cd = flow.cd || flow.origin || flow.cd_uf || '';
  const dest = flow.destination || flow.destination_uf || flow.centroid || '';

  let rate = lookupFreightRateE1(cd, dest, maps);

  if (rate === null) {
    const cdUf = flow.cd_uf || String(cd).slice(0, 2);
    const dUf = flow.destination_uf || String(dest).slice(0, 2);
    rate = lookupFreightRateE1(cdUf, dUf, maps);
  }

  if (rate === null) return { cost: 0, method: 'missing_rate', rate: 0 };

  return { cost: weightKg * rate * toNum(fm, 1), method: 'distance_matrix', rate };
}

/** Looks up transfer distance (km) from the distance_matrix for a given flow. */
function getTransferDistanceKmE1(flow, matrix) {
  const origin = up(flow.origin || flow.cd || flow.origin_uf || flow.cd_uf || '');
  const dest = up(flow.destination_uf || flow.cd_uf || flow.cd || '');
  if (!origin || !dest) return 0;

  for (const r of matrix) {
    const rOrigin = up(r.ORIGEM || r.UF_ORIGEM || '');
    const rDest = up(r.DESTINO || r.UF_DESTINO || '');
    if (rOrigin === origin && rDest === dest) return toNum(r['Distancia(KM)']);
  }

  const originUf = origin.slice(0, 2);
  const destUf = dest.slice(0, 2);
  for (const r of matrix) {
    const rOriginUf = up(r.UF_ORIGEM || r.ORIGEM || '').slice(0, 2);
    const rDestUf = up(r.UF_DESTINO || r.DESTINO || '').slice(0, 2);
    if (rOriginUf === originUf && rDestUf === destUf) return toNum(r['Distancia(KM)']);
  }

  return 0;
}

// ── Empresa 2 helpers ────────────────────────────────────────────────────────

/** Selects the CIF rate (R$/kg) for the appropriate weight bracket. */
function getCifRateForWeight(row, weightKg) {
  if (weightKg <= 10) return toNum(row['Até 10kg'] ?? row['Ate 10kg']);
  if (weightKg <= 20) return toNum(row['10 a 20kg']);
  if (weightKg <= 30) return toNum(row['20 a 30kg']);
  if (weightKg <= 50) return toNum(row['30 a 50kg']);
  if (weightKg <= 70) return toNum(row['50 a 70kg']);
  if (weightKg <= 100) return toNum(row['70 a 100kg']);
  return toNum(row['Acima 100kg (R$/kg)'] ?? row['Acima 100kg']);
}

function buildCifMapE2(cifTable) {
  const map1 = new Map();
  const map2 = new Map();
  const map3 = new Map();

  if (Array.isArray(cifTable)) {
    for (const r of cifTable) {
      const orig = up(r.Origem);
      const dest = up(r.Destino);
      const uf = up(r.UF || r.Origem);

      if (orig && dest) {
        const key = `${orig}→${dest}`;
        if (!map1.has(key)) map1.set(key, r);
      }
      if (uf && dest) {
        const key = `${uf}→${dest}`;
        if (!map2.has(key)) map2.set(key, r);
      }

      const rUf = up(r.UF);
      if (rUf && dest) {
        const ufs = dest.match(/[A-Z]{2}/g) || [dest];
        const destSet = new Set(ufs);
        if (!map3.has(rUf)) {
          map3.set(rUf, []);
        }
        map3.get(rUf).push({ destSet, row: r });
      }
    }
  }

  return { map1, map2, map3 };
}

function lookupCifRow(origin, dest, maps) {
  if (!maps || typeof maps.map1 === 'undefined') return null;

  const o = up(origin);
  const d = up(dest);

  const key = `${o}→${d}`;
  if (maps.map1.has(key)) return maps.map1.get(key);
  if (maps.map2.has(key)) return maps.map2.get(key);

  const originUf = o.slice(0, 2);
  const destUf = d.slice(0, 2);
  if (maps.map3.has(originUf)) {
    const list = maps.map3.get(originUf);
    for (const item of list) {
      if (item.destSet.has(destUf)) return item.row;
    }
  }

  return null;
}

/** Returns { cost, method, rate } for one flow using the CIF table. */
function calcFlowFreightE2(flow, maps, fm) {
  const weightKg = flowWeight(flow);
  if (weightKg <= 0) return { cost: 0, method: 'zero_weight', rate: 0 };

  const origin = flow.cd || flow.origin || flow.cd_uf || flow.origin_uf || '';
  const dest = flow.destination || flow.destination_uf || '';
  const fmNum = toNum(fm, 1);

  const row = lookupCifRow(origin, dest, maps);

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
    const pct = toNum(row['Frete Valor (Decimal)'], 0);
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
    const key = `${up(row.ORIGEM || row['ORIGEM UF'])}→${up(row['DESTINO UF'])}`;
    const peso = toNum(row.PESO);
    const frete = toNum(row['FRETE VALOR']);
    if (peso <= 0 || frete <= 0) continue;
    acc[key] = acc[key] || { totalFrete: 0, totalPeso: 0 };
    acc[key].totalFrete += frete;
    acc[key].totalPeso += peso;
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

const KILOMETRIC_RATE_BY_UF = Object.freeze({
  SP: 0.0083,
  MG: 0.0049,
  ES: 0.0176,
  RJ: 0.0133,
});
const KILOMETRIC_RATE_FALLBACK = 0.005;

function buildCostContext({ scenario, baselineBundle }) {
  const changes = scenario.changes || {};
  const base = baselineBundle?.costs?.costs || {};
  const demandMultiplier = toNum(changes.demand_multiplier, 1);
  return {
    freightMultiplier: toNum(changes.freight_multiplier, 1),
    demandMultiplier,
    activeCds: changes.active_cds || [],
    base,
    coreData: baselineBundle?.core_data || {},
    baselineCds: (baselineBundle?.model?.active_cds || []).length,
    inventoryCost:
      toNum(base.inventory_cost) *
      demandMultiplier *
      (toNum(changes.inventory_days, 45) / 45) *
      (toNum(changes.wacc, 0.15) / 0.15),
  };
}

function buildCostResult(context, values) {
  return {
    transfer_cost: values.transferCost,
    distribution_cost: values.distributionCost,
    storage_cost: values.storageCost,
    inventory_cost: context.inventoryCost,
    calculation_method: values.calculationMethod,
    flow_cost_detail: values.flowCostDetail,
    warnings: values.warnings,
  };
}

function calculateCompany1Costs(context, flows) {
  const { base, coreData, activeCds, baselineCds, freightMultiplier, demandMultiplier } = context;
  const matrix = coreData.distance_matrix || [];
  const warnings = matrix.length
    ? []
    : ['distance_matrix não disponível; usando fallback heurístico.'];
  const freightMaps = buildFreightMapE1(matrix);
  let distributionCost = 0;
  let transferCost = 0;
  let missingRateCount = 0;
  let missingDistanceCount = 0;
  const flowCostDetail = [];

  for (const flow of flows) {
    const { cost, method, rate } = calcFlowFreightE1(flow, freightMaps, freightMultiplier);
    const flowDistributionCost = cost * demandMultiplier;
    const weightKg = flowWeight(flow);
    const destinationUf = up(flow.destination_uf || flow.cd_uf || flow.cd || '').slice(0, 2);
    const distanceKm = getTransferDistanceKmE1(flow, matrix);
    let flowTransferCost = 0;
    if (weightKg > 0 && distanceKm > 0) {
      flowTransferCost =
        weightKg *
        (KILOMETRIC_RATE_BY_UF[destinationUf] || KILOMETRIC_RATE_FALLBACK) *
        distanceKm *
        freightMultiplier *
        demandMultiplier;
    } else if (weightKg > 0) {
      flowTransferCost = flowDistributionCost * 0.4;
      missingDistanceCount += 1;
    }

    distributionCost += flowDistributionCost;
    transferCost += flowTransferCost;
    if (method === 'missing_rate') missingRateCount += 1;
    flowCostDetail.push({
      flow_id: flow.flow_id,
      distribution_cost: flowDistributionCost,
      transfer_cost: flowTransferCost,
      transfer_dist_km: distanceKm,
      transfer_rate_per_kg_km: KILOMETRIC_RATE_BY_UF[destinationUf] || KILOMETRIC_RATE_FALLBACK,
      dest_uf: destinationUf,
      method,
      rate,
    });
  }

  if (missingRateCount)
    warnings.push(
      `${missingRateCount} fluxo(s) sem tarifa na distance_matrix; custo de distribuição zerado nesses fluxos.`
    );
  if (missingDistanceCount)
    warnings.push(
      `${missingDistanceCount} fluxo(s) sem distância exata na matriz; transferência desses fluxos estimada proporcionalmente à distribuição (40%).`
    );

  const anyPriced = flowCostDetail.some((flow) => flow.method === 'distance_matrix');
  if (!anyPriced && toNum(base.distribution_cost) > 0) {
    warnings.push('Nenhum fluxo precificado pela distance_matrix; aplicando fallback heurístico.');
    ({ transfer_cost: transferCost, distribution_cost: distributionCost } = heuristicFallback(
      base,
      freightMultiplier,
      demandMultiplier,
      'empresa1'
    ));
  }

  return buildCostResult(context, {
    transferCost,
    distributionCost,
    storageCost: storageRatioCost(base, activeCds, baselineCds, demandMultiplier),
    calculationMethod: anyPriced ? 'physical_distance_matrix_kilometric' : 'heuristic_fallback',
    flowCostDetail,
    warnings,
  });
}

function calculateCompany2Costs(context, flows) {
  const { base, coreData, activeCds, baselineCds, freightMultiplier, demandMultiplier } = context;
  const cifTable = coreData.tabelas_cif_dist || coreData.cif_table || [];
  const transferTable = coreData.aux_custo_transferencia || [];
  const storageTable = coreData.aux_custo_armazenagem || [];
  const warnings = [];
  if (!cifTable.length)
    warnings.push('tabelas_cif_dist não disponível; usando % da receita como fallback.');
  if (!transferTable.length)
    warnings.push('aux_custo_transferencia não disponível; estimando transferência.');
  if (!storageTable.length)
    warnings.push('aux_custo_armazenagem não disponível; usando custo proporcional do baseline.');

  const transferRateMap = buildTransferRateMapE2(transferTable);
  const storageCostMap = buildStorageCostMapE2(storageTable);
  const cifMaps = buildCifMapE2(cifTable);
  let distributionCost = 0;
  let transferCost = 0;
  let missingCount = 0;
  const flowCostDetail = [];

  for (const flow of flows) {
    const { cost, method, rate } = calcFlowFreightE2(flow, cifMaps, freightMultiplier);
    const flowDistributionCost = cost * demandMultiplier;
    let flowTransferCost = 0;
    if (flow.reallocation_status === 'reallocated') {
      const originUf = up(flow.cd_uf || flow.origin_uf || flow.cd).slice(0, 2);
      const destinationUf = up(flow.destination_uf);
      const transferRate =
        transferRateMap[`${originUf}→${destinationUf}`] || transferRateMap[`${originUf}→`] || 0;
      const weightKg = flowWeight(flow);
      flowTransferCost =
        weightKg > 0 && transferRate > 0
          ? weightKg * transferRate * freightMultiplier * demandMultiplier
          : flowRevenue(flow) * 0.025 * freightMultiplier * demandMultiplier;
    }
    distributionCost += flowDistributionCost;
    transferCost += flowTransferCost;
    if (method === 'missing_cif_row') missingCount += 1;
    flowCostDetail.push({
      flow_id: flow.flow_id,
      distribution_cost: flowDistributionCost,
      transfer_cost: flowTransferCost,
      dist_method: method,
      dist_rate: rate,
    });
  }

  if (missingCount)
    warnings.push(`${missingCount} fluxo(s) sem linha na tabela CIF; custo zerado nesses fluxos.`);
  const anyPriced = flowCostDetail.some(
    (flow) => flow.dist_method === 'cif_bracket' || flow.dist_method === 'cif_pct_revenue'
  );
  if (!anyPriced && toNum(base.distribution_cost) > 0) {
    warnings.push('Nenhum fluxo precificado pela tabela CIF; aplicando fallback heurístico.');
    ({ transfer_cost: transferCost, distribution_cost: distributionCost } = heuristicFallback(
      base,
      freightMultiplier,
      demandMultiplier,
      'empresa2'
    ));
  }

  const realStorage = resolveStorageCostFromTable(storageCostMap, activeCds, demandMultiplier);
  if (realStorage === null)
    warnings.push(
      'CDs do cenário sem correspondência na tabela de armazenagem; usando custo proporcional do baseline.'
    );
  return buildCostResult(context, {
    transferCost,
    distributionCost,
    storageCost: realStorage ?? storageRatioCost(base, activeCds, baselineCds, demandMultiplier),
    calculationMethod: anyPriced ? 'physical_cif_table' : 'heuristic_fallback',
    flowCostDetail,
    warnings,
  });
}

function calculateUnknownCompanyCosts(companyId, context) {
  const { base, activeCds, baselineCds, freightMultiplier, demandMultiplier } = context;
  return buildCostResult(context, {
    transferCost: toNum(base.transfer_cost) * freightMultiplier * demandMultiplier,
    distributionCost: toNum(base.distribution_cost) * freightMultiplier * demandMultiplier,
    storageCost: storageRatioCost(base, activeCds, baselineCds, demandMultiplier),
    calculationMethod: 'heuristic_fallback',
    flowCostDetail: [],
    warnings: [`companyId desconhecido: "${companyId}"; usando heurística genérica.`],
  });
}

/** Calculates physical logistics costs from the rebuilt flow model. */
export function calculatePhysicalCosts({ companyId, scenario, baselineBundle, rebuilt }) {
  const context = buildCostContext({ scenario, baselineBundle });
  if (companyId === 'empresa1') return calculateCompany1Costs(context, rebuilt.flows);
  if (companyId === 'empresa2') return calculateCompany2Costs(context, rebuilt.flows);
  return calculateUnknownCompanyCosts(companyId, context);
}

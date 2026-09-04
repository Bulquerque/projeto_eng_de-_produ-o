import { MODEL_ASSUMPTIONS } from '../shared/model-assumptions.js';

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
  const { fixed_share_proxy: fixedShare, active_cd_share_proxy: activeShare } =
    MODEL_ASSUMPTIONS.storage;
  const ratio = fixedShare + activeShare * (activeCds.length / (baselineCds || 1));
  return toNum(base.storage_cost) * dm * ratio;
}

/** Heuristic baseline costs scaled by freight and demand multipliers. */
function heuristicFallback(base, fm, dm, companyId = '') {
  const baseDist = toNum(base.distribution_cost);
  const baseTransfer = toNum(base.transfer_cost);
  if (companyId === 'empresa1' && baseTransfer === 0) {
    return {
      transfer_cost:
        baseDist *
        fm *
        dm *
        MODEL_ASSUMPTIONS.empresa1_transfer_proxy.missing_distance_distribution_share,
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
      const pct = MODEL_ASSUMPTIONS.empresa2_freight.missing_cif_revenue_share;
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

/** Returns annual table cost only when every active CD has a match. */
function resolveStorageCostFromTable(storageCostMap, activeCds, dm) {
  if (!Object.keys(storageCostMap).length) {
    return { cost: null, matched_cds: [], missing_cds: [...activeCds] };
  }

  let total = 0;
  const matchedCds = [];
  const missingCds = [];
  for (const cd of activeCds) {
    const key = up(cd);
    const exact = storageCostMap[key];
    const partial = Object.entries(storageCostMap).find(
      ([k]) => key.includes(k) || k.includes(key)
    );
    const cost = exact || partial?.[1] || 0;
    if (cost > 0) {
      total += cost;
      matchedCds.push(cd);
    } else {
      missingCds.push(cd);
    }
  }

  return {
    cost: total > 0 && missingCds.length === 0 ? total * 12 * dm : null,
    matched_cds: matchedCds,
    missing_cds: missingCds,
  }; // valores da tabela são mensais
}

function pct(numerator, denominator) {
  return denominator > 0 ? (numerator / denominator) * 100 : 0;
}

function finalizeFallbackUsage(usage, costs) {
  const totalPhysicalCost =
    toNum(costs.transfer_cost) +
    toNum(costs.distribution_cost) +
    toNum(costs.storage_cost) +
    toNum(costs.inventory_cost);
  return {
    ...usage,
    total_physical_cost_brl: totalPhysicalCost,
    cross_company_transfer_proxy_flow_share_pct: pct(
      usage.cross_company_transfer_proxy_flows,
      usage.flow_count
    ),
    cross_company_transfer_proxy_volume_share_pct: pct(
      usage.cross_company_transfer_proxy_weight_kg,
      usage.total_flow_weight_kg
    ),
    cross_company_transfer_proxy_cost_share_pct: pct(
      usage.cross_company_transfer_proxy_cost_brl,
      totalPhysicalCost
    ),
    missing_transfer_distance_volume_share_pct: pct(
      usage.missing_transfer_distance_weight_kg,
      usage.total_flow_weight_kg
    ),
    missing_transfer_distance_cost_share_pct: pct(
      usage.missing_transfer_distance_cost_brl,
      totalPhysicalCost
    ),
    revenue_pct_fallback_revenue_share_pct: pct(
      usage.revenue_pct_fallback_revenue_brl,
      usage.total_flow_revenue_brl
    ),
    revenue_pct_fallback_cost_share_pct: pct(
      usage.revenue_pct_fallback_cost_brl,
      totalPhysicalCost
    ),
    storage_proxy_cost_share_pct: pct(usage.storage_proxy_cost_brl, totalPhysicalCost),
  };
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
  const c = scenario.changes || {};
  const fm = toNum(c.freight_multiplier, 1);
  const dm = toNum(c.demand_multiplier, 1);
  const invDays = toNum(c.inventory_days, MODEL_ASSUMPTIONS.inventory.baseline_days);
  const wacc = toNum(c.wacc, MODEL_ASSUMPTIONS.inventory.baseline_wacc);
  const activeCds = c.active_cds || [];
  const base = baselineBundle?.costs?.costs || {};
  const coreData = baselineBundle?.core_data || {};
  const baselineCds = (baselineBundle?.model?.active_cds || []).length;
  const inventoryAssumptions = MODEL_ASSUMPTIONS.inventory;
  const inventory =
    toNum(base.inventory_cost) *
    dm *
    (invDays / inventoryAssumptions.baseline_days) *
    (wacc / inventoryAssumptions.baseline_wacc);
  const warnings = [];
  const fallbackUsage = {
    flow_count: Array.isArray(rebuilt?.flows) ? rebuilt.flows.length : 0,
    total_flow_weight_kg: (rebuilt?.flows || []).reduce((sum, flow) => sum + flowWeight(flow), 0),
    total_flow_revenue_brl: (rebuilt?.flows || []).reduce(
      (sum, flow) => sum + flowRevenue(flow),
      0
    ),
    missing_distribution_rate_flows: 0,
    missing_transfer_distance_flows: 0,
    revenue_pct_fallback_flows: 0,
    storage_proxy_used: false,
    storage_proxy_cost_brl: 0,
    cross_company_transfer_proxy_flows: 0,
    cross_company_transfer_proxy_weight_kg: 0,
    cross_company_transfer_proxy_cost_brl: 0,
    missing_transfer_distance_weight_kg: 0,
    missing_transfer_distance_cost_brl: 0,
    revenue_pct_fallback_revenue_brl: 0,
    revenue_pct_fallback_cost_brl: 0,
  };

  warnings.push(
    'Custo de estoque usa demanda, dias de estoque e WACC; não inclui pooling por número de CDs.'
  );

  if (companyId === 'empresa1') {
    const matrix = coreData.distance_matrix || [];
    if (!matrix.length)
      warnings.push('distance_matrix não disponível; usando fallback heurístico.');

    const freightMaps = buildFreightMapE1(matrix);

    // ── Kilometric transfer rates calibrated from Empresa 2 NF data ──────────
    // Source: aux_custo_transferencia — weighted avg geodesic R$/kg-km per dest UF
    // SP: 0.0083 | MG: 0.0049 | ES: 0.0176 | RJ: 0.0133
    const transferProxy = MODEL_ASSUMPTIONS.empresa1_transfer_proxy;
    const KILOMETRIC_RATE_BY_UF = transferProxy.rate_by_destination_uf_brl_per_kg_km;
    const KILOMETRIC_RATE_FALLBACK = transferProxy.fallback_rate_brl_per_kg_km;
    const MISSING_DISTANCE_SHARE = transferProxy.missing_distance_distribution_share;

    warnings.push(
      `Transferência da Empresa 1 usa proxy calibrado com ${transferProxy.source_description}; não é dado observado da Empresa 1.`
    );

    let totalDist = 0;
    let totalTransfer = 0;
    let missingCount = 0;
    let missingDistCount = 0;
    const flowCostDetail = [];

    for (const flow of rebuilt.flows) {
      const { cost, method, rate } = calcFlowFreightE1(flow, freightMaps, fm);
      const distCost = cost * dm;

      const wKg = flowWeight(flow);
      const destUf = up(flow.destination_uf || flow.cd_uf || flow.cd || '').slice(0, 2);
      const ratePerKgKm = KILOMETRIC_RATE_BY_UF[destUf] || KILOMETRIC_RATE_FALLBACK;
      const distKm = getTransferDistanceKmE1(flow, matrix);

      let transferCost = 0;
      if (wKg > 0 && distKm > 0) {
        transferCost = wKg * ratePerKgKm * distKm * fm * dm;
      } else if (wKg > 0 && distKm === 0) {
        // Distance not found — estimate as 40% of distribution cost for this flow
        transferCost = distCost * MISSING_DISTANCE_SHARE;
        missingDistCount++;
      }

      totalDist += distCost;
      totalTransfer += transferCost;
      if (method === 'missing_rate') missingCount++;
      flowCostDetail.push({
        flow_id: flow.flow_id,
        distribution_cost: distCost,
        transfer_cost: transferCost,
        transfer_dist_km: distKm,
        transfer_rate_per_kg_km: ratePerKgKm,
        dest_uf: destUf,
        method,
        rate,
        transfer_is_cross_company_proxy: wKg > 0,
        transfer_fallback_used: wKg > 0 && distKm === 0,
      });
    }

    fallbackUsage.missing_distribution_rate_flows = missingCount;
    fallbackUsage.missing_transfer_distance_flows = missingDistCount;
    fallbackUsage.cross_company_transfer_proxy_flows = flowCostDetail.filter(
      (row) => row.transfer_is_cross_company_proxy
    ).length;
    fallbackUsage.cross_company_transfer_proxy_weight_kg = rebuilt.flows.reduce(
      (sum, flow) => sum + flowWeight(flow),
      0
    );
    fallbackUsage.cross_company_transfer_proxy_cost_brl = totalTransfer;
    fallbackUsage.missing_transfer_distance_weight_kg = rebuilt.flows.reduce(
      (sum, flow, index) =>
        sum + (flowCostDetail[index]?.transfer_fallback_used ? flowWeight(flow) : 0),
      0
    );
    fallbackUsage.missing_transfer_distance_cost_brl = flowCostDetail.reduce(
      (sum, row) => sum + (row.transfer_fallback_used ? row.transfer_cost : 0),
      0
    );
    fallbackUsage.storage_proxy_used = true;

    if (missingCount > 0) {
      warnings.push(
        `${missingCount} fluxo(s) sem tarifa na distance_matrix; custo de distribuição zerado nesses fluxos.`
      );
    }
    if (missingDistCount > 0) {
      warnings.push(
        `${missingDistCount} fluxo(s) sem distância exata na matriz; transferência desses fluxos estimada proporcionalmente à distribuição (40%).`
      );
    }

    const anyPriced = flowCostDetail.some((r) => r.method === 'distance_matrix');
    if (!anyPriced && toNum(base.distribution_cost) > 0) {
      warnings.push(
        'Nenhum fluxo precificado pela distance_matrix; aplicando fallback heurístico.'
      );
      ({ transfer_cost: totalTransfer, distribution_cost: totalDist } = heuristicFallback(
        base,
        fm,
        dm,
        companyId
      ));
      fallbackUsage.missing_transfer_distance_flows = fallbackUsage.flow_count;
      fallbackUsage.missing_transfer_distance_weight_kg = fallbackUsage.total_flow_weight_kg;
      fallbackUsage.missing_transfer_distance_cost_brl = totalTransfer;
      fallbackUsage.cross_company_transfer_proxy_cost_brl = totalTransfer;
    }

    const storage = storageRatioCost(base, activeCds, baselineCds, dm);
    fallbackUsage.storage_proxy_cost_brl = storage;

    return {
      transfer_cost: totalTransfer,
      distribution_cost: totalDist,
      storage_cost: storage,
      inventory_cost: inventory,
      inventory_calculation_mode: inventoryAssumptions.calculation_mode,
      inventory_pooling_effect_included: inventoryAssumptions.pooling_effect_included,
      fallback_usage: finalizeFallbackUsage(fallbackUsage, {
        transfer_cost: totalTransfer,
        distribution_cost: totalDist,
        storage_cost: storage,
        inventory_cost: inventory,
      }),
      calculation_method: anyPriced ? 'physical_distance_matrix_kilometric' : 'heuristic_fallback',
      flow_cost_detail: flowCostDetail,
      warnings,
    };
  }

  if (companyId === 'empresa2') {
    const cifTable = coreData.tabelas_cif_dist || coreData.cif_table || [];
    const transferTable = coreData.aux_custo_transferencia || [];
    const storageTable = coreData.aux_custo_armazenagem || [];

    if (!cifTable.length)
      warnings.push('tabelas_cif_dist não disponível; usando % da receita como fallback.');
    if (!transferTable.length)
      warnings.push('aux_custo_transferencia não disponível; estimando transferência.');
    if (!storageTable.length)
      warnings.push('aux_custo_armazenagem não disponível; usando custo proporcional do baseline.');

    const transferRateMap = buildTransferRateMapE2(transferTable);
    const storageCostMap = buildStorageCostMapE2(storageTable);
    const cifMaps = buildCifMapE2(cifTable);

    let totalDist = 0;
    let totalTransfer = 0;
    let missingCount = 0;
    let revenueFallbackCount = 0;
    const flowCostDetail = [];

    for (const flow of rebuilt.flows) {
      const {
        cost: distCost,
        method: distMethod,
        rate: distRate,
      } = calcFlowFreightE2(flow, cifMaps, fm);
      const distributionCost = distCost * dm;

      let transferCost = 0;
      let transferFallbackUsed = false;
      if (flow.reallocation_status === 'reallocated') {
        const originUf = up(flow.cd_uf || flow.origin_uf || flow.cd).slice(0, 2);
        const destUf = up(flow.destination_uf);
        const key = `${originUf}→${destUf}`;
        const ratePerKg = transferRateMap[key] || transferRateMap[`${originUf}→`] || 0;
        const wKg = flowWeight(flow);
        if (wKg > 0 && ratePerKg > 0) {
          transferCost = wKg * ratePerKg * fm * dm;
        } else {
          transferCost =
            flowRevenue(flow) *
            MODEL_ASSUMPTIONS.empresa2_freight.missing_transfer_rate_revenue_share *
            fm *
            dm;
          transferFallbackUsed = transferCost > 0;
        }
      }

      totalDist += distributionCost;
      totalTransfer += transferCost;
      if (distMethod === 'missing_cif_row') missingCount++;
      if (distMethod === 'revenue_pct_fallback') revenueFallbackCount++;
      flowCostDetail.push({
        flow_id: flow.flow_id,
        distribution_cost: distributionCost,
        transfer_cost: transferCost,
        dist_method: distMethod,
        dist_rate: distRate,
        transfer_fallback_used: transferFallbackUsed,
      });
    }

    if (missingCount > 0) {
      warnings.push(
        `${missingCount} fluxo(s) sem linha na tabela CIF; custo zerado nesses fluxos.`
      );
    }

    const anyPriced = flowCostDetail.some(
      (r) => r.dist_method === 'cif_bracket' || r.dist_method === 'cif_pct_revenue'
    );
    if (!anyPriced && toNum(base.distribution_cost) > 0) {
      warnings.push('Nenhum fluxo precificado pela tabela CIF; aplicando fallback heurístico.');
      ({ transfer_cost: totalTransfer, distribution_cost: totalDist } = heuristicFallback(
        base,
        fm,
        dm,
        companyId
      ));
    }

    const storageResolution = resolveStorageCostFromTable(storageCostMap, activeCds, dm);
    const realStorage = storageResolution.cost;
    if (realStorage === null) {
      warnings.push(
        `${storageResolution.missing_cds.length} CD(s) do cenário sem correspondência completa na tabela de armazenagem; usando custo proporcional do baseline.`
      );
    }
    const storage = realStorage ?? storageRatioCost(base, activeCds, baselineCds, dm);
    fallbackUsage.missing_distribution_rate_flows = missingCount;
    fallbackUsage.revenue_pct_fallback_flows = revenueFallbackCount;
    fallbackUsage.storage_proxy_used = realStorage === null;
    fallbackUsage.revenue_pct_fallback_revenue_brl = rebuilt.flows.reduce(
      (sum, flow, index) =>
        sum +
        (flowCostDetail[index]?.dist_method === 'revenue_pct_fallback' ||
        flowCostDetail[index]?.transfer_fallback_used
          ? flowRevenue(flow)
          : 0),
      0
    );
    fallbackUsage.revenue_pct_fallback_cost_brl = flowCostDetail.reduce(
      (sum, row) =>
        sum +
        (row.dist_method === 'revenue_pct_fallback' ? row.distribution_cost : 0) +
        (row.transfer_fallback_used ? row.transfer_cost : 0),
      0
    );
    fallbackUsage.storage_proxy_cost_brl = realStorage === null ? storage : 0;

    if (flowCostDetail.some((row) => row.transfer_fallback_used)) {
      warnings.push(
        'Há fluxos realocados sem tarifa de transferência; foi aplicado fallback de 2,5% da receita.'
      );
    }

    return {
      transfer_cost: totalTransfer,
      distribution_cost: totalDist,
      storage_cost: storage,
      inventory_cost: inventory,
      inventory_calculation_mode: inventoryAssumptions.calculation_mode,
      inventory_pooling_effect_included: inventoryAssumptions.pooling_effect_included,
      fallback_usage: finalizeFallbackUsage(fallbackUsage, {
        transfer_cost: totalTransfer,
        distribution_cost: totalDist,
        storage_cost: storage,
        inventory_cost: inventory,
      }),
      calculation_method: anyPriced ? 'physical_cif_table' : 'heuristic_fallback',
      flow_cost_detail: flowCostDetail,
      warnings,
    };
  }

  // Unknown company — explicit safe fallback
  warnings.push(`companyId desconhecido: "${companyId}"; usando heurística genérica.`);
  return {
    transfer_cost: toNum(base.transfer_cost) * fm * dm,
    distribution_cost: toNum(base.distribution_cost) * fm * dm,
    storage_cost: storageRatioCost(base, activeCds, baselineCds, dm),
    inventory_cost: inventory,
    inventory_calculation_mode: inventoryAssumptions.calculation_mode,
    inventory_pooling_effect_included: inventoryAssumptions.pooling_effect_included,
    fallback_usage: finalizeFallbackUsage(
      { ...fallbackUsage, storage_proxy_used: true },
      {
        transfer_cost: toNum(base.transfer_cost) * fm * dm,
        distribution_cost: toNum(base.distribution_cost) * fm * dm,
        storage_cost: storageRatioCost(base, activeCds, baselineCds, dm),
        inventory_cost: inventory,
      }
    ),
    calculation_method: 'heuristic_fallback',
    flow_cost_detail: [],
    warnings,
  };
}

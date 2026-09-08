/**
 * physical-cost-engine.js
 *
 * Calculates per-flow logistics costs from real data tables.
 *
 * Empresa 1 — distance_matrix       : weight_kg × Frete(R$/kg) for distribution
 *             calibrated UF proxy     : rate (R$/kg-km) derived from Empresa 2 NF data
 *               → Transfer = weight_kg × rate_per_kg_km[destUF] × distance_km
 * Empresa 2 — tabelas_cif_dist : weight-bracket rate lookup
 *             aux_custo_transferencia : real NF-based transfer rates
 *             aux_custo_armazenagem   : real storage tariffs per CD
 *
 * Kilometric rates for Empresa 1 transfer (cross-company calibrated proxy from
 * Empresa 2 NF data; never loaded as Empresa 1 observed data):
 *   SP: 0.0083 R$/kg-km  |  MG: 0.0049 R$/kg-km
 *   ES: 0.0176 R$/kg-km  |  RJ: 0.0133 R$/kg-km
 *   fallback (cross-state): 0.0050 R$/kg-km
 */

import {
  MODEL_DEFAULTS,
  calculateInventoryCost,
  resolveTransferFallback,
} from '../core/model-configuration.js';

function toNum(value, fallback = 0) {
  const x = Number(value);
  return Number.isFinite(x) ? x : fallback;
}

function up(value) {
  return String(value || '')
    .trim()
    .toUpperCase();
}

function nodeName(value) {
  const text = up(value);
  const parts = text
    .split(/[|/]/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 1] : text;
}

function flowWeight(flow) {
  return toNum(flow.annual_weight_kg ?? flow.weight_kg ?? flow.volume ?? 0);
}

// Empresa 2 has a `volume` field in factory→CD rows, but the source workbook
// does not define its unit as kilograms. Never promote that field to weight:
// CIF brackets and transfer R$/kg rates require an identified weight field.
function flowWeightE2(flow) {
  return toNum(flow.annual_weight_kg ?? flow.weight_kg ?? 0);
}

function flowRevenue(flow) {
  return toNum(flow.annual_revenue ?? flow.revenue ?? 0);
}

/** Proportional storage estimate when the real table has no match. */
function storageRatioCost(base, activeCds, baselineCds, dm) {
  const ratio =
    MODEL_DEFAULTS.storage_active_cd_floor_ratio +
    MODEL_DEFAULTS.storage_active_cd_slope * (activeCds.length / (baselineCds || 1));
  return toNum(base.storage_cost) * dm * ratio;
}

/** Heuristic baseline costs scaled by freight and demand multipliers. */
function heuristicFallback(base, fm, dm, companyId = '') {
  const baseDist = toNum(base.distribution_cost);
  const baseTransfer = toNum(base.transfer_cost);
  if (companyId === 'empresa1' && baseTransfer === 0) {
    return {
      transfer_cost: baseDist * fm * dm * MODEL_DEFAULTS.transfer_to_distribution_ratio,
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

  const cd = nodeName(flow.assigned_cd || flow.cd || flow.origin || flow.cd_uf || '');
  const dest = nodeName(flow.destination || flow.destination_uf || flow.centroid || '');

  let rate = lookupFreightRateE1(cd, dest, maps);

  if (rate === null) {
    const cdUf = flow.assigned_cd_uf || flow.cd_uf || String(cd).slice(0, 2);
    const dUf = flow.destination_uf || String(dest).slice(0, 2);
    rate = lookupFreightRateE1(cdUf, dUf, maps);
  }

  if (rate === null) {
    const revenue = flowRevenue(flow);
    if (revenue > 0) {
      return {
        cost: revenue * MODEL_DEFAULTS.missing_freight_revenue_pct * toNum(fm, 1),
        method: 'revenue_pct_fallback',
        rate: MODEL_DEFAULTS.missing_freight_revenue_pct,
      };
    }
    return { cost: 0, method: 'missing_rate', rate: 0 };
  }

  return { cost: weightKg * rate * toNum(fm, 1), method: 'distance_matrix', rate };
}

/** Looks up transfer distance (km) from the distance_matrix for a given flow. */
function getTransferDistanceKmE1(flow, matrix) {
  if (flow?.reallocation_status !== 'reallocated' && toNum(flow?.distance_km) > 0) {
    return toNum(flow.distance_km);
  }
  const origin = nodeName(
    flow.assigned_cd || flow.cd || flow.origin || flow.origin_uf || flow.cd_uf || ''
  );
  const dest = nodeName(flow.destination || flow.destination_uf || flow.cd_uf || flow.cd || '');
  if (!origin || !dest) return 0;

  for (const r of matrix) {
    const rOrigin = up(r.ORIGEM || r.UF_ORIGEM || '');
    const rDest = up(r.DESTINO || r.UF_DESTINO || '');
    if (rOrigin === origin && rDest === dest) return toNum(r['Distancia(KM)']);
  }

  const originUf = up(flow.assigned_cd_uf || flow.cd_uf || flow.origin_uf || '').slice(0, 2);
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
  // Factory→CD rows are source-side operational evidence. They are not
  // CD→destination distribution flows and their `volume` is not documented
  // as kg, so they must not be priced by the CIF table.
  if (flow?.flow_type === 'factory_to_cd') {
    return { cost: 0, method: 'factory_to_cd_not_distribution', rate: 0 };
  }

  const weightKg = flowWeightE2(flow);
  if (weightKg <= 0) {
    const revenue = flowRevenue(flow);
    if (revenue > 0) {
      return {
        cost: revenue * MODEL_DEFAULTS.missing_freight_revenue_pct * toNum(fm, 1),
        method: 'revenue_pct_fallback_missing_weight',
        rate: MODEL_DEFAULTS.missing_freight_revenue_pct,
      };
    }
    return { cost: 0, method: 'zero_weight', rate: 0 };
  }

  const origin = flow.cd || flow.origin || flow.cd_uf || flow.origin_uf || '';
  const dest = flow.destination || flow.destination_uf || '';
  const fmNum = toNum(fm, 1);

  const row = lookupCifRow(origin, dest, maps);

  if (!row) {
    const revenue = flowRevenue(flow);
    if (revenue > 0) {
      const pct = MODEL_DEFAULTS.missing_freight_revenue_pct;
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
    const origins = [row.ORIGEM, row['ORIGEM UF']].map(up).filter(Boolean);
    const destination = up(row['DESTINO UF']);
    const peso = toNum(row.PESO);
    const frete = toNum(row['FRETE VALOR']);
    if (!origins.length || !destination || peso <= 0 || frete <= 0) continue;
    for (const origin of new Set(origins)) {
      const key = `${origin}→${destination}`;
      acc[key] = acc[key] || { totalFrete: 0, totalPeso: 0 };
      acc[key].totalFrete += frete;
      acc[key].totalPeso += peso;
    }
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

const KILOMETRIC_RATE_BY_UF = MODEL_DEFAULTS.transfer_kilometric_rate_by_uf;
const KILOMETRIC_RATE_FALLBACK = MODEL_DEFAULTS.transfer_kilometric_fallback_rate;

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
    inventoryCost: calculateInventoryCost({
      baseInventoryCost: base.inventory_cost,
      demandMultiplier,
      inventoryDays: changes.inventory_days,
      wacc: changes.wacc,
    }),
    inventoryMethod: 'choice_b_independent_of_active_cd_count',
  };
}

function buildCostResult(context, values) {
  const flowCount = Array.isArray(values.flowCostDetail) ? values.flowCostDetail.length : 0;
  const fallbackCounts = values.diagnostics?.fallback_counts || {};
  return {
    transfer_cost: values.transferCost,
    distribution_cost: values.distributionCost,
    storage_cost: values.storageCost,
    inventory_cost: context.inventoryCost,
    calculation_method: values.calculationMethod,
    flow_cost_detail: values.flowCostDetail,
    warnings: values.warnings,
    diagnostics: {
      ...(values.diagnostics || {}),
      flow_count: flowCount,
      fallback_rates: Object.fromEntries(
        Object.entries(fallbackCounts).map(([key, value]) => [
          key,
          flowCount ? Number(value || 0) / flowCount : 0,
        ])
      ),
      inventory: {
        method: context.inventoryMethod,
        active_cd_count_not_used: true,
        reference_days: MODEL_DEFAULTS.inventory_days,
        reference_wacc: MODEL_DEFAULTS.reference_wacc,
      },
    },
  };
}

function calculateCompany1Costs(context, flows) {
  const { base, coreData, activeCds, baselineCds, freightMultiplier, demandMultiplier } = context;
  const matrix = coreData.distance_matrix || [];
  const warnings = matrix.length
    ? []
    : ['distance_matrix não disponível; usando fallback heurístico.'];
  warnings.push(
    `Empresa 1: transferência usa proxy calibrado com ${MODEL_DEFAULTS.transfer_kilometric_rate_provenance.source_company} / ${MODEL_DEFAULTS.transfer_kilometric_rate_provenance.source_dataset}; não é uma tarifa observada da Empresa 1.`
  );
  const freightMaps = buildFreightMapE1(matrix);
  let distributionCost = 0;
  let transferCost = 0;
  let missingRateCount = 0;
  let revenueFallbackCount = 0;
  let missingDistanceCount = 0;
  let transferFallbackCount = 0;
  const flowCostDetail = [];

  for (const flow of flows) {
    const { cost, method, rate } = calcFlowFreightE1(flow, freightMaps, freightMultiplier);
    const flowDistributionCost = cost * demandMultiplier;
    if (method === 'revenue_pct_fallback') revenueFallbackCount += 1;
    const weightKg = flowWeight(flow);
    const destinationUf = up(flow.destination_uf || flow.cd_uf || flow.cd || '').slice(0, 2);
    const distanceKm = getTransferDistanceKmE1(flow, matrix);
    let flowTransferCost = 0;
    let transferMethod = 'not_required';
    let transferSource = 'distance_matrix_kilometric_proxy';
    if (weightKg > 0 && distanceKm > 0) {
      flowTransferCost =
        weightKg *
        (KILOMETRIC_RATE_BY_UF[destinationUf] || KILOMETRIC_RATE_FALLBACK) *
        distanceKm *
        freightMultiplier *
        demandMultiplier;
      transferMethod = 'kilometric_proxy';
    } else if (weightKg > 0) {
      const fallback = resolveTransferFallback({
        distributionCost: flowDistributionCost,
        revenue: flowRevenue(flow),
        freightMultiplier,
        demandMultiplier,
      });
      flowTransferCost = fallback.cost;
      transferMethod = fallback.method;
      transferSource = fallback.source;
      transferFallbackCount += 1;
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
      transfer_method: transferMethod,
      transfer_source: transferSource,
    });
  }

  if (missingRateCount)
    warnings.push(
      `${missingRateCount} fluxo(s) sem tarifa na distance_matrix; fallback de receita aplicado quando havia faturamento.`
    );
  if (missingDistanceCount)
    warnings.push(
      `${missingDistanceCount} fluxo(s) sem distância exata na matriz; transferência desses fluxos usa fallback rastreável (${Math.round(MODEL_DEFAULTS.transfer_to_distribution_ratio * 100)}% da distribuição quando disponível).`
    );

  const anyPriced = flowCostDetail.some(
    (flow) => flow.method === 'distance_matrix' || flow.method === 'revenue_pct_fallback'
  );
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
    diagnostics: {
      flow_method_counts: flowCostDetail.reduce((counts, flow) => {
        counts[flow.method] = (counts[flow.method] || 0) + 1;
        return counts;
      }, {}),
      transfer_method_counts: flowCostDetail.reduce((counts, flow) => {
        counts[flow.transfer_method] = (counts[flow.transfer_method] || 0) + 1;
        return counts;
      }, {}),
      fallback_counts: {
        missing_freight_rate: missingRateCount,
        revenue_fallback: revenueFallbackCount,
        missing_transfer_distance: missingDistanceCount,
        transfer_fallback: transferFallbackCount,
      },
      proxy_sources: [
        'distance_matrix',
        'calibrated_uf_kilometric_transfer_rate',
        `${MODEL_DEFAULTS.transfer_kilometric_rate_provenance.source_company}_${MODEL_DEFAULTS.transfer_kilometric_rate_provenance.source_dataset}`,
      ],
      source_classification: 'observed_distribution_plus_cross_company_calibrated_transfer_proxy',
      transfer_proxy_provenance: MODEL_DEFAULTS.transfer_kilometric_rate_provenance,
    },
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
  let missingWeightCount = 0;
  let revenueFallbackCount = 0;
  let transferFallbackCount = 0;
  let factoryFlowNotDistributionCount = 0;
  const flowCostDetail = [];

  for (const flow of flows) {
    const { cost, method, rate } = calcFlowFreightE2(flow, cifMaps, freightMultiplier);
    const flowDistributionCost = cost * demandMultiplier;
    if (method === 'revenue_pct_fallback_missing_weight') missingWeightCount += 1;
    if (method === 'revenue_pct_fallback' || method === 'revenue_pct_fallback_missing_weight')
      revenueFallbackCount += 1;
    if (method === 'factory_to_cd_not_distribution') factoryFlowNotDistributionCount += 1;
    let flowTransferCost = 0;
    let transferMethod = 'not_required';
    let transferSource = 'aux_custo_transferencia';
    if (flow.reallocation_status === 'reallocated') {
      const originUf = up(flow.previous_cd_uf || flow.origin_uf || flow.cd_uf).slice(0, 2);
      const destinationUf = up(flow.destination_uf || flow.assigned_cd_uf || flow.cd_uf).slice(
        0,
        2
      );
      const transferRate =
        transferRateMap[`${originUf}→${destinationUf}`] || transferRateMap[`${originUf}→`] || 0;
      const weightKg = flowWeightE2(flow);
      if (weightKg > 0 && transferRate > 0) {
        flowTransferCost = weightKg * transferRate * freightMultiplier * demandMultiplier;
        transferMethod = 'transfer_rate_table';
      } else {
        const fallback = resolveTransferFallback({
          distributionCost: flowDistributionCost,
          revenue: flowRevenue(flow),
          freightMultiplier,
          demandMultiplier,
        });
        flowTransferCost = fallback.cost;
        transferMethod = fallback.method;
        transferSource = fallback.source;
        transferFallbackCount += 1;
      }
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
      transfer_method: transferMethod,
      transfer_source: transferSource,
    });
  }

  if (missingCount)
    warnings.push(
      `${missingCount} fluxo(s) sem linha na tabela CIF; fallback de receita aplicado quando havia faturamento.`
    );
  if (missingWeightCount)
    warnings.push(
      `${missingWeightCount} fluxo(s) com faturamento e peso ausente; foi aplicado fallback percentual de receita, sem inventar peso.`
    );
  if (factoryFlowNotDistributionCount)
    warnings.push(
      `${factoryFlowNotDistributionCount} fluxo(s) fábrica→CD foram mantidos como evidência operacional e não foram precificados pela tabela CIF; o campo volume não foi convertido em kg.`
    );
  const anyPriced = flowCostDetail.some(
    (flow) =>
      flow.dist_method === 'cif_bracket' ||
      flow.dist_method === 'cif_pct_revenue' ||
      flow.dist_method === 'revenue_pct_fallback' ||
      flow.dist_method === 'revenue_pct_fallback_missing_weight'
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
    diagnostics: {
      flow_method_counts: flowCostDetail.reduce((counts, flow) => {
        counts[flow.dist_method] = (counts[flow.dist_method] || 0) + 1;
        return counts;
      }, {}),
      transfer_method_counts: flowCostDetail.reduce((counts, flow) => {
        counts[flow.transfer_method] = (counts[flow.transfer_method] || 0) + 1;
        return counts;
      }, {}),
      fallback_counts: {
        missing_cif_row: missingCount,
        missing_weight: missingWeightCount,
        revenue_fallback: revenueFallbackCount,
        transfer_fallback: transferFallbackCount,
      },
      proxy_sources: ['tabelas_cif_dist', 'aux_custo_transferencia'],
      source_classification: 'observed_tables_plus_explicit_fallbacks',
    },
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
    diagnostics: {
      flow_method_counts: {},
      transfer_method_counts: {},
      fallback_counts: { unknown_company: 1 },
      proxy_sources: ['generic_baseline_heuristic'],
    },
  });
}

/** Calculates physical logistics costs from the rebuilt flow model. */
export function calculatePhysicalCosts({ companyId, scenario, baselineBundle, rebuilt }) {
  const context = buildCostContext({ scenario, baselineBundle });
  if (companyId === 'empresa1') return calculateCompany1Costs(context, rebuilt.flows);
  if (companyId === 'empresa2') return calculateCompany2Costs(context, rebuilt.flows);
  return calculateUnknownCompanyCosts(companyId, context);
}

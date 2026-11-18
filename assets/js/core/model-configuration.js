import { safeNumber } from './common.js';

/**
 * Parâmetros metodológicos compartilhados pelo simulador.
 *
 * Estes valores são premissas explícitas do modelo. Mantê-los em um único
 * módulo evita que a interface, o motor físico e as análises de risco usem
 * referências diferentes para a mesma grandeza.
 */
export const MODEL_DEFAULTS = Object.freeze({
  // Prosthesis/bionics peer DIO: mean inventory / cost of sales × 365 (Ottobock FY2025).
  inventory_days: 100.4,
  inventory_days_sensitivity: Object.freeze([154, 187.2]),
  // MIT medical-device case estimate for annual inventory carrying costs; not financial WACC.
  reference_wacc: 0.15,
  // ANS/Anvisa knee prosthesis example: landed logistics (R$335) / sale price (R$13,000).
  missing_freight_revenue_pct: 335 / 13000,
  // FDC 2018 shares: long-haul transportation / urban distribution.
  transfer_to_distribution_ratio: 0.401 / 0.234,
  // Company 2 workbook proxy: weighted FRETE VALOR / PESO (R$/kg), not R$/kg-km.
  transfer_rate_per_kg_fallback: 0.005,
  transfer_rate_per_kg_by_uf: Object.freeze({
    SP: 0.0083,
    MG: 0.0049,
    ES: 0.0176,
    RJ: 0.0133,
  }),
  transfer_rate_per_kg_provenance: Object.freeze({
    classification: 'cross_company_calibrated_proxy',
    source_company: 'empresa2',
    source_dataset: 'aux_custo_transferencia',
    rationale: 'Empresa 1 não possui custo de transferência observado por kg no pacote.',
    interpretation: 'proxy em R$/kg; não é tarifa histórica da Empresa 1 nem inclui distância.',
    calibration_method: 'weighted_freight_per_kg_by_destination_uf',
    reproducibility_status: 'limited_runtime_snapshot',
    reproducibility_note:
      'Os valores são snapshot do workbook da Empresa 2; a memória de linhas e o período da extração devem acompanhar a fonte interna.',
  }),
  storage_active_cd_provenance: 'company_baseline_cost_per_active_cd',
});

export const COMPANY_MODEL_DEFAULTS = Object.freeze({
  empresa1: Object.freeze({
    ...MODEL_DEFAULTS,
    inventory_days: 30,
    reference_wacc: 0.15,
    inventory_days_provenance:
      'premissa textual do TCC: estoque de referência equivalente a um mês',
    wacc_provenance: '15% annual inventory carrying-cost proxy from an MIT medical-device case',
  }),
  empresa2: Object.freeze({
    ...MODEL_DEFAULTS,
    inventory_days: 100.4,
    reference_wacc: 0.12,
    inventory_days_provenance: 'proxy DIO Ottobock FY2025; empresa não tem dias de estoque no pacote',
    wacc_provenance: 'Parâmetros do workbook da Empresa 2: WACC anual de 12%',
  }),
});

export const TAX_HEURISTIC_DEFAULTS = Object.freeze({
  // ANS/Anvisa knee prosthesis example: R$455 sales taxes / R$13,000 sale price.
  prosthesis_sales_tax_proxy: 455 / 13000,
  prosthesis_sales_tax_source:
    'ANS/Anvisa OPME report; 2015 knee-prosthesis worked example, historical proxy only',
});

export function getCompanyModelDefaults(companyId) {
  return COMPANY_MODEL_DEFAULTS[companyId] || MODEL_DEFAULTS;
}

export function normalizeScenarioModelDefaults(companyId, scenario = {}) {
  const defaults = getCompanyModelDefaults(companyId);
  const changes = scenario.changes || {};
  const legacySampleScenario = String(scenario.scenario_id || '').startsWith(
    `${companyId}_sample_`
  );
  const legacyRetailInventoryExample =
    companyId === 'empresa1' &&
    legacySampleScenario &&
    scenario.scenario_id === 'empresa1_sample_estoque_menos_10_dias' &&
    Number(changes.inventory_days) === 35;
  const legacyRetailReferenceDays =
    companyId === 'empresa1' &&
    legacySampleScenario &&
    Number(changes.inventory_days) === MODEL_DEFAULTS.inventory_days;
  const legacyIndustryReferenceWacc =
    companyId === 'empresa2' &&
    legacySampleScenario &&
    Number(changes.wacc) === MODEL_DEFAULTS.reference_wacc;
  return {
    ...scenario,
    changes: {
      inventory_days: defaults.inventory_days,
      wacc: defaults.reference_wacc,
      ...changes,
      ...(legacyRetailReferenceDays ? { inventory_days: defaults.inventory_days } : {}),
      ...(legacyRetailInventoryExample ? { inventory_days: defaults.inventory_days - 10 } : {}),
      ...(legacyIndustryReferenceWacc ? { wacc: defaults.reference_wacc } : {}),
    },
  };
}

export const RECONCILIATION_THRESHOLDS = Object.freeze({
  aligned_pct: 3,
  tolerable_pct: 10,
});

export function calculateInventoryCost({
  companyId = null,
  baseInventoryCost = 0,
  demandMultiplier = 1,
  inventoryDays,
  wacc,
} = {}) {
  const reference = getCompanyModelDefaults(companyId);
  const resolvedInventoryDays = inventoryDays ?? reference.inventory_days;
  const resolvedWacc = wacc ?? reference.reference_wacc;
  // Escolha B: estoque é custo de carregamento independente do número de CDs.
  // Não há pooling, 1/sqrt(n), redução por concentração ou outro benefício
  // de risco inventado a partir de active_cds.
  return (
    safeNumber(baseInventoryCost) *
    safeNumber(demandMultiplier, 1) *
    (safeNumber(resolvedInventoryDays, reference.inventory_days) / reference.inventory_days) *
    (safeNumber(resolvedWacc, reference.reference_wacc) / reference.reference_wacc)
  );
}

export function calculateLogisticsTotal({
  transferCost = 0,
  distributionCost = 0,
  storageCost = 0,
  inventoryCost = 0,
} = {}) {
  return (
    safeNumber(transferCost) +
    safeNumber(distributionCost) +
    safeNumber(storageCost) +
    safeNumber(inventoryCost)
  );
}

export function calculateTotalWithTax({ logisticsCost = 0, taxImpact = 0 } = {}) {
  return safeNumber(logisticsCost) + safeNumber(taxImpact);
}

export function calculateSaving({ baselineTotal = 0, scenarioTotal = 0 } = {}) {
  const baseline = safeNumber(baselineTotal);
  const scenario = safeNumber(scenarioTotal);
  const savingAbs = baseline - scenario;
  return {
    baseline_total: baseline,
    scenario_total: scenario,
    saving_abs: savingAbs,
    saving_pct: baseline ? (savingAbs / baseline) * 100 : 0,
  };
}

export function classifyReconciliationDeviation(percentageError) {
  const value = Number(percentageError);
  if (!Number.isFinite(value)) return 'pending';
  const absolute = Math.abs(value);
  if (absolute <= RECONCILIATION_THRESHOLDS.aligned_pct) return 'aligned';
  if (absolute <= RECONCILIATION_THRESHOLDS.tolerable_pct) return 'tolerable';
  return 'divergent';
}

export function resolveTransferFallback({
  distributionCost = 0,
  revenue = 0,
  freightMultiplier = 1,
  demandMultiplier = 1,
} = {}) {
  const distribution = safeNumber(distributionCost);
  const revenueValue = safeNumber(revenue);
  const fm = safeNumber(freightMultiplier, 1);
  const dm = safeNumber(demandMultiplier, 1);
  if (distribution > 0) {
    return {
      cost: distribution * MODEL_DEFAULTS.transfer_to_distribution_ratio,
      method: 'distribution_ratio_fallback',
      source: 'explicit_transfer_to_distribution_ratio',
      ratio: MODEL_DEFAULTS.transfer_to_distribution_ratio,
    };
  }
  if (revenueValue > 0) {
    return {
      cost: revenueValue * MODEL_DEFAULTS.missing_freight_revenue_pct * fm * dm,
      method: 'revenue_pct_fallback',
      source: 'explicit_revenue_pct_fallback',
      rate: MODEL_DEFAULTS.missing_freight_revenue_pct,
    };
  }
  return {
    cost: 0,
    method: 'missing_transfer_inputs',
    source: 'no_weight_revenue_or_distribution_input',
  };
}

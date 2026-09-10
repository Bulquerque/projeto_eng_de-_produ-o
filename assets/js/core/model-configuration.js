import { safeNumber } from './common.js';

/**
 * Parâmetros metodológicos compartilhados pelo simulador.
 *
 * Estes valores são premissas explícitas do modelo. Mantê-los em um único
 * módulo evita que a interface, o motor físico e as análises de risco usem
 * referências diferentes para a mesma grandeza.
 */
export const MODEL_DEFAULTS = Object.freeze({
  inventory_days: 45,
  reference_wacc: 0.15,
  missing_freight_revenue_pct: 0.025,
  transfer_to_distribution_ratio: 0.4,
  transfer_kilometric_fallback_rate: 0.005,
  transfer_kilometric_rate_by_uf: Object.freeze({
    SP: 0.0083,
    MG: 0.0049,
    ES: 0.0176,
    RJ: 0.0133,
  }),
  transfer_kilometric_rate_provenance: Object.freeze({
    classification: 'cross_company_calibrated_proxy',
    source_company: 'empresa2',
    source_dataset: 'aux_custo_transferencia',
    rationale: 'Empresa 1 não possui custo de transferência observado por km no pacote.',
    interpretation: 'proxy de engenharia; não é tarifa histórica da Empresa 1.',
    calibration_method: 'weighted_freight_per_kg_by_destination_uf',
    reproducibility_status: 'limited_runtime_snapshot',
    reproducibility_note:
      'As taxas publicadas são um snapshot; a memória de linhas, período e validação deve acompanhar o dataset de calibração.',
  }),
  storage_active_cd_floor_ratio: 0.65,
  storage_active_cd_slope: 0.35,
  storage_active_cd_provenance: 'engineering_hypothesis_not_observed_per_cd',
});

export const RECONCILIATION_THRESHOLDS = Object.freeze({
  aligned_pct: 3,
  tolerable_pct: 10,
});

export function calculateInventoryCost({
  baseInventoryCost = 0,
  demandMultiplier = 1,
  inventoryDays = MODEL_DEFAULTS.inventory_days,
  wacc = MODEL_DEFAULTS.reference_wacc,
} = {}) {
  // Escolha B: estoque é custo de carregamento independente do número de CDs.
  // Não há pooling, 1/sqrt(n), redução por concentração ou outro benefício
  // de risco inventado a partir de active_cds.
  return (
    safeNumber(baseInventoryCost) *
    safeNumber(demandMultiplier, 1) *
    (safeNumber(inventoryDays, MODEL_DEFAULTS.inventory_days) / MODEL_DEFAULTS.inventory_days) *
    (safeNumber(wacc, MODEL_DEFAULTS.reference_wacc) / MODEL_DEFAULTS.reference_wacc)
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

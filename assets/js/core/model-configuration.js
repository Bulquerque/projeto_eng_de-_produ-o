import { safeNumber } from './common.js';

/**
 * Parâmetros metodológicos compartilhados pelo simulador.
 *
 * Estes valores são premissas explícitas do modelo. Mantê-los em um único
 * módulo evita que a interface, o motor físico e as análises de risco usem
 * referências diferentes para a mesma grandeza. Fonte, fórmula e aplicação
 * de cada valor estão em docs/REGISTRO_PREMISSAS_NUMERICAS.md; proxies são
 * hipóteses de cenário, não fatos observados da empresa.
 */
export const MODEL_DEFAULTS = Object.freeze({
  // Proxy DIO Ottobock FY2025: mean(€215.6m, €221.0m) / €793.3m COGS × 365 = 100.4d.
  inventory_days: 100.4,
  // External DIO comparables for medical aids/devices (Roland Berger, 2019/2022).
  inventory_days_sensitivity: Object.freeze([154, 187.2]),
  // Legacy field name retained for saved scenarios; value is annual inventory carrying-cost
  // proxy (MIT medical-device case, 15%), not a company-specific WACC.
  reference_wacc: 0.15,
  // ANS/Anvisa OPME knee-prosthesis example: R$335 freight/insurance/customs ÷ R$13,000
  // hospital sale price = 2.58%; rounded to 2.5% as a landed-logistics proxy.
  missing_freight_revenue_pct: 0.025,
  // FDC 2018 logistics survey: long-haul 40.1% / urban distribution 23.4% of logistics cost.
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
      'As taxas publicadas são um snapshot; a memória de linhas, período e validação deve acompanhar o dataset de calibração.',
  }),
  storage_active_cd_provenance: 'company_baseline_cost_per_active_cd',
});

export const TAX_HEURISTIC_DEFAULTS = Object.freeze({
  // Same ANS/Anvisa OPME example: R$455 sales taxes / R$13,000 hospital sale = 3.5%.
  prosthesis_sales_tax_proxy: 455 / 13000,
  prosthesis_sales_tax_source:
    'ANS/Anvisa OPME report; 2015 knee-prosthesis worked example, historical proxy only',
});

/**
 * Configuração técnica do Monte Carlo para execução reproduzível.
 * Iterações, seed e limites são parâmetros operacionais do simulador;
 * não representam benchmark empírico nem médias observadas das empresas.
 */
export const MONTE_CARLO_CONFIG = Object.freeze({
  iterations: 300,
  seed: 42,
  min_iterations: 50,
  max_iterations: 5000,
  iterations_step: 50,
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
